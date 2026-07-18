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
    model_config = ConfigDict(populate_by_name=True)

    id: int
    title: str
    summary: str
    sections: list[str] | None = None
    pacing_notes: str | None = Field(default=None, alias="pacingNotes")
    character_dynamics: str | None = Field(default=None, alias="characterDynamics")
    foreshadowing: str | None = None


class GenerateOutlineResponse(BaseSchema):
    model_config = ConfigDict(populate_by_name=True)

    outline_id: int = Field(alias="outlineId")
    chapters: list[GenerateOutlineChapter]
