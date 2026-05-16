"""
llm/struct_analyzer.py — Extracts struct rendering schemas from C++ code using Ollama.

Sends the user's code to the LLM and asks it to identify pointer-based structs
and describe how to render them (tree, linked list, graph).

The LLM output is validated against ProgramSchema. If validation fails,
we return an empty schema (graceful degradation — pointer structs just won't
be visualised, but the trace still works).

Gotcha: We cross-validate LLM field names against the actual AST to catch
hallucinations. Any field name the LLM returns that doesn't exist in the
struct is silently dropped.

Gotcha: We use qwen2.5-coder:14b — a code-focused model that's better at
understanding C++ struct layouts than general-purpose models.
"""

from __future__ import annotations

import json
import logging
import re

import ollama

from app.core.trace.models import (
    FieldRole,
    ProgramSchema,
    RenderAs,
    StructField,
    StructSchema,
)

logger = logging.getLogger(__name__)

# Model to use — qwen2.5-coder is available locally per `ollama list`
_MODEL = "qwen2.5-coder:14b"

_SYSTEM_PROMPT = """You are a C++ code analyser. Your only job is to output a JSON schema
describing custom pointer-based structs in the code. Output ONLY valid JSON, no markdown, no explanation.

The JSON must match this exact schema:
{
  "structs": [
    {
      "name": string,
      "render_as": "tree" | "linked_list" | "graph",
      "fields": [
        {
          "name": string,
          "cpp_type": string,
          "role": "label" | "left_child" | "right_child" | "next" | "prev" | "pointer" | "data"
        }
      ]
    }
  ]
}

Rules:
- Only include structs that have pointer fields (TreeNode*, ListNode*, etc.)
- "render_as" = "tree" if it has left/right child pointers
- "render_as" = "linked_list" if it has next/prev pointers
- "render_as" = "graph" for other pointer structures
- If there are no custom pointer structs, return: {"structs": []}
- Output ONLY the JSON object, nothing else."""


def _extract_struct_fields_from_ast(code: str, struct_name: str) -> set[str]:
    """Extract actual field names from a struct definition using regex.

    This is a fallback cross-check — we don't use libclang here to keep
    this module fast and dependency-light.

    Returns a set of field names found in the struct body.
    """
    # Find the struct body
    pattern = rf"struct\s+{re.escape(struct_name)}\s*\{{([^}}]*)\}}"
    match = re.search(pattern, code, re.DOTALL)
    if not match:
        return set()

    body = match.group(1)
    # Extract field names: look for "type name;" patterns
    fields = set()
    for line in body.splitlines():
        line = line.strip().rstrip(";")
        parts = line.split()
        if len(parts) >= 2:
            # Last token is the field name (strip * and &)
            name = parts[-1].lstrip("*&")
            if name and name.isidentifier():
                fields.add(name)
    return fields


def _validate_schema_fields(schema: ProgramSchema, code: str) -> ProgramSchema:
    """Cross-check LLM field names against the actual struct definitions.

    Drops any field the LLM hallucinated that doesn't exist in the source.
    """
    validated_structs = []
    for struct in schema.structs:
        actual_fields = _extract_struct_fields_from_ast(code, struct.name)
        if not actual_fields:
            # Can't verify — keep as-is
            validated_structs.append(struct)
            continue

        valid_fields = [f for f in struct.fields if f.name in actual_fields]
        if valid_fields:
            validated_structs.append(StructSchema(
                name=struct.name,
                render_as=struct.render_as,
                fields=valid_fields,
            ))

    return ProgramSchema(structs=validated_structs)


async def analyze_structs(code: str) -> ProgramSchema:
    """Ask the LLM to identify pointer-based structs and their rendering schema.

    Args:
        code: The user's C++ source code.

    Returns:
        ProgramSchema with struct rendering instructions.
        Returns empty schema on any error (graceful degradation).
    """
    try:
        response = await _call_ollama(code)
        schema = _parse_response(response)
        return _validate_schema_fields(schema, code)
    except Exception as e:
        logger.warning("Struct analysis failed (graceful degradation): %s", e)
        return ProgramSchema(structs=[])


async def _call_ollama(code: str) -> str:
    """Call Ollama with the struct analysis prompt."""
    import asyncio
    # ollama Python client is sync — run in thread
    def _sync_call() -> str:
        client = ollama.Client()
        response = client.chat(
            model=_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": f"Analyse this C++ code:\n\n{code}"},
            ],
            options={"temperature": 0.1},  # Low temperature for deterministic JSON
        )
        return response.message.content

    return await asyncio.to_thread(_sync_call)


def _parse_response(response: str) -> ProgramSchema:
    """Parse the LLM response into a ProgramSchema.

    Handles cases where the LLM wraps JSON in markdown code blocks.
    """
    # Strip markdown code blocks if present
    text = response.strip()
    if text.startswith("```"):
        lines = text.splitlines()
        text = "\n".join(lines[1:-1] if lines[-1] == "```" else lines[1:])

    # Find the JSON object
    start = text.find("{")
    end = text.rfind("}") + 1
    if start == -1 or end == 0:
        return ProgramSchema(structs=[])

    json_str = text[start:end]
    data = json.loads(json_str)
    return ProgramSchema.model_validate(data)
