"""ContextRepository — typed SQLAlchemy data access for RAG context tables.

v0.5 Phase 1 Track B.1: Single point of DB access for context_chunks,
context_stats, context_weights. All operations use SQLAlchemy ORM (no raw SQL).
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import ContextChunk, ContextStats, ContextWeights


class ContextRepository:
    """Typed SQLAlchemy access to context tables."""

    def __init__(self, db: Session):
        self._db = db

    # ----- chunks -----

    def list_chunks(
        self, chapter_id: int, skip: int = 0, limit: int = 100
    ) -> list[ContextChunk]:
        stmt = (
            select(ContextChunk)
            .where(ContextChunk.chapter_id == chapter_id)
            .order_by(ContextChunk.scene_index.asc(), ContextChunk.id.asc())
            .offset(skip)
            .limit(limit)
        )
        return list(self._db.execute(stmt).scalars().all())

    def count_chunks(self, chapter_id: int) -> int:
        stmt = (
            select(func.count(ContextChunk.id))
            .where(ContextChunk.chapter_id == chapter_id)
        )
        return int(self._db.execute(stmt).scalar_one())

    def create_chunk(
        self,
        chapter_id: int,
        content: str,
        *,
        chunk_id: Optional[str] = None,
        scene_index: int = 0,
        chunk_type: str = "text",
        parent_chunk_id: Optional[str] = None,
        source_file: Optional[str] = None,
    ) -> ContextChunk:
        chunk = ContextChunk(
            user_id="default-user",
            chunk_id=chunk_id or str(uuid.uuid4()),
            chapter_id=chapter_id,
            scene_index=scene_index,
            content=content,
            chunk_type=chunk_type,
            parent_chunk_id=parent_chunk_id,
            source_file=source_file,
        )
        self._db.add(chunk)
        self._db.commit()
        self._db.refresh(chunk)
        return chunk

    def create_chunks_bulk(
        self,
        chapter_id: int,
        chunks: list[dict],
    ) -> list[ContextChunk]:
        """Bulk-insert chunks. Each dict needs `content`; optional fields as above."""
        rows: list[ContextChunk] = []
        for i, spec in enumerate(chunks):
            rows.append(
                ContextChunk(
                    user_id="default-user",
                    chunk_id=spec.get("chunk_id") or str(uuid.uuid4()),
                    chapter_id=chapter_id,
                    scene_index=spec.get("scene_index", i),
                    content=spec["content"],
                    chunk_type=spec.get("chunk_type", "text"),
                    parent_chunk_id=spec.get("parent_chunk_id"),
                    source_file=spec.get("source_file"),
                )
            )
        self._db.add_all(rows)
        self._db.commit()
        for r in rows:
            self._db.refresh(r)
        return rows

    def delete_chunks_by_chapter(self, chapter_id: int) -> int:
        """Delete all chunks for a chapter. Returns count deleted."""
        stmt = delete(ContextChunk).where(ContextChunk.chapter_id == chapter_id)
        result = self._db.execute(stmt)
        self._db.commit()
        return result.rowcount or 0

    # ----- stats -----

    def get_stats(self, chapter_id: int) -> Optional[ContextStats]:
        stmt = select(ContextStats).where(ContextStats.chapter_id == chapter_id)
        return self._db.execute(stmt).scalars().first()

    def upsert_stats(
        self, chapter_id: int, vectors: int, terms: int, max_scene_index: int
    ) -> ContextStats:
        existing = self.get_stats(chapter_id)
        if existing:
            existing.vectors = vectors
            existing.terms = terms
            existing.max_scene_index = max_scene_index
            self._db.commit()
            self._db.refresh(existing)
            return existing
        stats = ContextStats(
            user_id="default-user",
            chapter_id=chapter_id,
            vectors=vectors,
            terms=terms,
            max_scene_index=max_scene_index,
        )
        self._db.add(stats)
        self._db.commit()
        self._db.refresh(stats)
        return stats

    def recompute_stats(self, chapter_id: int) -> ContextStats:
        """Recompute vectors/terms/max_scene_index from current chunks."""
        chunk_count = self.count_chunks(chapter_id)
        max_scene_idx_stmt = (
            select(func.max(ContextChunk.scene_index))
            .where(ContextChunk.chapter_id == chapter_id)
        )
        max_scene_idx = int(
            self._db.execute(max_scene_idx_stmt).scalar_one() or 0
        )
        # Approx term count = sum of word counts across chunks.
        terms_stmt = (
            select(func.coalesce(func.sum(func.length(ContextChunk.content)), 0))
            .where(ContextChunk.chapter_id == chapter_id)
        )
        total_chars = int(self._db.execute(terms_stmt).scalar_one() or 0)
        terms = total_chars // 6  # rough word approximation
        return self.upsert_stats(
            chapter_id=chapter_id,
            vectors=chunk_count,
            terms=terms,
            max_scene_index=max_scene_idx,
        )

    # ----- weights -----

    def get_weights(self, user_id: str = "default-user") -> Optional[ContextWeights]:
        stmt = (
            select(ContextWeights)
            .where(ContextWeights.user_id == user_id)
            .order_by(ContextWeights.id.asc())
        )
        return self._db.execute(stmt).scalars().first()

    def upsert_weights(self, weights: dict, user_id: str = "default-user") -> ContextWeights:
        existing = self.get_weights(user_id)
        if existing:
            existing.weights = weights
            self._db.commit()
            self._db.refresh(existing)
            return existing
        row = ContextWeights(user_id=user_id, weights=weights)
        self._db.add(row)
        self._db.commit()
        self._db.refresh(row)
        return row
