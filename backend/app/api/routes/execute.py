"""
api/routes/execute.py — POST /execute endpoint.

Pipeline:
  1. Instrument the user's C++ source (inject trace calls).
  2. Run the instrumented binary in the Docker sandbox.
  3. Parse the TRACE: lines into typed events.
  4. Build a CFG from the events.
  5. Return everything in one response.

This endpoint is called after /analyze — the user has already confirmed
the cleaned stdin and struct schema.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from app.core.executor.docker_runner import run_in_sandbox
from app.core.instrumenter.injector import instrument
from app.core.trace.cfg_builder import build as build_cfg
from app.core.trace.parser import parse as parse_trace
from app.models.request import ExecuteRequest
from app.models.response import ExecuteResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=ExecuteResponse)
async def execute(req: ExecuteRequest) -> ExecuteResponse:
    """Instrument, run, and trace a C++ program.

    Steps:
      1. Instrument source with libclang injector.
      2. Run in Docker sandbox with cleaned stdin.
      3. Parse trace output.
      4. Build CFG.
      5. Return structured response.

    Returns compile_error if compilation fails (trace will be empty).
    Returns runtime_error if the program crashes or times out.
    """
    # ── Step 1: Instrument ────────────────────────────────────────────────────
    try:
        instrumented = instrument(req.code)
    except Exception as e:
        logger.exception("Instrumentation failed")
        raise HTTPException(status_code=422, detail=f"Instrumentation error: {e}")

    # ── Step 2: Run in sandbox ────────────────────────────────────────────────
    try:
        run_result = await run_in_sandbox(instrumented, req.cleaned_stdin)
    except Exception as e:
        logger.exception("Sandbox execution failed")
        raise HTTPException(status_code=500, detail=f"Sandbox error: {e}")

    # Compile error — return early with the error message
    if run_result.compile_error:
        return ExecuteResponse(
            stdout="",
            compile_error=run_result.compile_error,
        )

    # ── Step 3: Parse trace ───────────────────────────────────────────────────
    events = parse_trace(run_result.trace_raw)

    # ── Step 4: Build CFG ─────────────────────────────────────────────────────
    cfg_nodes, cfg_edges = build_cfg(events)

    # Determine runtime error
    runtime_error: str | None = None
    if run_result.timed_out:
        runtime_error = "Execution timed out (10s limit)"
    elif run_result.exit_code != 0 and run_result.stderr_clean:
        runtime_error = run_result.stderr_clean

    return ExecuteResponse(
        stdout=run_result.stdout,
        runtime_error=runtime_error,
        timed_out=run_result.timed_out,
        trace=[e.model_dump(by_alias=False) for e in events],
        cfg_nodes=cfg_nodes,
        cfg_edges=cfg_edges,
        total_steps=len(events),
    )
