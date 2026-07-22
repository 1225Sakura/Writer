"""Context / RAG index models (Phase 1 Track B.1).

Three tables:
- context_chunks: indexed text chunks per chapter (used by RAG queries)
- context_stats: per-chapter RAG index statistics
- context_weights: global weights config (entity_types, recency, etc.)
"""
from __future__ import annotations

from sqlalchemy import String, Text, ForeignKey, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import BaseModel


class ContextChunk(BaseModel):
    """Indexed text chunk for RAG retrieval.

    `chunk_id` is a UUID4 string (frontend-friendly identifier).
    `scene_index` orders chunks within a chapter (0-based).
    `chunk_type` discriminates chunk kinds (dialogue, action, description).
    `parent_chunk_id` enables hierarchical chunking (large → smaller).
    """

    __tablename__ = "context_chunks"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    chunk_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapters.id", ondelete="CASCADE"), index=True
    )
    scene_index: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str] = mapped_column(Text)
    chunk_type: Mapped[str] = mapped_column(String(50), default="text")
    parent_chunk_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    source_file: Mapped[str | None] = mapped_column(String(255), nullable=True)
    embedding: Mapped[list | None] = mapped_column(JSON, nullable=True)


class ContextStats(BaseModel):
    """Per-chapter RAG index statistics."""

    __tablename__ = "context_stats"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapters.id", ondelete="CASCADE"), unique=True, index=True
    )
    vectors: Mapped[int] = mapped_column(Integer, default=0)
    terms: Mapped[int] = mapped_column(Integer, default=0)
    max_scene_index: Mapped[int] = mapped_column(Integer, default=0)


class ContextWeights(BaseModel):
    """Global RAG retrieval weights (single-row table; id=1).

    `weights` is a JSON dict of float weights keyed by retrieval dimension
    (e.g., {"character": 0.4, "location": 0.3, "recency": 0.3}).
    """

    __tablename__ = "context_weights"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    weights: Mapped[dict] = mapped_column(JSON, default=dict)
