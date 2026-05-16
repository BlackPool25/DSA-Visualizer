"""
llm/input_cleaner.py — Cleans and formats user-provided stdin using Ollama.

DSA students often provide input in a messy format (e.g., "5 elements: 1 2 3 4 5"
instead of just "5\n1 2 3 4 5"). This module asks the LLM to reformat it to
match what the program's cin calls expect.

We extract the relevant cin usage from the code before sending to reduce
token usage and improve accuracy.

Gotcha: We show the cleaned input to the user before running (confirmation step
in the frontend). Never silently use LLM-cleaned input without user seeing it.
"""

from __future__ import annotations

import asyncio
import logging
import re

import ollama

logger = logging.getLogger(__name__)

_MODEL = "qwen2.5-coder:14b"

_SYSTEM_PROMPT = """You are a stdin formatter. Given C++ code and a user's raw input,
return ONLY the properly formatted stdin string. No explanation, no markdown, just the raw stdin content."""


def _extract_cin_usage(code: str) -> str:
    """Extract cin usage patterns from the code to give the LLM context.

    Returns a short snippet showing how the program reads input.
    """
    lines = code.splitlines()
    cin_lines = [l.strip() for l in lines if "cin" in l or "scanf" in l]
    return "\n".join(cin_lines[:10])  # Cap at 10 lines


async def clean_stdin(code: str, raw_input: str) -> tuple[str, str]:
    """Clean and format the user's raw stdin to match the program's expectations.

    Args:
        code: The user's C++ source code.
        raw_input: The user's raw stdin (may be messy or empty).

    Returns:
        Tuple of (cleaned_stdin, preview_message).
        cleaned_stdin: The formatted stdin string ready to pipe to the program.
        preview_message: Human-readable description of what was cleaned.
    """
    cin_usage = _extract_cin_usage(code)
    if not raw_input.strip():
        # Check if the program actually reads stdin
        if not cin_usage:
            return "", "Program reads no stdin — running directly"
        return "", "No input provided (program will read from empty stdin)"
    if not cin_usage:
        # No cin found — return raw input as-is
        return raw_input, "No cin usage found — using raw input as-is"

    try:
        cleaned = await _call_ollama(cin_usage, raw_input)
        preview = _make_preview(raw_input, cleaned)
        return cleaned, preview
    except Exception as e:
        logger.warning("Input cleaning failed, using raw input: %s", e)
        return raw_input, f"Input cleaning failed ({e}) — using raw input as-is"


async def _call_ollama(cin_usage: str, raw_input: str) -> str:
    """Call Ollama to clean the stdin."""
    def _sync_call() -> str:
        client = ollama.Client()
        user_msg = (
            f"The C++ program reads input like this:\n{cin_usage}\n\n"
            f"The user provided this raw input:\n{raw_input}\n\n"
            "Return only the cleaned stdin content, nothing else."
        )
        response = client.chat(
            model=_MODEL,
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": user_msg},
            ],
            options={"temperature": 0.0},
        )
        return response.message.content.strip()

    return await asyncio.to_thread(_sync_call)


def _make_preview(original: str, cleaned: str) -> str:
    """Generate a human-readable preview of what changed."""
    if original.strip() == cleaned.strip():
        return "Input looks correct — no changes needed"
    orig_lines = len(original.splitlines())
    clean_lines = len(cleaned.splitlines())
    return f"Reformatted from {orig_lines} line(s) to {clean_lines} line(s)"
