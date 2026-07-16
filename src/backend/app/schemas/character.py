"""Character schemas — matches frontend types exactly."""
from __future__ import annotations

from app.schemas.base import BaseSchema, TimestampSchema


class CharacterBase(BaseSchema):
    name: str
    gender: str | None = None
    personality: str | None = None
    desires: str | None = None
    flaws: str | None = None
    description: str | None = None
    tier: str = "supporting"
    cultivation_realm: str | None = None


class CharacterCreate(CharacterBase):
    project_id: int


class CharacterUpdate(BaseSchema):
    name: str | None = None
    gender: str | None = None
    personality: str | None = None
    desires: str | None = None
    flaws: str | None = None
    description: str | None = None
    tier: str | None = None
    cultivation_realm: str | None = None


class CharacterOut(CharacterBase, TimestampSchema):
    id: int
    project_id: int


class CharacterRelationshipBase(BaseSchema):
    character_id: int
    target_id: int
    type: str
    description: str | None = None


class CharacterRelationshipOut(CharacterRelationshipBase, TimestampSchema):
    id: int
    project_id: int


class CharacterStorylineBase(BaseSchema):
    character_id: int
    title: str
    arc: str | None = None
    progress: float = 0.0


class CharacterStorylineOut(CharacterStorylineBase, TimestampSchema):
    id: int
    project_id: int
