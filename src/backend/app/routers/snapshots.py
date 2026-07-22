"""Snapshots routes (v0.5 Phase 1 Track B.5).

14 endpoints (all X-API-Key + verify_api_key):
1.  GET    /snapshots                                — list all (optional chapter filter)
2.  POST   /snapshots                                — create snapshot
3.  GET    /snapshots/{id}                           — read snapshot
4.  PUT    /snapshots/{id}                           — update label
5.  DELETE /snapshots/{id}                           — delete snapshot
6.  POST   /snapshots/{id}/revert                    — revert chapter to snapshot
7.  GET    /snapshots/{id}/diff/{other_id}           — diff two snapshots
8.  POST   /snapshots/{id}/fork                      — fork snapshot
9.  GET    /snapshots/by-chapter/{chapter_id}        — list by chapter
10. POST   /snapshots/batch-delete                   — batch delete
11. GET    /snapshots/{id}/metadata                  — snapshot metadata
12. POST   /snapshots/{id}/tag                       — add tag
13. DELETE /snapshots/{id}/tag/{tag}                 — remove tag
14. GET    /snapshots/search                         — search by query string
"""
from __future__ import annotations

import difflib
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session

from app.core.security import verify_api_key
from app.database import get_db
from app.repositories.snapshots import SnapshotsRepository
from app.schemas.snapshots import (
    BatchDeleteRequest,
    BatchResult,
    DiffLine,
    DiffResponse,
    ForkRequest,
    ForkedSnapshot,
    RevertResult,
    SearchRequest,
    SnapshotCreate,
    SnapshotList,
    SnapshotMetadata,
    SnapshotOut,
    SnapshotUpdate,
    TagRequest,
    TagResult,
)
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/snapshots",
    tags=["Snapshots"],
    dependencies=[Depends(verify_api_key)],
)


def _to_out(s) -> SnapshotOut:
    return SnapshotOut(
        id=s.id,
        chapter_id=s.chapter_id,
        label=s.label,
        word_count=s.word_count,
        fingerprint=s.fingerprint,
        parent_snapshot_id=s.parent_snapshot_id,
        tags=[t.tag for t in s.tags] if s.tags else [],
        created_at=s.created_at.isoformat() if hasattr(s.created_at, "isoformat") else str(s.created_at),
    )


# ---------------------------------------------------------------------------
# 1. GET /snapshots
# ---------------------------------------------------------------------------

