"""Schemas for the outline generation endpoint (US-012)."""
from __future__ import annotations

from typing import Any

from pydantic import ConfigDict, Field

from app.schemas.base import BaseSchema


class GenerateOutlineRequest(BaseSchema):
    """Request body for POST /api/v1/chapters/outlines/generate."""

    model_config = ConfigDict(populate_by_name=True)

    project_id: int = Field(alias="projectId")
    chapter_count: int = Field(ge=1, le=50, alias="chapterCount")
    settings_snapshot: dict[str, Any] | None = Field(
        default=None,
        alias="settingsSnapshot",
    )


class GenerateOutlineChapter(BaseSchema):
    id: int
    title: str
    summary: str


class GenerateOutlineResponse(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    outline_id: int = Field(alias="outlineId")
    chapters: list[GenerateOutlineChapter]
