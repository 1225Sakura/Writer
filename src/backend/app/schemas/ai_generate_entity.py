"""Schemas for AI generate-entity endpoint (US-008).

The single-entity generator takes a {type, hint, projectId} body and returns
an entity dict that conforms to the matching Create schema (minus project_id,
which is supplied separately at persistence time).
"""
from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict, Field

from app.schemas.base import BaseSchema


EntityType = Literal["character", "item", "location", "faction", "world_setting", "rule"]


class GenerateEntityRequest(BaseSchema):
    """Request body for POST /api/v1/ai/generate-entity."""

    model_config = ConfigDict(populate_by_name=True)

    type: EntityType
    hint: str = ""
    project_id: int = Field(alias="projectId")