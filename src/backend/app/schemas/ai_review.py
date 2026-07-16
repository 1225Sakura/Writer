"""Schemas for AI review-consistency endpoint (US-009).

Request body:  { projectId, targetTypes? }
Response data: { issues: [{severity, location, description}], suggestions: [str] }
"""
from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict, Field

from app.schemas.base import BaseSchema


EntityTypeForReview = Literal[
    "character", "item", "location", "faction", "world_setting", "rule"
]
Severity = Literal["low", "medium", "high", "critical"]


class ReviewConsistencyRequest(BaseSchema):
    """Request body for POST /api/v1/ai/review-consistency."""

    model_config = ConfigDict(populate_by_name=True)

    project_id: int = Field(alias="projectId")
    target_types: list[EntityTypeForReview] | None = Field(
        default=None, alias="targetTypes"
    )


class ConsistencyIssue(BaseSchema):
    severity: Severity
    location: str
    description: str


class ReviewConsistencyResponse(BaseSchema):
    issues: list[ConsistencyIssue] = []
    suggestions: list[str] = []
