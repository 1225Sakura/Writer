"""Context / RAG routes (v0.5 Phase 1 Track B.1).

6 endpoints (all X-API-Key + verify_api_key):
1. GET    /api/v1/context/{chapter_id}/chunks   — list chunks for chapter
2. POST   /api/v1/context/{chapter_id}/index    — index chapter content
3. DELETE /api/v1/context/{chapter_id}/chunks   — delete all chunks for chapter
4. GET    /api/v1/context/{chapter_id}/stats    — per-chapter RAG stats
5. GET    /api/v1/context/weights               — global retrieval weights
6. PUT    /api/v1/context/weights               — update global retrieval weights

Indexing strategy: simple sliding-window chunker (no real vector embeddings).
Real embedding would require an external service; for Phase 1 we store content
verbatim and let downstream code (Phase 1 Track B / future) plug in the
vector backend.
"""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.core.security import verify_api_key
from app.database import get_db
from app.repositories.context import ContextRepository
from app.schemas.context import (
    ContextChunkList,
    ContextChunkOut,
    ContextStatsOut,
    IndexRequest,
    IndexResponse,
    WeightsResponse,
    WeightsUpdate,
)
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/context", tags=["Context"], dependencies=[Depends(verify_api_key)])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _chunk_text(text: str, max_size: int = 500, overlap: int = 50) -> list[dict]:
    """Simple sliding-window chunker.

    Returns a list of `{content, scene_index}` dicts.
    - max_size: maximum characters per chunk (50-5000)
    - overlap: characters shared between consecutive chunks (0-500)
    """
    if max_size <= 0:
        raise ValueError("max_size must be > 0")
    if overlap < 0 or overlap >= max_size:
        raise ValueError("overlap must be 0 <= overlap < max_size")

    chunks: list[dict] = []
    if not text:
        return chunks

    start = 0
    idx = 0
    n = len(text)
    while start < n:
        end = min(start + max_size, n)
        content = text[start:end]
        chunks.append({"content": content, "scene_index": idx})
        idx += 1
        if end == n:
            break
        start = end - overlap
    return chunks


# ---------------------------------------------------------------------------
# Endpoint 1: GET /context/{chapter_id}/chunks
# ---------------------------------------------------------------------------

@router.get("/{chapter_id}/chunks")
def list_chunks(
    chapter_id: int = Path(..., ge=1),
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """List indexed chunks for a chapter."""
    repo = ContextRepository(db)
    rows = repo.list_chunks(chapter_id=chapter_id, skip=skip, limit=limit)
    total = repo.count_chunks(chapter_id=chapter_id)
    chunks = [
        ContextChunkOut(
            chunk_id=r.chunk_id,
            chapter_id=r.chapter_id,
            scene_index=r.scene_index,
            content=r.content,
            chunk_type=r.chunk_type,
            parent_chunk_id=r.parent_chunk_id,
            source_file=r.source_file,
        )
        for r in rows
    ]
    payload = ContextChunkList(
        chapter_id=chapter_id, chunks=chunks, total=total
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 2: POST /context/{chapter_id}/index
# ---------------------------------------------------------------------------

@router.post("/{chapter_id}/index")
def index_chapter(
    body: IndexRequest,
    chapter_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Index chapter content into RAG store.

    Strategy: delete existing chunks for the chapter, then insert new chunks
    produced by sliding-window chunker. Stats are recomputed after insertion.
    """
    repo = ContextRepository(db)
    # 1. Delete old chunks for this chapter
    deleted = repo.delete_chunks_by_chapter(chapter_id)
    # 2. Chunk the new content
    try:
        chunk_specs = _chunk_text(
            body.content, max_size=body.max_chunk_size, overlap=body.overlap
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    # 3. Insert chunks
    new_chunks = repo.create_chunks_bulk(chapter_id=chapter_id, chunks=chunk_specs)
    # 4. Recompute stats
    stats = repo.recompute_stats(chapter_id)

    logger.info(
        "index_chapter chapter_id=%s deleted=%s stored=%s",
        chapter_id, deleted, len(new_chunks),
    )

    payload = IndexResponse(
        chapter_id=chapter_id,
        stored=len(new_chunks),
        total_chunks=stats.vectors,
        degraded=False,
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 3: DELETE /context/{chapter_id}/chunks
# ---------------------------------------------------------------------------

@router.delete("/{chapter_id}/chunks", status_code=status.HTTP_204_NO_CONTENT)
def delete_chunks(
    chapter_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> None:
    """Delete all chunks for a chapter (idempotent)."""
    repo = ContextRepository(db)
    deleted = repo.delete_chunks_by_chapter(chapter_id)
    # Reset stats row if present
    stats = repo.get_stats(chapter_id)
    if stats:
        stats.vectors = 0
        stats.terms = 0
        stats.max_scene_index = 0
        db.commit()
    logger.info("delete_chunks chapter_id=%s deleted=%s", chapter_id, deleted)


# ---------------------------------------------------------------------------
# Endpoint 4: GET /context/{chapter_id}/stats
# ---------------------------------------------------------------------------

@router.get("/{chapter_id}/stats")
def get_stats(
    chapter_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Return per-chapter RAG index statistics.

    If no stats row exists yet, recompute from chunks (auto-init).
    """
    repo = ContextRepository(db)
    stats = repo.get_stats(chapter_id)
    if stats is None:
        # Auto-initialize from current chunks
        stats = repo.recompute_stats(chapter_id)
    payload = ContextStatsOut(
        chapter_id=chapter_id,
        vectors=stats.vectors,
        terms=stats.terms,
        max_scene_index=stats.max_scene_index,
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 5: GET /context/weights
# ---------------------------------------------------------------------------

@router.get("/weights")
def get_weights(db: Session = Depends(get_db)) -> ApiResponse[dict]:
    """Return global RAG retrieval weights.

    Returns default weights if none configured yet:
    {"character": 0.4, "location": 0.3, "item": 0.2, "faction": 0.1}
    """
    repo = ContextRepository(db)
    row = repo.get_weights()
    if row is None:
        # Auto-init with defaults
        defaults = {
            "character": 0.4,
            "location": 0.3,
            "item": 0.2,
            "faction": 0.1,
        }
        row = repo.upsert_weights(defaults)
    payload = WeightsResponse(weights=row.weights or {})
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 6: PUT /context/weights
# ---------------------------------------------------------------------------

@router.put("/weights")
def update_weights(
    body: WeightsUpdate,
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Update global RAG retrieval weights."""
    repo = ContextRepository(db)
    # Validate weights are floats in [0, 1]
    for k, v in body.weights.items():
        if not isinstance(v, (int, float)):
            raise HTTPException(
                status_code=422,
                detail=f"weight {k!r} must be numeric, got {type(v).__name__}",
            )
        if v < 0 or v > 1:
            raise HTTPException(
                status_code=422,
                detail=f"weight {k!r}={v} out of range [0, 1]",
            )
    row = repo.upsert_weights(body.weights)
    return ApiResponse(data=WeightsResponse(weights=row.weights).model_dump())
