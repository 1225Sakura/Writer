"""Chapter content DTO — projection of a Chapter with its latest draft body."""
from __future__ import annotations

from app.schemas.base import BaseSchema


class ChapterContentOut(BaseSchema):
    """Read-side projection: Chapter metadata + latest draft body flattened.

    `content` is the latest draft's body (string). When no drafts exist,
    it falls back to the empty string (NOT the chapter's Tiptap `content`
    JSON field — that one is intentionally excluded from this DTO).
    """
    id: int
    title: str | None
    summary: str | None
    status: str
    word_count: int
    content: str
    created_at: str
    updated_at: str
