"""Schemas for AI rewrite-description endpoint (US-011).

Request body:  { entityType, entityId, style }
Response data: { description: <str>, style, entityType, entityId }
"""
from __future__ import annotations

from typing import Literal

from pydantic import ConfigDict, Field

from app.schemas.base import BaseSchema


EntityType = Literal[
    "character", "item", "location", "faction", "world_setting", "rule"
]

Style = Literal[
    "concise", "literary", "classical", "humorous", "mysterious"
]


class RewriteDescriptionRequest(BaseSchema):
    """Request body for POST /api/v1/ai/rewrite-description."""

    model_config = ConfigDict(populate_by_name=True)

    entity_type: EntityType = Field(alias="entityType")
    entity_id: int = Field(alias="entityId")
    style: Style


class RewriteDescriptionResponse(BaseSchema):
    description: str
    style: str
    entityType: str
    entityId: int
