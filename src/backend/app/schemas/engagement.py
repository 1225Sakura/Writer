"""Engagement schemas (Phase 1 Track B.2)."""
from __future__ import annotations

from typing import Optional

from pydantic import Field

from app.schemas.base import BaseSchema


# ---------------------------------------------------------------------------
# Scores
# ---------------------------------------------------------------------------

class EngagementScoreOut(BaseSchema):
    chapter_id: int
    hook_score: float
    engagement_score: float
    predicted_retention: float
    overall_score: float
    grade: str
    suggestions: list[str] = []


class ComputeRequest(BaseSchema):
    """Optional body for POST compute (currently empty / no params)."""

    note: Optional[str] = Field(default=None, max_length=500)


class ComputeResponse(BaseSchema):
    chapter_id: int
    computed_at: str
    score: EngagementScoreOut


# ---------------------------------------------------------------------------
# Cool points
# ---------------------------------------------------------------------------

class CoolPointOut(BaseSchema):
    id: int
    chapter_id: int
    point_type: str
    text: str
    intensity: float
    position: int
    context: Optional[str] = None


class CoolPointCreate(BaseSchema):
    text: str = Field(..., min_length=1)
    point_type: str = Field(default="reveal", max_length=50)
    intensity: float = Field(default=0.5, ge=0.0, le=1.0)
    position: int = Field(default=0, ge=0)
    context: Optional[str] = None


class CoolPointList(BaseSchema):
    chapter_id: int
    points: list[CoolPointOut]
    total: int


# ---------------------------------------------------------------------------
# Fulfillment
# ---------------------------------------------------------------------------

class FulfillmentOut(BaseSchema):
    id: int
    chapter_id: int
    size: str
    text: str
    position: int
    context: Optional[str] = None


class FulfillmentList(BaseSchema):
    chapter_id: int
    fulfillments: list[FulfillmentOut]
    total: int