@router.get("")
def list_snapshots(
    chapter_id: Optional[int] = Query(default=None, ge=1),
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """List snapshots, optionally filtered by chapter_id."""
    repo = SnapshotsRepository(db)
    rows = repo.list(chapter_id=chapter_id, skip=skip, limit=limit)
    total = repo.count(chapter_id=chapter_id)
    payload = SnapshotList(
        snapshots=[_to_out(r) for r in rows],
        total=total,
        chapter_id=chapter_id,
    )
    return ApiResponse(data=payload.model_dump())


# Search endpoint MUST be defined BEFORE {snapshot_id} patterns to avoid
# path-matching conflict (FastAPI would otherwise try to interpret "search"
# as snapshot_id and fail with 422).
@router.get("/search")
def search_snapshots(
    q: str = Query(..., min_length=1, max_length=200),
    chapter_id: Optional[int] = Query(default=None, ge=1),
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Search snapshots by query string (LIKE on label + content)."""
    repo = SnapshotsRepository(db)
    rows = repo.search(q=q, chapter_id=chapter_id, limit=limit)
    payload = SnapshotList(
        snapshots=[_to_out(r) for r in rows],
        total=len(rows),
        chapter_id=chapter_id,
    )
    return ApiResponse(data=payload.model_dump())


# batch-delete also must be defined before {snapshot_id} patterns.
@router.post("/batch-delete")
def batch_delete(
    body: BatchDeleteRequest,
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Batch delete snapshots by ids."""
    repo = SnapshotsRepository(db)
    deleted = repo.batch_delete(body.ids)
    payload = BatchResult(
        requested=len(body.ids),
        deleted=deleted,
    )
    return ApiResponse(data=payload.model_dump())


# by-chapter also must be defined before {snapshot_id} patterns.
@router.get("/by-chapter/{chapter_id}")
def list_by_chapter(
    chapter_id: int = Path(..., ge=1),
    skip: int = 0,
    limit: int = Query(default=100, le=500),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """List all snapshots for a chapter."""
    repo = SnapshotsRepository(db)
    rows = repo.list(chapter_id=chapter_id, skip=skip, limit=limit)
    total = repo.count(chapter_id=chapter_id)
    payload = SnapshotList(
        snapshots=[_to_out(r) for r in rows],
        total=total,
        chapter_id=chapter_id,
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# 2. POST /snapshots
# ---------------------------------------------------------------------------

@router.post("")
def create_snapshot(
    body: SnapshotCreate,
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Create a new snapshot."""
    repo = SnapshotsRepository(db)
    s = repo.create(
        chapter_id=body.chapter_id,
        content=body.content,
        label=body.label,
        meta=body.meta,
    )
    return ApiResponse(data=_to_out(s).model_dump())


# ---------------------------------------------------------------------------
# 3. GET /snapshots/{id}
# ---------------------------------------------------------------------------

@router.get("/{snapshot_id}")
def get_snapshot(
    snapshot_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Read snapshot by id."""
    repo = SnapshotsRepository(db)
    s = repo.get(snapshot_id)
    if not s:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return ApiResponse(data=_to_out(s).model_dump())


# ---------------------------------------------------------------------------
# 4. PUT /snapshots/{id}
# ---------------------------------------------------------------------------

@router.put("/{snapshot_id}")
def update_snapshot(
    body: SnapshotUpdate,
    snapshot_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Update snapshot label."""
    repo = SnapshotsRepository(db)
    s = repo.update_label(snapshot_id, body.label)
    if not s:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return ApiResponse(data=_to_out(s).model_dump())


# ---------------------------------------------------------------------------
# 5. DELETE /snapshots/{id}
# ---------------------------------------------------------------------------

@router.delete("/{snapshot_id}")
def delete_snapshot(
    snapshot_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> None:
    """Delete snapshot by id (404 if not found)."""
    repo = SnapshotsRepository(db)
    if not repo.delete(snapshot_id):
        raise HTTPException(status_code=404, detail="Snapshot not found")


# ---------------------------------------------------------------------------
# 6. POST /snapshots/{id}/revert
# ---------------------------------------------------------------------------

@router.post("/{snapshot_id}/revert")
def revert_to_snapshot(
    snapshot_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Revert chapter content to this snapshot."""
    repo = SnapshotsRepository(db)
    result = repo.revert_chapter(snapshot_id, db)
    if not result:
        raise HTTPException(status_code=404, detail="Snapshot or chapter not found")
    payload = RevertResult(
        chapter_id=result["chapter_id"],
        snapshot_id=result["snapshot_id"],
        old_word_count=result["old_word_count"],
        new_word_count=result["new_word_count"],
        reverted_at=datetime.utcnow().isoformat(),
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# 7. GET /snapshots/{id}/diff/{other_id}
# ---------------------------------------------------------------------------

@router.get("/{snapshot_id}/diff/{other_id}")
def diff_snapshots(
    snapshot_id: int = Path(..., ge=1),
    other_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Compute diff between two snapshots using difflib.SequenceMatcher."""
    repo = SnapshotsRepository(db)
    s1 = repo.get(snapshot_id)
    s2 = repo.get(other_id)
    if not s1 or not s2:
        raise HTTPException(status_code=404, detail="Snapshot(s) not found")

    matcher = difflib.SequenceMatcher(None, s1.content, s2.content)
    similarity = matcher.ratio()
    lines: list[DiffLine] = []
    additions = 0
    deletions = 0
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        text = (s2.content[j1:j2] or s1.content[i1:i2])
        op = {"equal": "equal", "replace": "replace", "delete": "delete", "insert": "insert"}.get(tag, "equal")
        if op == "insert":
            additions += len(text.split())
        elif op == "delete":
            deletions += len(text.split())
        lines.append(DiffLine(op=op, text=text[:200]))  # truncate long lines
    payload = DiffResponse(
        snapshot_id=snapshot_id,
        other_id=other_id,
        similarity=round(similarity, 4),
        additions=additions,
        deletions=deletions,
        lines=lines,
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# 8. POST /snapshots/{id}/fork
# ---------------------------------------------------------------------------

@router.post("/{snapshot_id}/fork")
def fork_snapshot(
    body: ForkRequest,
    snapshot_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Fork snapshot (create new snapshot copying content, with parent reference)."""
    repo = SnapshotsRepository(db)
    new_snap = repo.fork(
        source_id=snapshot_id,
        label=body.label,
        target_chapter_id=body.target_chapter_id,
    )
    if not new_snap:
        raise HTTPException(status_code=404, detail="Source snapshot not found")
    payload = ForkedSnapshot(
        id=new_snap.id,
        chapter_id=new_snap.chapter_id,
        label=new_snap.label,
        parent_snapshot_id=new_snap.parent_snapshot_id,
        word_count=new_snap.word_count,
        created_at=new_snap.created_at.isoformat() if hasattr(new_snap.created_at, "isoformat") else str(new_snap.created_at),
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# 11. GET /snapshots/{id}/metadata
# ---------------------------------------------------------------------------

@router.get("/{snapshot_id}/metadata")
def get_metadata(
    snapshot_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Snapshot metadata (excludes content body for size)."""
    repo = SnapshotsRepository(db)
    s = repo.get(snapshot_id)
    if not s:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    payload = SnapshotMetadata(
        id=s.id,
        chapter_id=s.chapter_id,
        word_count=s.word_count,
        fingerprint=s.fingerprint,
        parent_snapshot_id=s.parent_snapshot_id,
        tags=[t.tag for t in s.tags] if s.tags else [],
        meta=s.meta,
        created_at=s.created_at.isoformat() if hasattr(s.created_at, "isoformat") else str(s.created_at),
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# 12. POST /snapshots/{id}/tag
# ---------------------------------------------------------------------------

@router.post("/{snapshot_id}/tag")
def add_tag(
    body: TagRequest,
    snapshot_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Add a tag to a snapshot (idempotent)."""
    repo = SnapshotsRepository(db)
    if not repo.get(snapshot_id):
        raise HTTPException(status_code=404, detail="Snapshot not found")
    tag_obj = repo.add_tag(snapshot_id, body.tag)
    payload = TagResult(snapshot_id=snapshot_id, tag=body.tag, added=True)
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# 13. DELETE /snapshots/{id}/tag/{tag}
# ---------------------------------------------------------------------------

@router.delete("/{snapshot_id}/tag/{tag}")
def remove_tag(
    snapshot_id: int = Path(..., ge=1),
    tag: str = Path(..., min_length=1, max_length=64),
    db: Session = Depends(get_db),
) -> None:
    """Remove a tag from a snapshot (idempotent)."""
    repo = SnapshotsRepository(db)
    repo.remove_tag(snapshot_id, tag)
    # 204 even if not found (idempotent)
