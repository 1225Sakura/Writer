"""IFLine request/response schemas."""
from __future__ import annotations

from app.schemas.base import BaseSchema, TimestampSchema


class IFLineBase(BaseSchema):
    name: str
    parent_line_id: int | None = None
    fork_chapter_id: int | None = None
    content: dict | None = None


class IFLineCreate(IFLineBase):
    project_id: int


class IFLineUpdate(BaseSchema):
    name: str | None = None
    parent_line_id: int | None = None
    fork_chapter_id: int | None = None
    content: dict | None = None


class IFLineOut(IFLineBase, TimestampSchema):
    id: int
    user_id: str
    project_id: int
