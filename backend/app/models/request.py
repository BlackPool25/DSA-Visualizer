"""
models/request.py — API request Pydantic models.

These are the shapes of the JSON bodies accepted by the two endpoints.
"""

from pydantic import BaseModel, Field

from app.core.trace.models import ProgramSchema


class AnalyzeRequest(BaseModel):
    """POST /analyze — first step, called before execution."""
    code: str = Field(..., description="Full C++ source code")
    raw_input: str = Field(default="", description="User's raw stdin (may be messy)")


class ExecuteRequest(BaseModel):
    """POST /execute — second step, called after user confirms cleaned stdin."""
    code: str = Field(..., description="Full C++ source code")
    cleaned_stdin: str = Field(default="", description="Cleaned stdin from /analyze")
    struct_schema: ProgramSchema = Field(
        default_factory=ProgramSchema,
        description="Struct rendering schema from /analyze",
    )
