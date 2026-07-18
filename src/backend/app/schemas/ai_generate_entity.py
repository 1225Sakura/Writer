"""Schemas for AI generate-entity endpoint (US-008).

The canonical settings-editor request is ``{type, hint, projectId}``.  The
``/ai-tools`` compatibility route also accepts the concise
``{entity_type, context}`` shape used by the AI tools surface.
"""
from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict, Field

from app.schemas.base import BaseSchema


EntityType = Literal["character", "item", "location", "faction", "world_setting", "rule"]
ToolEntityType = Literal[
    "character",
    "item",
    "location",
    "faction",
    "world",
    "world_setting",
    "rule",
]


class GenerateEntityRequest(BaseSchema):
    """Request body for POST /api/v1/ai/generate-entity."""

    model_config = ConfigDict(populate_by_name=True)

    type: EntityType
    hint: str = Field(default="", max_length=4000)
    project_id: int = Field(alias="projectId")


class GenerateEntityToolRequest(BaseSchema):
    """Request body for the concise ``/api/v1/ai-tools`` route."""

    entity_type: ToolEntityType
    context: str = Field(default="", max_length=4000)