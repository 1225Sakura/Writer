"""Chapter and Outline schemas."""
from __future__ import annotations

from app.schemas.base import BaseSchema, TimestampSchema


class OutlineBase(BaseSchema):
    title: str = "未命名大纲"
    description: str | None = None


class OutlineCreate(OutlineBase):
    project_id: int | None = None


class OutlineUpdate(BaseSchema):
    title: str | None = None
    description: str | None = None


class OutlineOut(OutlineBase, TimestampSchema):
    id: int
    project_id: int


class ChapterBase(BaseSchema):
    outline_id: int | None = None
    title: str | None = "未命名章节"
    summary: str | None = None
    status: str = "planning"
    word_count: int = 0
    chapter_order: int = 0
    content: str | None = None
    notes: str | None = None
    note_category: str | None = None
    note_pinned: bool = False
    battle_station_data: str | None = None


class ChapterCreate(ChapterBase):
    project_id: int | None = None


class ChapterUpdate(BaseSchema):
    outline_id: int | None = None
    title: str | None = None
    summary: str | None = None
    status: str | None = None
    word_count: int | None = None
    chapter_order: int | None = None
    content: str | None = None
    notes: str | None = None
    note_category: str | None = None
    note_pinned: bool | None = None
    battle_station_data: str | None = None


class ChapterOut(ChapterBase, TimestampSchema):
    id: int
    project_id: int
