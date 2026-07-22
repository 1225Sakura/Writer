"""Pacing schemas (Phase 1 Track B.3)."""
from __future__ import annotations

from typing import Optional

from pydantic import Field

from app.schemas.base import BaseSchema


# ---------------------------------------------------------------------------
# Curves
# ---------------------------------------------------------------------------

class CurveBucket(BaseSchema):
    """One intensity bucket in the pacing curve."""

    position: int
    intensity: float = Field(..., ge=0.0, le=1.0)
    label: str = ""


class PacingCurveOut(BaseSchema):
    chapter_id: int
    curve: list[CurveBucket]
    avg_intensity: float
    variance: float


class AnalyzeRequest(BaseSchema):
    """Optional body for POST analyze."""

    num_buckets: int = Field(default=10, ge=2, le=100)
    seed: Optional[int] = None


class AnalysisResult(BaseSchema):
    chapter_id: int
    analyzed_at: str
    num_buckets: int
    avg_intensity: float
    variance: float


# ---------------------------------------------------------------------------
# Recommendations
# ---------------------------------------------------------------------------

class RecommendationOut(BaseSchema):
    id: int
    chapter_id: int
    title: str
    description: str
    category: str
    priority: int
    applied: bool


class RecommendationList(BaseSchema):
    chapter_id: int
    recommendations: list[RecommendationOut]
    total: int


class ApplyResult(BaseSchema):
    id: int
    applied: bool
    applied_at: str
