"""
trace/parser.py — Parses raw TRACE: lines into a typed TraceEvent list.

Input: list of raw JSON strings (TRACE: prefix already stripped by docker_runner).
Output: list[TraceEvent] in execution order.

The index of an event in this list is its "step number" — used everywhere
else in the system to synchronise the scrubber, CFG, and state panel.

Gotcha: The LLM or user code might produce malformed JSON. We skip bad lines
and log a warning rather than crashing — partial traces are better than none.

Gotcha: Pydantic v2 discriminated unions require model_validate with the
raw dict, not model_validate_json, because we need to handle the alias mapping.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from pydantic import TypeAdapter, ValidationError

from .models import (
    BranchEvent,
    EventType,
    FuncEnterEvent,
    FuncExitEvent,
    LoopIterEvent,
    StateEvent,
    TraceEvent,
)

logger = logging.getLogger(__name__)

# TypeAdapter lets us validate a discriminated union without a wrapper model
_event_adapter: TypeAdapter[TraceEvent] = TypeAdapter(TraceEvent)  # type: ignore[type-arg]


def parse(raw_lines: list[str]) -> list[Any]:
    """Parse raw TRACE: JSON lines into a list of typed TraceEvent objects.

    Args:
        raw_lines: List of JSON strings (TRACE: prefix already stripped).
                   Each string should be a valid JSON object.

    Returns:
        List of TraceEvent objects in execution order.
        Malformed lines are skipped with a warning.
    """
    events: list[Any] = []

    for i, line in enumerate(raw_lines):
        line = line.strip()
        if not line:
            continue
        try:
            data = json.loads(line)
        except json.JSONDecodeError as e:
            logger.warning("Skipping malformed trace line %d: %s — %s", i, line[:80], e)
            continue

        try:
            event = _event_adapter.validate_python(data)
            events.append(event)
        except ValidationError as e:
            logger.warning("Skipping invalid trace event at line %d: %s — %s", i, data, e)
            continue

    return events
