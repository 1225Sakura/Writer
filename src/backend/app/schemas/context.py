"""Context / RAG schemas (Phase 1 Track B.1).

Aligned with frontend `src/frontend/src/api/context.ts`:
- ContextChunkOut / ContextChunkList
- IndexRequest / IndexResponse
- ContextStatsOut
- WeightsResponse / WeightsUpdate
"""
from __future__ import annotations

from typing import Optional

from pydantic import Field

from app.schemas.base import BaseSchema


# ---------------------------------------------------------------------------
# Chunks
# ---------------------------------------------------------------------------

class ContextChunkOut(BaseSchema):
    """Indexed text chunk for RAG retrieval."""

    chunk_id: str
    chapter_id: int
    scene_index: int
    content: str
    chunk_type: str = "text"
    parent_chunk_id: Optional[str] = None
    source_file: Optional[str] = None


class ContextChunkList(BaseSchema):
    """List of chunks for a chapter."""

    chapter_id: int
    chunks: list[ContextChunkOut]
    total: int


# ---------------------------------------------------------------------------
# Indexing
# ---------------------------------------------------------------------------

class IndexRequest(BaseSchema):
    """Request body for POST /context/{chapter_id}/index."""

    content: str = Field(..., min_length=1, description="Chapter text to chunk + index")
    summary: Optional[str] = None
    max_chunk_size: int = Field(default=500, ge=50, le=5000)
    overlap: int = Field(default=50, ge=0, le=500)


class IndexResponse(BaseSchema):
    """Response for POST /context/{chapter_id}/index."""

    chapter_id: int
    stored: int
    total_chunks: int
    degraded: bool = False
    degraded_reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------

class ContextStatsOut(BaseSchema):
    """Per-chapter RAG index statistics."""

    chapter_id: int
    vectors: int
    terms: int
    max_scene_index: int


# ---------------------------------------------------------------------------
# Weights
# ---------------------------------------------------------------------------

class WeightsResponse(BaseSchema):
    """GET /context/weights response."""

    weights: dict[str, float]


class WeightsUpdate(BaseSchema):
    """PUT /context/weights body."""

    weights: dict[str, float] = Field(..., description="Keyed retrieval weights")
