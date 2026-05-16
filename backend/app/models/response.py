"""
models/response.py — API response Pydantic models.

These are the shapes of the JSON bodies returned by the two endpoints.
The frontend TypeScript types mirror these exactly.
"""

from typing import Any

from pydantic import BaseModel, Field

from app.core.trace.models import CFGEdge, CFGNode, ProgramSchema, TraceEvent


class AnalyzeResponse(BaseModel):
    """Response from POST /analyze."""
    struct_schema: ProgramSchema
    cleaned_stdin: str
    stdin_preview: str = Field(
        description="Human-readable summary of what the cleaned stdin looks like"
    )


class ExecuteResponse(BaseModel):
    """Response from POST /execute."""
    stdout: str
    compile_error: str | None = None
    runtime_error: str | None = None
    timed_out: bool = False
    truncated: bool = Field(
        default=False,
        description="True if trace was cut at MAX_TRACE_LINES — program may have more steps",
    )
    trace: list[Any] = Field(
        default_factory=list,
        description="Flat list of TraceEvent objects in execution order",
    )
    cfg_nodes: list[CFGNode] = Field(default_factory=list)
    cfg_edges: list[CFGEdge] = Field(default_factory=list)
    total_steps: int = 0
