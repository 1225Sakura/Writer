"""Schemas for chapter fork endpoint (US-016).

Forking a chapter produces a new chapter that:
  - Copies every field from the source chapter (incl. rich fields from US-013).
  - Is attached to the outline associated with the given IFLine
    (either IFLine.fork_chapter.outline_id, or a brand-new outline if none).
  - Returns the new chapter id, the source chapter id (parent_chapter_id) and
    the IFLine id so the caller can record the divergence.

Naming follows OutlineForkService: snake_case for response fields, camelCase
for request fields (request body comes from the frontend which uses camelCase).
"""
from __future__ import annotations

from app.schemas.base import BaseSchema


class ForkChapterRequest(BaseSchema):
    ifLineId: int
    name: str | None = None


class ForkChapterResponse(BaseSchema):
    new_chapter_id: int
    parent_chapter_id: int
    if_line_id: int