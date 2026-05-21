"""Core RAG service with hybrid search (vector + FTS5 keyword) + reranking.

Provides the main RAG operations:
- add_chunks: Store text chunks with embeddings
- search: Hybrid search combining vector similarity and keyword search
- rerank: Re-rank search results using cross-attention

Uses sqlite-vec for vector storage (embedded in SQLite).
FTS5 is used for keyword search (already available in SQLite).
"""

from __future__ import annotations

import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from backend.infrastructure.database import async_session_maker
from backend.services.chunk_strategy import Chunk, ChunkStrategy, create_chunker
from backend.services.embedding_service import (
    EmbeddingService,
    get_embedding_service,
    embed_texts,
)
from backend.config import settings

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Single search result from RAG retrieval."""

    chunk_id: str
    chapter_id: int
    scene_index: int
    content: str
    score: float
    source: str  # "vector" | "bm25" | "hybrid" | "reranked"
    rank: int = 0
    parent_chunk_id: Optional[str] = None
    chunk_type: Optional[str] = None
    source_file: Optional[str] = None
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "chunk_id": self.chunk_id,
            "chapter_id": self.chapter_id,
            "scene_index": self.scene_index,
            "content": self.content,
            "score": round(self.score, 4),
            "source": self.source,
            "rank": self.rank,
            "parent_chunk_id": self.parent_chunk_id,
            "chunk_type": self.chunk_type,
            "source_file": self.source_file,
            "metadata": self.metadata,
        }


# ---------------------------------------------------------------------------
# RAG Service
# ---------------------------------------------------------------------------


class RAGService:
    """Core RAG service with hybrid search and reranking."""

    def __init__(
        self,
        embedding_service: Optional[EmbeddingService] = None,
        db_path: Optional[str] = None,
    ):
        """Initialize RAG service.

        Args:
            embedding_service: Embedding service instance (creates default if None)
            db_path: Optional path to SQLite database
        """
        self.embedding_service = embedding_service or get_embedding_service()
        self.db_path = db_path or settings.database_url.replace("sqlite+aiosqlite:///", "")
        self._conn = None
        self._fts_conn = None

    def _get_conn(self):
        """Get SQLite connection for vector operations."""
        import sqlite3
        if self._conn is None:
            db_path = self.db_path.replace("sqlite+aiosqlite:///", "")
            if not db_path:
                db_path = "data/writer.db"
            self._conn = sqlite3.connect(db_path)
        return self._conn

    def _get_fts_conn(self):
        """Get FTS5 connection for keyword search."""
        import sqlite3
        if self._fts_conn is None:
            db_path = self.db_path.replace("sqlite+aiosqlite:///", "")
            if not db_path:
                db_path = "data/writer.db"
            self._fts_conn = sqlite3.connect(db_path)
        return self._fts_conn

    # ------------------------------------------------------------------
    # Chunk management
    # ------------------------------------------------------------------

    async def add_chunks(
        self,
        chapter_id: int,
        chunks: List[Chunk],
        rebuild_fts: bool = True,
    ) -> int:
        """Add chunks to the vector store.

        Args:
            chapter_id: Chapter ID these chunks belong to
            chunks: List of Chunk objects to store
            rebuild_fts: Whether to rebuild FTS5 index after adding

        Returns:
            Number of chunks added
        """
        if not chunks:
            return 0

        start_time = time.perf_counter()
        conn = self._get_conn()
        cursor = conn.cursor()

        # Ensure tables exist
        await self._ensure_tables(cursor)

        # Generate embeddings for all chunk content
        texts = [chunk.content for chunk in chunks]
        embeddings = await self.embedding_service.embed(texts)

        # Insert chunks with embeddings
        for chunk, embedding in zip(chunks, embeddings):
            chunk_id = chunk.chunk_id or f"chunk_{uuid.uuid4().hex[:12]}"
            emb_bytes = (
                self.embedding_service.serialize_embedding(embedding)
                if embedding is not None else None
            )

            cursor.execute("""
                INSERT OR REPLACE INTO context_chunks
                (chunk_id, chapter_id, scene_index, content, chunk_type,
                 parent_chunk_id, source_file, metadata_json, embedding_blob,
                 created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            """, (
                chunk_id,
                chapter_id,
                chunk.scene_index,
                chunk.content,
                chunk.chunk_type,
                chunk.parent_chunk_id,
                chunk.source_file,
                json.dumps(chunk.metadata or {}, ensure_ascii=False),
                emb_bytes,
            ))

            # Also insert into vectors table (for backward compatibility)
            cursor.execute("""
                INSERT OR REPLACE INTO vectors
                (chunk_id, chapter_id, scene_index, content, chunk_type,
                 parent_chunk_id, source_file, embedding)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                chunk_id,
                chapter_id,
                chunk.scene_index,
                chunk.content,
                chunk.chunk_type,
                chunk.parent_chunk_id,
                chunk.source_file,
                emb_bytes,
            ))

            # Also insert into vec_items for KNN search
            try:
                import sqlite_vec
                if emb_bytes is not None:
                    cursor.execute(
                        "SELECT rowid FROM vectors WHERE chunk_id = ?", [chunk_id]
                    )
                    rowid = cursor.fetchone()[0]
                    cursor.execute(
                        "INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)",
                        [rowid, embedding.tobytes() if hasattr(embedding, 'tobytes') else emb_bytes]
                    )
            except ImportError:
                pass  # sqlite-vec not installed; skip vector insert
            except Exception as e:
                logger.debug("vec_items insert failed for chunk %s: %s", chunk_id, e)

            # Update BM25 index
            await self._update_bm25_index(cursor, chunk_id, chunk.content)

        conn.commit()

        # Rebuild FTS index
        if rebuild_fts:
            await self._rebuild_fts(cursor, chunks)

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        logger.info(
            "Added %d chunks for chapter %d in %dms",
            len(chunks), chapter_id, elapsed_ms
        )

        return len(chunks)

    async def _ensure_tables(self, cursor) -> None:
        """Ensure required tables exist."""
        # Main chunks table with embedding
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS context_chunks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                chunk_id TEXT NOT NULL UNIQUE,
                chapter_id INTEGER NOT NULL,
                scene_index INTEGER DEFAULT 0,
                content TEXT NOT NULL,
                chunk_type TEXT DEFAULT 'scene',
                parent_chunk_id TEXT,
                source_file TEXT,
                metadata_json TEXT,
                embedding_blob TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

        # Vector storage table (for backward compat with RAGAdapter)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS vectors (
                chunk_id TEXT PRIMARY KEY,
                chapter_id INTEGER NOT NULL,
                scene_index INTEGER DEFAULT 0,
                content TEXT NOT NULL,
                embedding BLOB,
                parent_chunk_id TEXT,
                chunk_type TEXT,
                source_file TEXT
            )
        """)

        # BM25 index table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS bm25_index (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                term TEXT NOT NULL,
                chunk_id TEXT NOT NULL,
                tf INTEGER DEFAULT 1,
                UNIQUE(term, chunk_id)
            )
        """)

        # Document statistics for BM25
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS doc_stats (
                chunk_id TEXT PRIMARY KEY,
                doc_length INTEGER DEFAULT 0
            )
        """)

        # FTS5 virtual table for keyword search
        cursor.execute("""
            CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
                chunk_id,
                content,
                content='context_chunks',
                content_rowid='id'
            )
        """)

        # sqlite-vec virtual table for native KNN search
        try:
            import sqlite_vec
            embedding_dim = self.embedding_service.get_embedding_dim()
            cursor.execute(f"""
                CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING vec0(
                    embedding float[{embedding_dim}]
                )
            """)
        except ImportError:
            pass  # sqlite-vec not available, fallback to cosine similarity

        # Create indexes
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_chapter
            ON context_chunks(chapter_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_chunks_type
            ON context_chunks(chunk_type)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_vectors_chapter
            ON vectors(chapter_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_bm25_term
            ON bm25_index(term)
        """)

    async def migrate_vectors_to_vec0(self) -> int:
        """Migrate existing vectors to vec0 table. Returns count migrated."""
        try:
            import sqlite_vec
        except ImportError:
            logger.warning("sqlite-vec not available, skipping migration")
            return 0

        conn = self._get_conn()
        cursor = conn.cursor()

        embedding_dim = self.embedding_service.get_embedding_dim()

        # Create vec0 table if not exists
        cursor.execute(f"""
            CREATE VIRTUAL TABLE IF NOT EXISTS vec_items USING vec0(
                embedding float[{embedding_dim}]
            )
        """)

        # Check existing count
        cursor.execute("SELECT COUNT(*) FROM vec_items")
        existing = cursor.fetchone()[0]
        if existing > 0:
            logger.info("vec_items already has %d entries, skipping migration", existing)
            return 0

        # Migrate from vectors table
        cursor.execute("SELECT rowid, embedding FROM vectors WHERE embedding IS NOT NULL")
        count = 0
        for rowid, emb_bytes in cursor.fetchall():
            if emb_bytes:
                try:
                    embedding = self.embedding_service.deserialize_embedding(emb_bytes)
                    cursor.execute(
                        "INSERT INTO vec_items(rowid, embedding) VALUES (?, ?)",
                        [rowid, embedding.tobytes() if hasattr(embedding, 'tobytes') else emb_bytes]
                    )
                    count += 1
                except Exception as e:
                    logger.warning("Failed to migrate vector rowid=%s: %s", rowid, e)

        conn.commit()
        logger.info("Migrated %d vectors to vec_items", count)
        return count

    def _tokenize(self, text: str) -> List[str]:
        """Tokenize text for BM25 indexing."""
        import re
        # Split on Chinese chars, English words, numbers
        tokens = re.findall(r"[一-鿿]+|[A-Za-z]+|\d+", text)
        return [t.lower() for t in tokens if len(t) >= 2]

    async def _update_bm25_index(
        self,
        cursor,
        chunk_id: str,
        content: str,
    ) -> None:
        """Update BM25 index for a chunk."""
        tokens = self._tokenize(content)
        if not tokens:
            return

        # Count term frequencies
        from collections import Counter
        tf = Counter(tokens)

        # Insert/update term frequencies
        for term, count in tf.items():
            cursor.execute("""
                INSERT INTO bm25_index (term, chunk_id, tf)
                VALUES (?, ?, ?)
                ON CONFLICT(term, chunk_id) DO UPDATE SET tf = ?
            """, (term, chunk_id, count, count))

        # Update document length
        cursor.execute("""
            INSERT INTO doc_stats (chunk_id, doc_length)
            VALUES (?, ?)
            ON CONFLICT(chunk_id) DO UPDATE SET doc_length = ?
        """, (chunk_id, len(tokens), len(tokens)))

    async def _rebuild_fts(self, cursor, chunks: List[Chunk]) -> None:
        """Rebuild FTS5 index with new chunks."""
        try:
            # Insert into FTS table
            for chunk in chunks:
                chunk_id = chunk.chunk_id
                cursor.execute("""
                    INSERT OR REPLACE INTO chunks_fts (chunk_id, content)
                    VALUES (?, ?)
                """, (chunk_id, chunk.content))
        except Exception as exc:
            logger.warning("FTS rebuild failed: %s", exc)

    # ------------------------------------------------------------------
    # Search
    # ------------------------------------------------------------------

    async def search(
        self,
        query: str,
        top_k: int = 5,
        chunk_type: Optional[str] = None,
        chapter_id: Optional[int] = None,
        use_rerank: bool = True,
    ) -> List[SearchResult]:
        """Hybrid search combining vector similarity and keyword search.

        Args:
            query: Search query string
            top_k: Number of results to return
            chunk_type: Optional filter by chunk type
            chapter_id: Optional filter by chapter
            use_rerank: Whether to apply reranking

        Returns:
            List of SearchResult objects ranked by relevance
        """
        start_time = time.perf_counter()

        # Get vector and BM25 results in parallel
        vector_results, bm25_results = await self._search_components(
            query, top_k * 3, chunk_type, chapter_id
        )

        # RRF fusion
        fused = self._rrf_fusion(vector_results, bm25_results, top_k)

        # Apply reranking if enabled
        if use_rerank and fused:
            fused = await self.rerank(query, fused[:top_k * 2])
            fused = fused[:top_k]

        # Assign ranks
        for i, result in enumerate(fused):
            result.rank = i + 1

        elapsed_ms = int((time.perf_counter() - start_time) * 1000)
        logger.debug(
            "Search for '%s' returned %d results in %dms",
            query[:50], len(fused), elapsed_ms
        )

        return fused

    async def _search_components(
        self,
        query: str,
        top_k: int,
        chunk_type: Optional[str],
        chapter_id: Optional[int],
    ) -> Tuple[List[SearchResult], List[SearchResult]]:
        """Get vector and BM25 search results."""
        import asyncio

        # Vector search
        vector_task = self._vector_search(query, top_k, chunk_type, chapter_id)
        # BM25 search
        bm25_task = asyncio.to_thread(
            self._bm25_search, query, top_k, chunk_type, chapter_id
        )

        vector_results, bm25_results = await asyncio.gather(
            vector_task, bm25_task
        )

        return vector_results, bm25_results

    async def _vector_search(
        self,
        query: str,
        top_k: int,
        chunk_type: Optional[str],
        chapter_id: Optional[int],
    ) -> List[SearchResult]:
        """Vector similarity search using sqlite-vec KNN."""
        conn = self._get_conn()
        cursor = conn.cursor()

        # Get query embedding
        embeddings = await self.embedding_service.embed([query])
        if not embeddings or embeddings[0] is None:
            return []

        query_embedding = embeddings[0]

        # Try sqlite-vec KNN first
        try:
            import sqlite_vec
            emb_bytes = query_embedding.tobytes() if hasattr(query_embedding, 'tobytes') else self.embedding_service.serialize_embedding(query_embedding)

            # Check if vec_items table has data
            cursor.execute("SELECT COUNT(*) FROM vec_items")
            vec_count = cursor.fetchone()[0]

            if vec_count > 0:
                # Build KNN query with optional filters
                sql = """
                    SELECT v.chunk_id, v.chapter_id, v.scene_index, v.content,
                           v.parent_chunk_id, v.chunk_type, v.source_file,
                           distance
                    FROM vec_items
                    JOIN vectors v ON v.rowid = vec_items.rowid
                    WHERE vec_items.embedding MATCH ?
                """
                params: List[Any] = [emb_bytes]

                if chunk_type:
                    sql += " AND v.chunk_type = ?"
                    params.append(chunk_type)
                if chapter_id is not None:
                    sql += " AND v.chapter_id <= ?"
                    params.append(chapter_id)

                sql += " ORDER BY distance LIMIT ?"
                params.append(top_k)

                cursor.execute(sql, params)
                results: List[SearchResult] = []
                for row in cursor.fetchall():
                    chunk_id, ch_id, scene_idx, content, parent_id, ctype, src_file, distance = row
                    # sqlite-vec returns L2 distance, convert to similarity score (0-1)
                    score = max(0.0, 1.0 - distance)
                    results.append(SearchResult(
                        chunk_id=chunk_id,
                        chapter_id=ch_id,
                        scene_index=scene_idx,
                        content=content,
                        score=score,
                        source="vector",
                        parent_chunk_id=parent_id,
                        chunk_type=ctype,
                        source_file=src_file,
                    ))
                return results
        except Exception as e:
            logger.debug("sqlite-vec KNN failed, falling back to cosine: %s", e)

        # Fallback: cosine similarity (original implementation)
        sql = """
            SELECT chunk_id, chapter_id, scene_index, content,
                   embedding, parent_chunk_id, chunk_type, source_file
            FROM vectors
            WHERE embedding IS NOT NULL
        """
        params = []
        if chunk_type:
            sql += " AND chunk_type = ?"
            params.append(chunk_type)
        if chapter_id is not None:
            sql += " AND chapter_id <= ?"
            params.append(chapter_id)

        cursor.execute(sql, params)

        results = []
        for row in cursor.fetchall():
            chunk_id, ch_id, scene_idx, content, emb_bytes, parent_id, ctype, src_file = row
            if not emb_bytes:
                continue
            embedding = self.embedding_service.deserialize_embedding(emb_bytes)
            score = self._cosine_similarity(query_embedding, embedding)
            results.append(SearchResult(
                chunk_id=chunk_id, chapter_id=ch_id, scene_index=scene_idx,
                content=content, score=score, source="vector",
                parent_chunk_id=parent_id, chunk_type=ctype, source_file=src_file,
            ))
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:top_k]

    def _bm25_search(
        self,
        query: str,
        top_k: int,
        chunk_type: Optional[str],
        chapter_id: Optional[int],
    ) -> List[SearchResult]:
        """BM25 keyword search."""
        import math

        conn = self._get_fts_conn()
        cursor = conn.cursor()

        query_terms = self._tokenize(query)
        if not query_terms:
            return []

        # Get BM25 stats
        cursor.execute("SELECT COUNT(*), AVG(doc_length) FROM doc_stats")
        row = cursor.fetchone()
        total_docs = row[0] or 1
        avg_doc_length = row[1] or 1

        k1, b = 1.5, 0.75
        doc_scores: Dict[str, float] = {}

        # Score documents
        for term in set(query_terms):
            cursor.execute("""
                SELECT b.chunk_id, b.tf, d.doc_length
                FROM bm25_index b
                JOIN doc_stats d ON b.chunk_id = d.chunk_id
                WHERE b.term = ?
            """, (term,))
            docs_with_term = cursor.fetchall()
            df = len(docs_with_term)
            if df == 0:
                continue

            idf = math.log((total_docs - df + 0.5) / (df + 0.5) + 1)

            for cid, tf, doc_len in docs_with_term:
                denom = tf + k1 * (1 - b + b * doc_len / avg_doc_length)
                score = idf * (tf * (k1 + 1)) / denom if denom > 0 else 0
                doc_scores[cid] = doc_scores.get(cid, 0) + score

        if not doc_scores:
            return []

        # Fetch content for top-scored docs
        sorted_docs = sorted(doc_scores.items(), key=lambda x: x[1], reverse=True)
        chunk_ids = [cid for cid, _ in sorted_docs[:top_k * 2]]

        if not chunk_ids:
            return []

        placeholders = ",".join(["?"] * len(chunk_ids))
        cursor.execute(f"""
            SELECT chunk_id, chapter_id, scene_index, content,
                   parent_chunk_id, chunk_type, source_file
            FROM vectors
            WHERE chunk_id IN ({placeholders})
        """, tuple(chunk_ids))

        chunk_map = {
            row[0]: row for row in cursor.fetchall()
        }

        results: List[SearchResult] = []
        for chunk_id, score in sorted_docs:
            if chunk_id not in chunk_map:
                continue
            row = chunk_map[chunk_id]
            results.append(SearchResult(
                chunk_id=row[0],
                chapter_id=row[1],
                scene_index=row[2],
                content=row[3],
                score=score,
                source="bm25",
                parent_chunk_id=row[4],
                chunk_type=row[5],
                source_file=row[6],
            ))

        return results[:top_k]

    def _rrf_fusion(
        self,
        vector_results: List[SearchResult],
        bm25_results: List[SearchResult],
        top_k: int,
        rrf_k: int = 60,
    ) -> List[SearchResult]:
        """Reciprocal Rank Fusion for combining search results."""
        rrf_scores: Dict[str, Dict[str, Any]] = {}

        for rank, result in enumerate(vector_results):
            if result.chunk_id not in rrf_scores:
                rrf_scores[result.chunk_id] = {
                    "result": result,
                    "score": 0.0,
                    "content": result.content,
                    "chapter_id": result.chapter_id,
                }
            rrf_scores[result.chunk_id]["score"] += 1.0 / (rrf_k + rank + 1)

        for rank, result in enumerate(bm25_results):
            if result.chunk_id not in rrf_scores:
                rrf_scores[result.chunk_id] = {
                    "result": result,
                    "score": 0.0,
                    "content": result.content,
                    "chapter_id": result.chapter_id,
                }
            rrf_scores[result.chunk_id]["score"] += 1.0 / (rrf_k + rank + 1)

        sorted_results = sorted(
            rrf_scores.values(),
            key=lambda x: x["score"],
            reverse=True
        )

        final: List[SearchResult] = []
        for item in sorted_results[:top_k]:
            result = item["result"]
            result.score = item["score"]
            result.source = "hybrid"
            final.append(result)

        return final

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Calculate cosine similarity between two vectors."""
        dot = np.dot(a, b)
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(dot / (norm_a * norm_b))

    # ------------------------------------------------------------------
    # Reranking
    # ------------------------------------------------------------------

    async def rerank(
        self,
        query: str,
        results: List[SearchResult],
    ) -> List[SearchResult]:
        """Rerank search results using cross-attention scoring.

        Args:
            query: Original search query
            results: List of SearchResult objects to rerank

        Returns:
            Reranked list of SearchResult objects
        """
        if not results:
            return results

        # Simple reranking: boost scores based on keyword overlap
        query_terms = set(self._tokenize(query))
        if not query_terms:
            return results

        for result in results:
            content_terms = set(self._tokenize(result.content))
            overlap = len(query_terms & content_terms)
            keyword_boost = overlap / max(len(query_terms), 1) * 0.2
            result.score = result.score * (1 + keyword_boost)

        results.sort(key=lambda x: x.score, reverse=True)
        for i, result in enumerate(results):
            result.source = "reranked"
            result.rank = i + 1

        return results

    # ------------------------------------------------------------------
    # Chunk text processing
    # ------------------------------------------------------------------

    async def process_chapter(
        self,
        chapter_id: int,
        text: str,
        strategy: str = "paragraph",
        chunker_kwargs: Optional[dict] = None,
    ) -> List[Chunk]:
        """Process chapter text into chunks.

        Args:
            chapter_id: Chapter ID
            text: Chapter text content
            strategy: Chunking strategy ("paragraph", "scene", "chapter", "sliding_window")
            chunker_kwargs: Additional arguments for the chunker

        Returns:
            List of Chunk objects
        """
        chunker = create_chunker(strategy, **(chunker_kwargs or {}))
        chunks = chunker.chunk(text, {"chapter_id": chapter_id})
        return chunks

    async def add_chapter(
        self,
        chapter_id: int,
        text: str,
        strategy: str = "paragraph",
    ) -> int:
        """Process and add chapter text as chunks.

        Args:
            chapter_id: Chapter ID
            text: Chapter text content
            strategy: Chunking strategy

        Returns:
            Number of chunks added
        """
        chunks = await self.process_chapter(chapter_id, text, strategy)
        return await self.add_chunks(chapter_id, chunks)

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def get_stats(self) -> dict:
        """Get index statistics."""
        conn = self._get_conn()
        cursor = conn.cursor()

        stats = {}
        try:
            cursor.execute("SELECT COUNT(*) FROM vectors")
            stats["vectors"] = cursor.fetchone()[0] or 0

            cursor.execute("SELECT COUNT(*) FROM context_chunks")
            stats["chunks"] = cursor.fetchone()[0] or 0

            cursor.execute("SELECT COUNT(*) FROM doc_stats")
            stats["indexed_docs"] = cursor.fetchone()[0] or 0

            cursor.execute("SELECT SUM(doc_length) FROM doc_stats")
            total_len = cursor.fetchone()[0] or 0
            stats["total_tokens"] = total_len
        except Exception as e:
            logger.debug("RAG stats query partial failure: %s", e)
            stats.setdefault("vectors", 0)
            stats.setdefault("chunks", 0)
            stats.setdefault("indexed_docs", 0)
            stats.setdefault("total_tokens", 0)

        return stats

    async def delete_chunks_by_chapter(self, chapter_id: int) -> int:
        """Delete all chunks for a chapter.

        Args:
            chapter_id: Chapter ID to delete chunks for

        Returns:
            Number of chunks deleted
        """
        conn = self._get_conn()
        cursor = conn.cursor()

        # Get chunk IDs to delete
        cursor.execute(
            "SELECT chunk_id FROM context_chunks WHERE chapter_id = ?",
            (chapter_id,)
        )
        chunk_ids = [row[0] for row in cursor.fetchall()]

        if not chunk_ids:
            return 0

        # Delete from context_chunks
        cursor.execute(
            "DELETE FROM context_chunks WHERE chapter_id = ?",
            (chapter_id,)
        )

        # Delete from vectors
        cursor.execute(
            "DELETE FROM vectors WHERE chapter_id = ?",
            (chapter_id,)
        )

        # Delete from bm25_index
        placeholders = ",".join(["?"] * len(chunk_ids))
        cursor.execute(
            f"DELETE FROM bm25_index WHERE chunk_id IN ({placeholders})",
            tuple(chunk_ids)
        )

        # Delete from doc_stats
        cursor.execute(
            f"DELETE FROM doc_stats WHERE chunk_id IN ({placeholders})",
            tuple(chunk_ids)
        )

        conn.commit()
        return len(chunk_ids)


# Singleton instance
_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    """Get or create the singleton RAG service instance."""
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service
