"""Project schemas — matches frontend types exactly."""
from __future__ import annotations

from app.schemas.base import BaseSchema, TimestampSchema


class ProjectBase(BaseSchema):
    name: str = "我的小说"
    description: str | None = None
    genre: str | None = None


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseSchema):
    name: str | None = None
    description: str | None = None
    genre: str | None = None


class ProjectOut(ProjectBase, TimestampSchema):
    id: int
