"""
llm/serializer_gen.py — Generates C++ struct serializer code from a ProgramSchema.

Given a schema like:
  TreeNode { val: int (label), left: TreeNode* (left_child), right: TreeNode* (right_child) }

Generates:
  std::string __serialize_TreeNode(TreeNode* node, std::set<void*>& visited, int depth) {
      if (!node || depth > 50) return "null";
      if (visited.count((void*)node)) return "{\"$cycle\":true}";
      visited.insert((void*)node);
      std::string out = "{";
      out += "\"val\":" + __ser(node->val) + ",";
      out += "\"left\":" + __serialize_TreeNode(node->left, visited, depth+1) + ",";
      out += "\"right\":" + __serialize_TreeNode(node->right, visited, depth+1);
      out += "}";
      return out;
  }

This code is appended to tracer.h before compilation. We generate it from the
validated schema — never from LLM-generated C++ directly (LLMs hallucinate bugs).

Gotcha: Pointer fields use the recursive __serialize_TypeName function.
Non-pointer fields use the generic __ser() template.
"""

from __future__ import annotations

from app.core.trace.models import FieldRole, ProgramSchema, StructSchema


def generate(schema: ProgramSchema) -> str:
    """Generate C++ serializer functions for all structs in the schema.

    Args:
        schema: The validated ProgramSchema from struct_analyzer.

    Returns:
        C++ source string to append to tracer.h before compilation.
        Returns empty string if schema has no structs.
    """
    if not schema.structs:
        return ""

    parts: list[str] = []
    parts.append("\n// ── Generated struct serializers ─────────────────────────────────────────────\n")

    # Forward declarations first (structs may reference each other)
    for struct in schema.structs:
        parts.append(
            f"std::string __serialize_{struct.name}"
            f"({struct.name}* node, std::set<void*>& visited, int depth);\n"
        )

    parts.append("\n")

    # Full definitions
    for struct in schema.structs:
        parts.append(_generate_struct_serializer(struct))

    return "".join(parts)


def _generate_struct_serializer(struct: StructSchema) -> str:
    """Generate the serializer function for a single struct."""
    name = struct.name
    lines: list[str] = []

    lines.append(f"std::string __serialize_{name}({name}* node, std::set<void*>& visited, int depth) {{")
    lines.append(f'    if (!node || depth > 50) return "null";')
    lines.append(f'    if (visited.count((void*)node)) return "{{\\\"$cycle\\\":true}}";')
    lines.append(f"    visited.insert((void*)node);")
    lines.append(f'    std::string out = "{{";')

    pointer_roles = {
        FieldRole.LEFT_CHILD,
        FieldRole.RIGHT_CHILD,
        FieldRole.NEXT,
        FieldRole.PREV,
        FieldRole.POINTER,
    }

    for i, field in enumerate(struct.fields):
        is_last = i == len(struct.fields) - 1
        comma = "" if is_last else ","

        if field.role in pointer_roles:
            # Pointer field — use recursive serializer
            # Determine the pointed-to type (strip * from cpp_type)
            pointed_type = field.cpp_type.rstrip("*").strip()
            lines.append(
                f'    out += "\\"{field.name}\\":" + '
                f'__serialize_{pointed_type}(node->{field.name}, visited, depth+1) + "{comma}";'
            )
        else:
            # Value field — use generic __ser
            lines.append(
                f'    out += "\\"{field.name}\\":" + __ser(node->{field.name}) + "{comma}";'
            )

    lines.append(f'    out += "}}";')
    lines.append(f"    return out;")
    lines.append(f"}}")
    lines.append("")

    return "\n".join(lines) + "\n"
