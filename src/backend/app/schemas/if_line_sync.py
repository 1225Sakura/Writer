"""Schemas for IF-line sync endpoint (US-017).

Syncs a base chapter into one or more IF lines, copying content to the
matching chapter in each target line and reporting any conflicts.

Naming: request body uses camelCase (frontend convention); response fields
use camelCase to match the public API surface (chapterId / newRevision /
type / message).
"""
from __future__ import annotations

from typing import Literal

from app.schemas.base import BaseSchema


ConflictType = Literal["content_mismatch", "both_modified", "missing_chapter"]


class SyncRequest(BaseSchema):
    baseChapterId: int
    targetLineIds: list[int]


class SyncedChapter(BaseSchema):
    chapterId: int
    newRevision: str  # ISO 8601 datetime string


class SyncConflict(BaseSchema):
    chapterId: int
    type: ConflictType
    message: str


class SyncResponse(BaseSchema):
    synced: list[SyncedChapter]
    conflicts: list[SyncConflict]
