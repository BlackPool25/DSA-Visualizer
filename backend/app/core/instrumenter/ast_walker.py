"""
ast_walker.py — libclang AST traversal to collect injection points.

Walks the AST of a user's C++ source file and produces a list of InjectionPoint
objects — each describing where a trace call should be inserted and what kind.

Rules (from new_plan.md §5.1):
- Only inject into user-defined functions (cursor.location.file == source_path).
- Skip template function instantiations (v1 scope).
- Skip macro-expanded nodes (inconsistent line numbers).
- Skip STL method bodies (inject STATE after the call returns instead).
- Loop counters are collected separately so the injector can declare them
  at function start, not inside the loop.

Gotcha: libclang's Python bindings use clang.cindex. The library path must
be set before import if libclang is not on the system path. We handle this
by trying the installed libclang package's bundled .so.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Optional

import clang.cindex as clang

# ── libclang setup ────────────────────────────────────────────────────────────
# The libclang Python package bundles its own .so. Point the bindings at it.
def _find_libclang() -> Optional[str]:
    try:
        import clang
        pkg_dir = Path(clang.__file__).parent
        for candidate in pkg_dir.glob("*.so*"):
            return str(candidate)
        for candidate in pkg_dir.glob("libclang*.so*"):
            return str(candidate)
    except Exception:
        pass
    return None

_lib = _find_libclang()
if _lib and not clang.Config.loaded:
    clang.Config.set_library_file(_lib)


# ── Data types ────────────────────────────────────────────────────────────────

class InjectKind(Enum):
    FUNC_ENTER  = auto()   # start of a user function body
    FUNC_EXIT   = auto()   # before a return statement
    STATE       = auto()   # after a statement (captures in-scope vars)
    BRANCH      = auto()   # before an if/else-if condition
    LOOP_ITER   = auto()   # at the top of a loop body
    LOOP_COUNTER = auto()  # declaration of __loop_iter_N at function start


@dataclass
class InjectionPoint:
    """A single location where a trace call will be inserted."""
    kind: InjectKind
    line: int           # 1-based source line
    col: int            # 1-based source column (for precise insertion)
    func_name: str      # enclosing function name
    depth: int          # call depth (0 = main, 1 = called from main, etc.)
    # For FUNC_ENTER: parameter names in scope
    param_names: list[str] = field(default_factory=list)
    # For STATE: variable names in scope at this point
    var_names: list[str] = field(default_factory=list)
    # For BRANCH: the condition text
    condition_text: str = ""
    # For LOOP_ITER / LOOP_COUNTER: unique counter variable name
    counter_var: str = ""


@dataclass
class WalkResult:
    """Output of ast_walker.walk()."""
    injection_points: list[InjectionPoint]
    # Maps function name → list of loop counter variable names needed
    loop_counters: dict[str, list[str]]


# ── Walker ────────────────────────────────────────────────────────────────────

class ASTWalker:
    """Walks a C++ AST and collects injection points.

    Args:
        source_path: Absolute path to the user's .cpp file.
        extra_args: Additional compiler flags (e.g., ["-std=c++17"]).
    """

    def __init__(self, source_path: str, extra_args: list[str] | None = None):
        self.source_path = os.path.abspath(source_path)
        self.extra_args = extra_args or ["-std=c++17", "-O0"]
        self._index = clang.Index.create()
        self._loop_counter_seq = 0

    def walk(self) -> WalkResult:
        """Parse the source and return all injection points.

        Returns:
            WalkResult with injection_points and loop_counters.
        """
        tu = self._index.parse(
            self.source_path,
            args=self.extra_args,
            options=(
                clang.TranslationUnit.PARSE_DETAILED_PROCESSING_RECORD |
                clang.TranslationUnit.PARSE_SKIP_FUNCTION_BODIES
            ),
        )
        # Re-parse without SKIP_FUNCTION_BODIES to get full AST
        tu = self._index.parse(
            self.source_path,
            args=self.extra_args,
        )

        points: list[InjectionPoint] = []
        loop_counters: dict[str, list[str]] = {}

        self._walk_cursor(tu.cursor, points, loop_counters, depth=0, func_name="", func_depth=0)

        return WalkResult(injection_points=points, loop_counters=loop_counters)

    # ── Internal traversal ────────────────────────────────────────────────────

    def _is_user_code(self, cursor: clang.Cursor) -> bool:
        """True if this cursor is in the user's source file (not a header)."""
        loc = cursor.location
        return (
            loc.file is not None
            and os.path.abspath(loc.file.name) == self.source_path
        )

    def _is_macro_expanded(self, cursor: clang.Cursor) -> bool:
        """True if this cursor was produced by a macro expansion."""
        return cursor.location.file is not None and cursor.extent.start.offset != cursor.extent.end.offset and cursor.location.offset == 0

    def _is_template_instantiation(self, cursor: clang.Cursor) -> bool:
        """True if this is a template instantiation (skip in v1)."""
        return cursor.kind in (
            clang.CursorKind.FUNCTION_TEMPLATE,
            clang.CursorKind.CLASS_TEMPLATE,
        )

    def _get_condition_text(self, cursor: clang.Cursor) -> str:
        """Extract the text of a condition expression from the source."""
        try:
            start = cursor.extent.start
            end = cursor.extent.end
            with open(self.source_path, encoding="utf-8") as f:
                lines = f.readlines()
            # Single-line condition
            if start.line == end.line:
                line = lines[start.line - 1]
                return line[start.column - 1 : end.column - 1].strip()
            return f"line {start.line}"
        except Exception:
            return "?"

    def _walk_cursor(
        self,
        cursor: clang.Cursor,
        points: list[InjectionPoint],
        loop_counters: dict[str, list[str]],
        depth: int,
        func_name: str,
        func_depth: int,
    ) -> None:
        """Recursively walk the AST."""
        kind = cursor.kind

        # ── Function definition ───────────────────────────────────────────────
        if kind == clang.CursorKind.FUNCTION_DECL and cursor.is_definition():
            if not self._is_user_code(cursor):
                return
            if self._is_template_instantiation(cursor):
                return

            fn = cursor.spelling
            fn_depth = depth

            # Collect parameter names
            params = [
                c.spelling
                for c in cursor.get_children()
                if c.kind == clang.CursorKind.PARM_DECL
            ]

            # Find the compound statement (function body)
            body = next(
                (c for c in cursor.get_children()
                 if c.kind == clang.CursorKind.COMPOUND_STMT),
                None,
            )
            if body is None:
                return

            # FUNC_ENTER at the opening brace
            points.append(InjectionPoint(
                kind=InjectKind.FUNC_ENTER,
                line=body.extent.start.line,
                col=body.extent.start.column + 1,  # after the {
                func_name=fn,
                depth=fn_depth,
                param_names=params,
            ))

            loop_counters.setdefault(fn, [])

            # Walk the body
            for child in body.get_children():
                self._walk_stmt(child, points, loop_counters, fn, fn_depth)

            return  # Don't recurse further — _walk_stmt handles the body

        # ── Recurse into non-function nodes ──────────────────────────────────
        for child in cursor.get_children():
            self._walk_cursor(child, points, loop_counters, depth, func_name, func_depth)

    def _walk_stmt(
        self,
        cursor: clang.Cursor,
        points: list[InjectionPoint],
        loop_counters: dict[str, list[str]],
        func_name: str,
        func_depth: int,
    ) -> None:
        """Walk a statement node inside a function body."""
        if not self._is_user_code(cursor):
            return

        kind = cursor.kind

        # ── Return statement → FUNC_EXIT ──────────────────────────────────────
        if kind == clang.CursorKind.RETURN_STMT:
            points.append(InjectionPoint(
                kind=InjectKind.FUNC_EXIT,
                line=cursor.location.line,
                col=cursor.location.column,
                func_name=func_name,
                depth=func_depth,
            ))
            return

        # ── If statement → BRANCH ─────────────────────────────────────────────
        if kind == clang.CursorKind.IF_STMT:
            children = list(cursor.get_children())
            if children:
                cond = children[0]
                cond_text = self._get_condition_text(cond)
                # Inject BRANCH for this if only.
                # We do NOT inject for else-if — that would insert a statement
                # between `if` and `else`, breaking the chain.
                points.append(InjectionPoint(
                    kind=InjectKind.BRANCH,
                    line=cursor.location.line,
                    col=cursor.location.column,
                    func_name=func_name,
                    depth=func_depth,
                    condition_text=cond_text,
                ))
            # Recurse into then-body (children[1])
            if len(children) > 1:
                self._walk_stmt(children[1], points, loop_counters, func_name, func_depth)
            # Recurse into else branch — but if it's another IF_STMT (else-if),
            # recurse into its bodies without injecting another BRANCH at the top.
            if len(children) > 2:
                else_branch = children[2]
                if else_branch.kind == clang.CursorKind.IF_STMT:
                    # else-if: recurse into its then/else bodies only
                    else_children = list(else_branch.get_children())
                    for ec in else_children[1:]:
                        self._walk_stmt(ec, points, loop_counters, func_name, func_depth)
                else:
                    self._walk_stmt(else_branch, points, loop_counters, func_name, func_depth)
            return

        # ── Loop statements → LOOP_ITER ───────────────────────────────────────
        if kind in (
            clang.CursorKind.FOR_STMT,
            clang.CursorKind.WHILE_STMT,
            clang.CursorKind.DO_STMT,
        ):
            counter_var = f"__loop_iter_{self._loop_counter_seq}"
            self._loop_counter_seq += 1
            loop_counters.setdefault(func_name, []).append(counter_var)

            # Find the loop body (last child for while/for, first for do)
            children = list(cursor.get_children())
            body = children[-1] if children else None

            if body and body.kind == clang.CursorKind.COMPOUND_STMT:
                # Inject LOOP_ITER at the start of the body
                points.append(InjectionPoint(
                    kind=InjectKind.LOOP_ITER,
                    line=body.extent.start.line,
                    col=body.extent.start.column + 1,
                    func_name=func_name,
                    depth=func_depth,
                    counter_var=counter_var,
                ))
                # Recurse into body statements
                for child in body.get_children():
                    self._walk_stmt(child, points, loop_counters, func_name, func_depth)
            return

        # ── Compound statement → recurse ──────────────────────────────────────
        if kind == clang.CursorKind.COMPOUND_STMT:
            for child in cursor.get_children():
                self._walk_stmt(child, points, loop_counters, func_name, func_depth)
            return

        # ── Declaration statement → STATE after ───────────────────────────────
        if kind == clang.CursorKind.DECL_STMT:
            # Collect declared variable names
            var_names = [
                c.spelling
                for c in cursor.get_children()
                if c.kind == clang.CursorKind.VAR_DECL and c.spelling
            ]
            if var_names:
                points.append(InjectionPoint(
                    kind=InjectKind.STATE,
                    line=cursor.extent.end.line,
                    col=cursor.extent.end.column,
                    func_name=func_name,
                    depth=func_depth,
                    var_names=var_names,
                ))
            return

        # ── Expression/call statements → STATE after ─────────────────────────
        if kind in (
            clang.CursorKind.CALL_EXPR,
            clang.CursorKind.BINARY_OPERATOR,
            clang.CursorKind.UNARY_OPERATOR,
            clang.CursorKind.COMPOUND_ASSIGNMENT_OPERATOR,
        ):
            points.append(InjectionPoint(
                kind=InjectKind.STATE,
                line=cursor.extent.end.line,
                col=cursor.extent.end.column,
                func_name=func_name,
                depth=func_depth,
            ))
            return

        # Default: recurse
        for child in cursor.get_children():
            self._walk_stmt(child, points, loop_counters, func_name, func_depth)


def walk(source_path: str, extra_args: list[str] | None = None) -> WalkResult:
    """Convenience function — create a walker and walk the source file.

    Args:
        source_path: Path to the .cpp file to analyse.
        extra_args: Additional clang flags.

    Returns:
        WalkResult with all injection points and loop counter declarations needed.
    """
    return ASTWalker(source_path, extra_args).walk()
