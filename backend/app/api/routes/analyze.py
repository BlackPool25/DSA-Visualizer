"""
api/routes/analyze.py — POST /analyze endpoint.

Called first when the user submits code. Runs two LLM calls in parallel:
  1. struct_analyzer: identifies pointer-based structs and their rendering schema.
  2. input_cleaner: reformats the user's raw stdin to match the program's cin calls.

Returns the schema and cleaned stdin for the user to confirm before executing.

This endpoint is intentionally separate from /execute so the user can see
and confirm the cleaned input before the program runs.
"""

from __future__ import annotations

import asyncio
import logging

from fastapi import APIRouter

from app.core.llm.input_cleaner import clean_stdin
from app.core.llm.struct_analyzer import analyze_structs
from app.models.request import AnalyzeRequest
from app.models.response import AnalyzeResponse

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("", response_model=AnalyzeResponse)
async def analyze(req: AnalyzeRequest) -> AnalyzeResponse:
    """Analyse C++ code and clean stdin before execution.

    Runs struct analysis and stdin cleaning in parallel.
    Both operations degrade gracefully on failure.
    """
    # Run both LLM calls concurrently
    struct_schema, (cleaned_stdin, preview) = await asyncio.gather(
        analyze_structs(req.code),
        clean_stdin(req.code, req.raw_input),
    )

    return AnalyzeResponse(
        struct_schema=struct_schema,
        cleaned_stdin=cleaned_stdin,
        stdin_preview=preview,
    )
