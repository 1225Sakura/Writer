"""Snapshot schemas (Phase 1 Track B.5)."""
from __future__ import annotations

from typing import Optional

from pydantic import Field

from app.schemas.base import BaseSchema


# ---------------------------------------------------------------------------
# Snapshot core
# ---------------------------------------------------------------------------

class SnapshotOut(BaseSchema):
    id: int
    chapter_id: int
    label: Optional[str] = None
    word_count: int
    fingerprint: str
    parent_snapshot_id: Optional[int] = None
    tags: list[str] = []
    created_at: str


class SnapshotList(BaseSchema):
    snapshots: list[SnapshotOut]
    total: int
    chapter_id: Optional[int] = None


class SnapshotCreate(BaseSchema):
    chapter_id: int = Field(..., ge=1)
    content: str = Field(..., min_length=1)
    label: Optional[str] = Field(default=None, max_length=255)
    meta: Optional[dict] = None


class SnapshotUpdate(BaseSchema):
    label: str = Field(..., min_length=1, max_length=255)


class SnapshotMetadata(BaseSchema):
    id: int
    chapter_id: int
    word_count: int
    fingerprint: str
    parent_snapshot_id: Optional[int] = None
    tags: list[str] = []
    meta: Optional[dict] = None
    created_at: str


# ---------------------------------------------------------------------------
# Revert / Diff / Fork
# ---------------------------------------------------------------------------

class RevertResult(BaseSchema):
    chapter_id: int
    snapshot_id: int
    old_word_count: int
    new_word_count: int
    reverted_at: str


class DiffLine(BaseSchema):
    op: str  # "equal" | "insert" | "delete"
    text: str


class DiffResponse(BaseSchema):
    snapshot_id: int
    other_id: int
    similarity: float
    additions: int
    deletions: int
    lines: list[DiffLine]


class ForkRequest(BaseSchema):
    label: Optional[str] = Field(default=None, max_length=255)
    target_chapter_id: Optional[int] = None


class ForkedSnapshot(BaseSchema):
    id: int
    chapter_id: int
    label: Optional[str] = None
    parent_snapshot_id: int
    word_count: int
    created_at: str


# ---------------------------------------------------------------------------
# Batch / Tags / Search
# ---------------------------------------------------------------------------

class BatchDeleteRequest(BaseSchema):
    ids: list[int] = Field(..., min_length=1, max_length=500)


class BatchResult(BaseSchema):
    requested: int
    deleted: int


class TagRequest(BaseSchema):
    tag: str = Field(..., min_length=1, max_length=64)


class TagResult(BaseSchema):
    snapshot_id: int
    tag: str
    added: bool


class SearchRequest(BaseSchema):
    q: str = Field(..., min_length=1, max_length=200)
    chapter_id: Optional[int] = None
    limit: int = Field(default=100, le=500)
