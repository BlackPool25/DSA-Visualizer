"""
injector.py — Source rewriter that inserts trace calls into C++ source.

Takes the original source text + injection points from ast_walker and produces
a new .cpp string with all trace calls inserted. Never modifies the original.

Strategy:
  - Build a list of (line_number, position, text) insertions.
  - "before" insertions go on a new line before the target line.
  - "after" insertions go on a new line after the target line.
  - FUNC_ENTER is inserted as the first statement inside the function body
    (on the line after the opening brace).
  - BRANCH is inserted before the if/while line.
  - LOOP_ITER is inserted after the opening brace of the loop body.
  - STATE is inserted after the statement.
  - Loop counter declarations are prepended as static globals.

Gotcha: BRANCH must be inserted before the if statement, not between
if and else — otherwise the else loses its if.

Gotcha: Trailing comma in __TRACE_FUNC_ENTER when params is empty.
We handle this by only adding the comma separator when there are params.
"""

from __future__ import annotations

import tempfile
from pathlib import Path

from .ast_walker import InjectKind, InjectionPoint, WalkResult, walk
from .scope_tracker import FunctionScope, build_scope_map


def _make_vars_args(var_names: list[str]) -> str:
    """Build the variadic argument list for __TRACE_STATE / __TRACE_FUNC_ENTER.

    Example: ["lo", "hi"] → '"lo", lo, "hi", hi'
    Returns empty string (not ", ") when var_names is empty.
    """
    if not var_names:
        return ""
    parts = [f'"{name}", {name}' for name in var_names]
    return ", ".join(parts)


def _trace_enter(point: InjectionPoint) -> str:
    params_args = _make_vars_args(point.param_names)
    # Only add comma separator if there are params
    sep = ", " if params_args else ""
    return f'__TRACE_FUNC_ENTER("{point.func_name}", {point.depth}{sep}{params_args});'


def _trace_state(point: InjectionPoint, scope: FunctionScope | None) -> str:
    var_names = point.var_names
    if not var_names and scope:
        visible = scope.vars_at_line.get(point.line, [])
        var_names = [v.name for v in visible]
    vars_args = _make_vars_args(var_names)
    sep = ", " if vars_args else ""
    return f'__TRACE_STATE({point.line}, "{point.func_name}", {point.depth}{sep}{vars_args});'


def _trace_branch(point: InjectionPoint) -> str:
    cond = point.condition_text.replace("\\", "\\\\").replace('"', '\\"')
    return (
        f'__TRACE_BRANCH({point.line}, "{point.func_name}", {point.depth}, '
        f'"{cond}", ({point.condition_text}));'
    )


def _trace_loop_iter(point: InjectionPoint) -> str:
    return (
        f'__TRACE_LOOP_ITER({point.line}, "{point.func_name}", {point.depth}, '
        f'{point.counter_var}++);'
    )


def instrument(source: str, source_path: str | None = None) -> str:
    """Instrument C++ source by inserting trace calls.

    Args:
        source: The original C++ source code as a string.
        source_path: Optional path hint for libclang. If None, written to a temp file.

    Returns:
        Instrumented C++ source as a string, ready to compile.
        The returned source has #include "tracer.h" at the top.
        The caller must ensure tracer.h is in the include path when compiling.
    """
    _tmp = None
    if source_path is None:
        _tmp = tempfile.NamedTemporaryFile(suffix=".cpp", mode="w", delete=False)
        _tmp.write(source)
        _tmp.flush()
        source_path = _tmp.name

    try:
        walk_result = walk(source_path)
        scope_map = build_scope_map(source_path)
    finally:
        if _tmp:
            Path(_tmp.name).unlink(missing_ok=True)

    lines = source.splitlines(keepends=True)

    # insertions_before[line] = list of text to insert BEFORE that line
    # insertions_after[line]  = list of text to insert AFTER that line
    insertions_before: dict[int, list[str]] = {}
    insertions_after: dict[int, list[str]] = {}

    def add_before(line: int, text: str) -> None:
        insertions_before.setdefault(line, []).append(text)

    def add_after(line: int, text: str) -> None:
        insertions_after.setdefault(line, []).append(text)

    for point in walk_result.injection_points:
        scope = scope_map.get(point.func_name)

        if point.kind == InjectKind.FUNC_ENTER:
            # Insert as first statement inside the function body.
            # The opening brace is on point.line; insert AFTER that line.
            add_after(point.line, _trace_enter(point))

        elif point.kind == InjectKind.FUNC_EXIT:
            # Insert a STATE snapshot before the return statement.
            # We use add_before so it appears before the return, not after.
            add_before(point.line, _trace_state(point, scope))

        elif point.kind == InjectKind.STATE:
            # Don't insert STATE after a return — it would be unreachable.
            line_text = lines[point.line - 1] if point.line <= len(lines) else ""
            if "return" in line_text:
                continue
            # Don't insert STATE after a line that's followed by an else/else-if.
            # That would break the if/else chain.
            next_line = lines[point.line].strip() if point.line < len(lines) else ""
            if next_line.startswith("else"):
                continue
            add_after(point.line, _trace_state(point, scope))

        elif point.kind == InjectKind.BRANCH:
            # Insert BEFORE the if/while line so we don't break if/else chains.
            add_before(point.line, _trace_branch(point))

        elif point.kind == InjectKind.LOOP_ITER:
            # Insert AFTER the opening brace of the loop body.
            add_after(point.line, _trace_loop_iter(point))

    # ── Build output ──────────────────────────────────────────────────────────
    output: list[str] = []

    # 1. tracer.h include
    output.append('#include "tracer.h"\n')

    # 2. Loop counter declarations (static so they survive across calls)
    for fn, counters in walk_result.loop_counters.items():
        for counter in counters:
            output.append(f"static int {counter} = 0;\n")

    # 3. Source lines with injections
    for i, line_text in enumerate(lines):
        line_num = i + 1  # 1-based

        # Before insertions
        for text in insertions_before.get(line_num, []):
            output.append(text + "\n")

        output.append(line_text)

        # After insertions
        for text in insertions_after.get(line_num, []):
            output.append(text + "\n")

    return "".join(output)
