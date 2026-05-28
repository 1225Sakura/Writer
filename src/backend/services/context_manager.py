"""ContextManager - assemble context packs with weighted priorities.

Manages chapter context collection, chunking, and indexing for the RAG system.
Uses existing database tables (Chapter, PlotThread, Character, etc.) + JSON fields.
Vector/index data is stored in a local SQLite file under data/rag/.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import sqlite3
import struct
from collections import Counter
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from backend.config import settings
from backend.services.context_layers import LayerAssembler, LayeredContextPack, LayerType
from backend.services.temporal_kg import TemporalKG, SVOQuad
from backend.services.entity_registry import EntityRegistry

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config defaults
# ---------------------------------------------------------------------------

DEFAULT_RAG_CONFIG = {
    "context_recent_summaries_window": 3,
    "context_recent_meta_window": 3,
    "context_max_appearing_characters": 10,
    "context_extra_section_budget": 0,
    "context_alerts_slice": 5,
    "context_compact_text_enabled": True,
    "context_compact_min_budget": 120,
    "context_compact_head_ratio": 0.65,
    "context_ranker_enabled": True,
    "vector_top_k": 10,
    "bm25_top_k": 10,
    "rerank_top_n": 5,
    "rrf_k": 60,
    "vector_full_scan_max_vectors": 5000,
    "vector_prefilter_bm25_candidates": 200,
    "vector_prefilter_recent_candidates": 200,
    "graph_rag_enabled": True,
    "graph_rag_max_expanded_entities": 20,
    "graph_rag_expand_hops": 2,
    "graph_rag_candidate_limit": 100,
    "graph_rag_boost_same_entity": 0.15,
    "graph_rag_boost_related_entity": 0.08,
    "graph_rag_boost_recency": 0.05,
}

# ---------------------------------------------------------------------------
# Chunk dataclass
# ---------------------------------------------------------------------------


@dataclass
class TextChunk:
    """A text chunk for indexing and retrieval."""

    chunk_id: str
    chapter_id: int
    scene_index: int
    content: str
    chunk_type: str = "scene"  # "scene" | "summary" | "character" | "plot" | "setting"
    parent_chunk_id: Optional[str] = None
    source_file: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# ContextManager
# ---------------------------------------------------------------------------


class ContextManager:
    """Manages chapter context collection, chunking, and indexing.

    Responsibilities:
    - Build context packs from existing database entities
    - Chunk chapter content for RAG indexing
    - Manage the local vector/BM25 index store
    """

    SECTION_ORDER = [
        "core",
        "scene",
        "global",
        "reader_signal",
        "genre_profile",
        "writing_guidance",
        "story_skeleton",
        "memory",
        "preferences",
        "alerts",
    ]

    EXTRA_SECTIONS = {
        "story_skeleton",
        "memory",
        "preferences",
        "alerts",
        "reader_signal",
        "genre_profile",
        "writing_guidance",
    }

    def __init__(self, config: Optional[Dict[str, Any]] = None) -> None:
        self.config = {**DEFAULT_RAG_CONFIG, **(config or {})}
        self._rag_db_path = self._resolve_rag_db_path()
        self._ensure_dirs()
        self._init_db()
        self._layer_assembler = LayerAssembler()

    # ------------------------------------------------------------------
    # Paths & DB init
    # ------------------------------------------------------------------

    def _resolve_rag_db_path(self) -> Path:
        base = Path(settings.database_url.replace("sqlite+aiosqlite:///", "")).parent
        return base / "rag" / "vectors.db"

    def _ensure_dirs(self) -> None:
        self._rag_db_path.parent.mkdir(parents=True, exist_ok=True)

    @contextmanager
    def _get_conn(self):
        import sqlite3

        conn = sqlite3.connect(str(self._rag_db_path))
        try:
            yield conn
        finally:
            conn.close()

    def _init_db(self) -> None:
        with self._get_conn() as conn:
            cursor = conn.cursor()
            self._ensure_tables(cursor)
            conn.commit()

    def _ensure_tables(self, cursor) -> None:
        # Vector storage table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vectors (
                chunk_id TEXT PRIMARY KEY,
                chapter_id INTEGER,
                scene_index INTEGER,
                content TEXT,
                embedding BLOB,
                parent_chunk_id TEXT,
                chunk_type TEXT DEFAULT 'scene',
                source_file TEXT,
                metadata_json TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # BM25 inverted index
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bm25_index (
                term TEXT,
                chunk_id TEXT,
                tf REAL,
                PRIMARY KEY (term, chunk_id)
            )
        """)
        # Document stats for BM25
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS doc_stats (
                chunk_id TEXT PRIMARY KEY,
                doc_length INTEGER
            )
        """)
        # Query log
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS query_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                query TEXT,
                query_type TEXT,
                results_count INTEGER,
                hit_sources TEXT,
                latency_ms INTEGER,
                chapter_id INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)
        # Indexes
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_vectors_chapter ON vectors(chapter_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_vectors_parent ON vectors(parent_chunk_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_vectors_type ON vectors(chunk_type)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_bm25_term ON bm25_index(term)")

    # ------------------------------------------------------------------
    # Chunking
    # ------------------------------------------------------------------

    def chunk_chapter_content(
        self,
        chapter_id: int,
        content: str,
        summary: Optional[str] = None,
        max_chunk_size: int = 800,
        overlap: int = 100,
    ) -> List[TextChunk]:
        """Split chapter content into overlapping text chunks.

        Args:
            chapter_id: The chapter ID
            content: Full chapter text
            summary: Optional chapter summary (stored as parent chunk)
            max_chunk_size: Maximum characters per chunk
            overlap: Overlap characters between chunks

        Returns:
            List of TextChunk objects ready for indexing
        """
        chunks: List[TextChunk] = []
        parent_id: Optional[str] = None

        # Summary chunk first
        if summary:
            parent_id = f"ch{chapter_id:04d}_summary"
            chunks.append(
                TextChunk(
                    chunk_id=parent_id,
                    chapter_id=chapter_id,
                    scene_index=0,
                    content=summary,
                    chunk_type="summary",
                    source_file=f"chapters/{chapter_id}",
                )
            )

        # Scene detection: split by common scene separators
        scenes = self._split_into_scenes(content)
        for idx, scene_text in enumerate(scenes, start=1):
            scene_chunks = self._chunk_text(scene_text, max_chunk_size, overlap)
            for cidx, ctext in enumerate(scene_chunks, start=1):
                chunk_id = f"ch{chapter_id:04d}_s{idx}_c{cidx}"
                chunks.append(
                    TextChunk(
                        chunk_id=chunk_id,
                        chapter_id=chapter_id,
                        scene_index=idx,
                        content=ctext,
                        chunk_type="scene",
                        parent_chunk_id=parent_id,
                        source_file=f"chapters/{chapter_id}#scene_{idx}",
                    )
                )

        return chunks

    def _split_into_scenes(self, content: str) -> List[str]:
        """Split content into scenes using common separators."""
        # Split by blank lines (paragraph groups) or explicit scene markers
        scenes = re.split(r"\n\s*\n", content.strip())
        # Merge very short segments with neighbors
        merged: List[str] = []
        for s in scenes:
            s = s.strip()
            if not s:
                continue
            if merged and len(merged[-1]) < 200:
                merged[-1] = merged[-1] + "\n\n" + s
            else:
                merged.append(s)
        return merged if merged else [content]

    def _chunk_text(self, text: str, max_size: int, overlap: int) -> List[str]:
        """Split text into overlapping chunks."""
        if len(text) <= max_size:
            return [text]
        chunks: List[str] = []
        start = 0
        while start < len(text):
            end = start + max_size
            # Try to break at sentence boundary
            if end < len(text):
                for delim in "。！？\n":
                    pos = text.rfind(delim, start, end)
                    if pos > start + max_size // 2:
                        end = pos + 1
                        break
            chunks.append(text[start:end])
            start = end - overlap
        return chunks

    # ------------------------------------------------------------------
    # Context pack building (from DB entities)
    # ------------------------------------------------------------------

    async def build_context_pack(
        self,
        chapter_id: int,
        db_session: Any,
        max_chars: int = 8000,
        temporal_kg: Optional[TemporalKG] = None,
        entity_registry: Optional[EntityRegistry] = None,
    ) -> Dict[str, Any]:
        """Build a context pack for a chapter from existing DB entities.

        Uses Chapter, PlotThread, Character, DraftVersion, etc.
        """
        from sqlalchemy import select
        from backend.core.domain import (
            Chapter, DraftVersion, PlotThread, Character,
            CharacterRelationship, WorldSetting, Rule
        )

        # Load chapter
        result = await db_session.execute(
            select(Chapter).where(Chapter.id == chapter_id)
        )
        chapter = result.scalar_one_or_none()
        if not chapter:
            raise ValueError(f"Chapter {chapter_id} not found")

        # Load latest draft
        result = await db_session.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .order_by(DraftVersion.version_number.desc())
            .limit(1)
        )
        latest_draft = result.scalar_one_or_none()

        # Load recent chapters for summaries
        window = self.config["context_recent_summaries_window"]
        result = await db_session.execute(
            select(Chapter)
            .where(Chapter.chapter_order < chapter.chapter_order)
            .where(Chapter.summary.isnot(None))
            .order_by(Chapter.chapter_order.desc())
            .limit(window)
        )
        recent_chapters = result.scalars().all()

        # Load active plot threads
        result = await db_session.execute(
            select(PlotThread)
            .where(PlotThread.status == "active")
            .order_by(PlotThread.created_at.desc())
            .limit(20)
        )
        active_plots = result.scalars().all()

        # Load characters
        result = await db_session.execute(
            select(Character)
            .order_by(Character.id)
            .limit(self.config["context_max_appearing_characters"])
        )
        characters = result.scalars().all()

        # Load world settings
        result = await db_session.execute(
            select(WorldSetting).order_by(WorldSetting.id).limit(10)
        )
        world_settings = result.scalars().all()

        # Load rules
        result = await db_session.execute(
            select(Rule).order_by(Rule.id).limit(10)
        )
        rules = result.scalars().all()

        # Assemble pack
        core = {
            "chapter_title": chapter.title,
            "chapter_summary": chapter.summary,
            "chapter_order": chapter.chapter_order,
            "word_count": chapter.word_count,
            "status": chapter.status,
            "latest_draft_preview": (
                latest_draft.content[:500] + "..."
                if latest_draft and latest_draft.content
                else None
            ),
        }

        scene = {
            "appearing_characters": [
                {"id": c.id, "name": c.name, "tier": c.tier, "realm": c.cultivation_realm}
                for c in characters
            ],
        }

        global_ctx = {
            "world_settings": [
                {"id": s.id, "name": s.name, "description": s.description}
                for s in world_settings
            ],
            "rules": [
                {"id": r.id, "name": r.name, "description": r.description}
                for r in rules
            ],
        }

        recent_summaries = [
            {
                "chapter_id": rc.id,
                "title": rc.title,
                "summary": rc.summary,
            }
            for rc in reversed(list(recent_chapters))
        ]

        plot_threads = [
            {
                "id": p.id,
                "title": p.title,
                "description": p.description,
                "status": p.status,
            }
            for p in active_plots
        ]

        # NEW: Enrich with temporal KG quads
        kg_context: Dict[str, Any] = {}
        if temporal_kg:
            recent_quads = await temporal_kg.query_by_chapter_range(
                max(1, chapter.chapter_order - 10), chapter.chapter_order
            )
            kg_context = self._format_kg_context(recent_quads, chapter.chapter_order)

        pack = {
            "meta": {"chapter_id": chapter_id, "chapter_order": chapter.chapter_order},
            "core": core,
            "scene": scene,
            "global": global_ctx,
            "recent_summaries": recent_summaries,
            "plot_threads": plot_threads,
            "kg_context": kg_context,
        }

        # Use LayerAssembler for 4-layer assembly
        layered = self._layer_assembler.assemble(pack, chapter.chapter_order, max_chars)
        pack["_layered"] = {
            "layers": {lt.value: content for lt, content in layered.layers.items()},
            "meta": layered.meta,
            "weights_applied": {lt.value: w for lt, w in layered.weights_applied.items()},
        }

        return pack

    def assemble_context(
        self,
        pack: Dict[str, Any],
        max_chars: int = 8000,
    ) -> Dict[str, Any]:
        """Assemble a context pack into a structured response with budgets.

        If the pack contains a ``_layered`` key, uses 4-layer assembly.
        Otherwise falls back to the flat assembly for backward compatibility.
        """
        if "_layered" in pack:
            return self._assemble_layered(pack["_layered"], max_chars)
        return self._assemble_flat(pack, max_chars)

    def _assemble_flat(
        self,
        pack: Dict[str, Any],
        max_chars: int = 8000,
    ) -> Dict[str, Any]:
        """Existing flat assembly logic (backward compatible)."""
        weights = self._resolve_weights()
        sections: Dict[str, Any] = {}

        for name in self.SECTION_ORDER:
            if name in pack:
                sections[name] = pack[name]
        if "recent_summaries" in pack:
            sections.setdefault("core", {})["recent_summaries"] = pack["recent_summaries"]
        if "plot_threads" in pack:
            sections.setdefault("core", {})["plot_threads"] = pack["plot_threads"]

        assembled: Dict[str, Any] = {"meta": pack.get("meta", {}), "sections": {}}
        for name, content in sections.items():
            weight = weights.get(name, 0.0)
            if weight > 0:
                budget = int(max_chars * weight)
            elif name in self.EXTRA_SECTIONS:
                budget = int(max_chars * 0.05)
            else:
                budget = None
            text = self._compact_json_text(content, budget)
            assembled["sections"][name] = {"content": content, "text": text, "budget": budget}

        assembled["weights"] = weights
        return assembled

    def _assemble_layered(
        self,
        layered: Dict[str, Any],
        max_chars: int,
    ) -> Dict[str, Any]:
        """Assemble using 4-layer architecture with decay weights."""
        assembled: Dict[str, Any] = {
            "meta": layered.get("meta", {}),
            "sections": {},
        }
        weights = layered.get("weights_applied", {})
        for layer_name, content in layered.get("layers", {}).items():
            weight = weights.get(layer_name, 0.25)
            for section_name, section_data in content.items():
                budget = int(max_chars * weight) if weight > 0 else int(max_chars * 0.05)
                text = self._compact_json_text(section_data, budget)
                assembled["sections"][section_name] = {
                    "content": section_data,
                    "text": text,
                    "budget": budget,
                    "layer": layer_name,
                }
        assembled["layered"] = True
        assembled["weights"] = weights
        return assembled

    def _format_kg_context(
        self,
        quads: List[SVOQuad],
        current_chapter_order: int,
    ) -> Dict[str, Any]:
        """Format SVO quads into context pack section."""
        if not quads:
            return {}
        grouped: Dict[str, List[Dict[str, Any]]] = {}
        for quad in quads:
            key = f"ch{quad.chapter_order}"
            grouped.setdefault(key, []).append({
                "subject": quad.subject,
                "verb": quad.verb,
                "object": quad.object,
                "confidence": quad.confidence,
            })
        return {
            "recent_events": grouped,
            "total_quads": len(quads),
            "chapter_range": f"{quads[0].chapter_order}-{quads[-1].chapter_order}",
        }

    def _resolve_weights(self) -> Dict[str, float]:
        return {
            "core": 0.35,
            "scene": 0.20,
            "global": 0.15,
            "reader_signal": 0.05,
            "genre_profile": 0.05,
            "writing_guidance": 0.05,
            "story_skeleton": 0.05,
            "memory": 0.05,
            "preferences": 0.03,
            "alerts": 0.02,
        }

    def _compact_json_text(self, content: Any, budget: Optional[int]) -> str:
        raw = json.dumps(content, ensure_ascii=False)
        if budget is None or len(raw) <= budget:
            return raw
        if not self.config.get("context_compact_text_enabled", True):
            return raw[:budget]
        min_budget = max(1, self.config.get("context_compact_min_budget", 120))
        if budget <= min_budget:
            return raw[:budget]
        head_ratio = float(self.config.get("context_compact_head_ratio", 0.65))
        head_budget = int(budget * max(0.2, min(0.9, head_ratio)))
        tail_budget = max(0, budget - head_budget - 10)
        compact = f"{raw[:head_budget]}...[TRUNCATED]{raw[-tail_budget:] if tail_budget else ''}"
        return compact[:budget]

    # ------------------------------------------------------------------
    # Index operations
    # ------------------------------------------------------------------

    def store_chunks(
        self,
        chunks: List[TextChunk],
        embeddings: Optional[List[List[float]]] = None,
    ) -> int:
        """Store chunks with optional embeddings into the local RAG DB.

        If embeddings is None, chunks are stored without vectors (BM25 only).
        Returns the number of chunks stored.
        """
        if not chunks:
            return 0

        stored = 0
        with self._get_conn() as conn:
            cursor = conn.cursor()
            for idx, chunk in enumerate(chunks):
                emb_bytes = None
                if embeddings and idx < len(embeddings) and embeddings[idx]:
                    emb_bytes = self._serialize_embedding(embeddings[idx])

                cursor.execute("""
                    INSERT OR REPLACE INTO vectors
                    (chunk_id, chapter_id, scene_index, content, embedding,
                     parent_chunk_id, chunk_type, source_file, metadata_json)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    chunk.chunk_id,
                    chunk.chapter_id,
                    chunk.scene_index,
                    chunk.content,
                    emb_bytes,
                    chunk.parent_chunk_id,
                    chunk.chunk_type,
                    chunk.source_file,
                    json.dumps(chunk.metadata, ensure_ascii=False) if chunk.metadata else None,
                ))

                self._update_bm25_index(cursor, chunk.chunk_id, chunk.content)
                stored += 1

            conn.commit()
        return stored

    def delete_chapter_chunks(self, chapter_id: int) -> int:
        """Delete all chunks for a chapter."""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT chunk_id FROM vectors WHERE chapter_id = ?",
                (chapter_id,)
            )
            chunk_ids = [r[0] for r in cursor.fetchall()]
            for cid in chunk_ids:
                cursor.execute("DELETE FROM bm25_index WHERE chunk_id = ?", (cid,))
                cursor.execute("DELETE FROM doc_stats WHERE chunk_id = ?", (cid,))
            cursor.execute("DELETE FROM vectors WHERE chapter_id = ?", (chapter_id,))
            conn.commit()
            return len(chunk_ids)

    def get_stats(self) -> Dict[str, int]:
        """Get RAG index statistics."""
        with self._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM vectors")
            vectors = cursor.fetchone()[0]
            cursor.execute("SELECT COUNT(DISTINCT term) FROM bm25_index")
            terms = cursor.fetchone()[0]
            cursor.execute("SELECT MAX(chapter_id) FROM vectors")
            max_chapter = cursor.fetchone()[0] or 0
            return {"vectors": vectors, "terms": terms, "max_chapter": max_chapter}

    # ------------------------------------------------------------------
    # BM25 indexing
    # ------------------------------------------------------------------

    def _tokenize(self, text: str) -> List[str]:
        """Simple tokenization: Chinese chars + English words."""
        chinese = re.findall(r"[\u4e00-\u9fff]+", text)
        chinese_chars = list("".join(chinese))
        english = re.findall(r"[a-zA-Z]+", text.lower())
        return chinese_chars + english

    def _update_bm25_index(self, cursor, chunk_id: str, content: str) -> None:
        cursor.execute("DELETE FROM bm25_index WHERE chunk_id = ?", (chunk_id,))
        cursor.execute("DELETE FROM doc_stats WHERE chunk_id = ?", (chunk_id,))
        tokens = self._tokenize(content)
        doc_length = len(tokens)
        tf_counter = Counter(tokens)
        for term, count in tf_counter.items():
            tf = count / doc_length if doc_length > 0 else 0
            cursor.execute(
                "INSERT INTO bm25_index (term, chunk_id, tf) VALUES (?, ?, ?)",
                (term, chunk_id, tf),
            )
        cursor.execute(
            "INSERT INTO doc_stats (chunk_id, doc_length) VALUES (?, ?)",
            (chunk_id, doc_length),
        )

    # ------------------------------------------------------------------
    # Embedding serialization
    # ------------------------------------------------------------------

    @staticmethod
    def _serialize_embedding(embedding: List[float]) -> bytes:
        return struct.pack(f"{len(embedding)}f", *embedding)

    @staticmethod
    def _deserialize_embedding(data: bytes) -> List[float]:
        count = len(data) // 4
        return list(struct.unpack(f"{count}f", data))

    # ------------------------------------------------------------------
    # Query logging
    # ------------------------------------------------------------------

    def log_query(
        self,
        query: str,
        query_type: str,
        results_count: int,
        hit_sources: Dict[str, int],
        latency_ms: int,
        chapter_id: Optional[int] = None,
    ) -> None:
        try:
            with self._get_conn() as conn:
                cursor = conn.cursor()
                cursor.execute("""
                    INSERT INTO query_log
                    (query, query_type, results_count, hit_sources, latency_ms, chapter_id)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    query,
                    query_type,
                    results_count,
                    json.dumps(hit_sources, ensure_ascii=False),
                    latency_ms,
                    chapter_id,
                ))
                conn.commit()
        except sqlite3.OperationalError as exc:
            logger.warning("Failed to log RAG query: %s", exc)
