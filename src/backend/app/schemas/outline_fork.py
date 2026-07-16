"""Schemas for outline fork endpoint (US-015).

Forking an outline produces a new IFLine + a new Outline that shares
chapters with the source. Optional fork_chapter_id marks the divergence
point — chapters at or before that order are flagged as "common".
"""
from __future__ import annotations

from app.schemas.base import BaseSchema


class ForkOutlineRequest(BaseSchema):
    name: str
    project_id: int
    fork_chapter_id: int | None = None


class ForkOutlineResponse(BaseSchema):
    if_line_id: int
    forked_outline_id: int
    common_chapters: list[int]
