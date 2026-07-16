"""Schemas for AI fill-fields endpoint (US-010).

Request body:  { entityType, entityId, emptyFields }
Response data: { filled: { field_name: value, ... } }
"""
from __future__ import annotations

from typing import Any, Literal

from pydantic import ConfigDict, Field

from app.schemas.base import BaseSchema


EntityType = Literal[
    "character", "item", "location", "faction", "world_setting", "rule"
]


class FillFieldsRequest(BaseSchema):
    """Request body for POST /api/v1/ai/fill-fields."""

    model_config = ConfigDict(populate_by_name=True)

    entity_type: EntityType = Field(alias="entityType")
    entity_id: int = Field(alias="entityId")
    empty_fields: list[str] = Field(default_factory=list, alias="emptyFields")


class FillFieldsResponse(BaseSchema):
    filled: dict[str, Any] = {}
