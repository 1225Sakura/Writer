"""RAG Adapter - retrieval engine with 3 modes: auto, graph_hybrid, bm25_fallback.

Supports:
- vector_search: cosine similarity over stored embeddings
- bm25_search: keyword-based BM25 ranking
- hybrid_search: RRF fusion of vector + BM25 + optional rerank
- graph_hybrid_search: entity graph expansion + vector rerank
- search: unified entry with auto strategy selection

Uses ContextManager for index storage and chunk management.
Embeddings are generated via the AIService provider router.
"""

from __future__ import annotations

import asyncio
import itertools
import json
import logging
import math
import re
import time
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.exc import SQLAlchemyError

from backend.services.context_manager import ContextManager, TextChunk
from backend.core.services.ai.ai_service import ai_service
from backend.utils.exceptions import AIServiceError
from backend.services.narrative_kg import NarrativeKG
from backend.services.entity_registry import EntityRegistry
from backend.services.sqlite_vec_service import SQLiteVecService

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# SearchResult
# ---------------------------------------------------------------------------


@dataclass
class SearchResult:
    """Single search result from RAG retrieval."""

    chunk_id: str
    chapter_id: int
    scene_index: int
    content: str
    score: float
    source: str  # "vector" | "bm25" | "hybrid" | "graph_hybrid"
    parent_chunk_id: Optional[str] = None
    chunk_type: Optional[str] = None
    source_file: Optional[str] = None


# ---------------------------------------------------------------------------
# RAGAdapter
# ---------------------------------------------------------------------------


class RAGAdapter:
    """RAG retrieval adapter supporting multiple search strategies."""

    def __init__(self, context_manager: Optional[ContextManager] = None) -> None:
        self.cm = context_manager or ContextManager()
        self._degraded_mode_reason: Optional[str] = None

    @property
    def degraded_mode_reason(self) -> Optional[str]:
        return self._degraded_mode_reason

    # ------------------------------------------------------------------
    # Embedding helpers (via AIService)
    # ------------------------------------------------------------------

    async def _embed(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Get embeddings for texts via the AI service.

        Falls back to None for each text if embedding fails.
        """
        if not texts:
            return []

        router = ai_service.router
        if router is None:
            # Try to initialize a minimal router
            try:
                from backend.services.ai import MiniMaxProvider
                from backend.config import settings
                if settings.minimax_api_key:
                    provider = MiniMaxProvider(
                        api_key=settings.minimax_api_key,
                        base_url=settings.minimax_api_url,
                    )
                    from backend.services.ai import ProviderRouter
                    router = ProviderRouter(providers=[provider])
                    ai_service.set_router(router)
            except AIServiceError as exc:
                logger.warning("Could not initialize embedding provider: %s", exc)
                self._degraded_mode_reason = "embedding_provider_unavailable"
                return [None] * len(texts)

        # Use the provider's embedding capability if available
        # Since our AIProvider interface doesn't define embed(), we use
        # a lightweight HTTP call to MiniMax's embedding endpoint
        try:
            return await self._embed_via_minimax(texts)
        except AIServiceError as exc:
            logger.warning("Embedding failed: %s", exc)
            self._degraded_mode_reason = "embedding_failed"
            return [None] * len(texts)

    async def _embed_via_minimax(self, texts: List[str]) -> List[Optional[List[float]]]:
        """Call MiniMax embedding API directly."""
        import httpx
        from backend.config import settings

        api_key = settings.minimax_api_key
        if not api_key:
            return [None] * len(texts)

        url = f"{settings.minimax_api_url}/embeddings"
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

        results: List[Optional[List[float]]] = []
        # MiniMax supports batching; process all at once
        payload = {
            "model": "embo-01",
            "input": texts,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                resp = await client.post(url, headers=headers, json=payload)
                resp.raise_for_status()
                data = resp.json()
                embeddings = data.get("data", [])
                # Sort by index to maintain order
                embeddings.sort(key=lambda x: x.get("index", 0))
                for item in embeddings:
                    vec = item.get("embedding")
                    if vec and isinstance(vec, list):
                        results.append(vec)
                    else:
                        results.append(None)
            except AIServiceError as exc:
                logger.warning("MiniMax embedding API error: %s", exc)
                return [None] * len(texts)

        # Pad if fewer results than inputs
        while len(results) < len(texts):
            results.append(None)
        return results[:len(texts)]

    # ------------------------------------------------------------------
    # Vector search
    # ------------------------------------------------------------------

    async def vector_search(
        self,
        query: str,
        top_k: int = 10,
        chunk_type: Optional[str] = None,
        chapter_id: Optional[int] = None,
        log_query: bool = True,
    ) -> List[SearchResult]:
        """Cosine similarity search over stored embeddings."""
        top_k = top_k or self.cm.config.get("vector_top_k", 10)
        start_time = time.perf_counter()

        query_embeddings = await self._embed([query])
        if not query_embeddings or query_embeddings[0] is None:
            return []

        self._degraded_mode_reason = None
        query_embedding = query_embeddings[0]

        results: List[SearchResult] = []
        with self.cm._get_conn() as conn:
            cursor = conn.cursor()
            sql = """
                SELECT chunk_id, chapter_id, scene_index, content,
                       embedding, parent_chunk_id, chunk_type, source_file
                FROM vectors
                WHERE embedding IS NOT NULL
            """
            params: List[Any] = []
            if chunk_type:
                sql += " AND chunk_type = ?"
                params.append(chunk_type)
            if chapter_id is not None:
                sql += " AND chapter_id <= ?"
                params.append(chapter_id)

            cursor.execute(sql, params)
            for row in cursor.fetchall():
                (
                    chunk_id, ch_id, scene_idx, content,
                    emb_bytes, parent_id, ctype, src_file,
                ) = row
                if not emb_bytes:
                    continue
                embedding = self.cm._deserialize_embedding(emb_bytes)
                score = self._cosine_similarity(query_embedding, embedding)
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

        results.sort(key=lambda x: x.score, reverse=True)
        results = results[:top_k]
        if log_query:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            self._log_query(query, "vector", results, latency_ms, chapter_id)
        return results

    # ------------------------------------------------------------------
    # BM25 search
    # ------------------------------------------------------------------

    def bm25_search(
        self,
        query: str,
        top_k: int = 10,
        k1: float = 1.5,
        b: float = 0.75,
        chunk_type: Optional[str] = None,
        chapter_id: Optional[int] = None,
        log_query: bool = True,
    ) -> List[SearchResult]:
        """BM25 keyword search over indexed chunks."""
        top_k = top_k or self.cm.config.get("bm25_top_k", 10)
        start_time = time.perf_counter()

        query_terms = self.cm._tokenize(query)
        if not query_terms:
            return []

        doc_scores: Dict[str, float] = {}
        with self.cm._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*), AVG(doc_length) FROM doc_stats")
            row = cursor.fetchone()
            total_docs = row[0] or 1
            avg_doc_length = row[1] or 1

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

            # Fetch content for scored docs
            results = []
            for cid, score in doc_scores.items():
                sql = """
                    SELECT chapter_id, scene_index, content,
                           parent_chunk_id, chunk_type, source_file
                    FROM vectors WHERE chunk_id = ?
                """
                params = [cid]
                if chunk_type:
                    sql += " AND chunk_type = ?"
                    params.append(chunk_type)
                if chapter_id is not None:
                    sql += " AND chapter_id <= ?"
                    params.append(chapter_id)

                cursor.execute(sql, params)
                row = cursor.fetchone()
                if row:
                    results.append(SearchResult(
                        chunk_id=cid,
                        chapter_id=row[0],
                        scene_index=row[1],
                        content=row[2],
                        score=score,
                        source="bm25",
                        parent_chunk_id=row[3],
                        chunk_type=row[4],
                        source_file=row[5],
                    ))

        results.sort(key=lambda x: x.score, reverse=True)
        results = results[:top_k]
        if log_query:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            self._log_query(query, "bm25", results, latency_ms, chapter_id)
        return results

    # ------------------------------------------------------------------
    # Hybrid search (vector + BM25 + RRF)
    # ------------------------------------------------------------------

    async def hybrid_search(
        self,
        query: str,
        vector_top_k: Optional[int] = None,
        bm25_top_k: Optional[int] = None,
        rerank_top_n: Optional[int] = None,
        chunk_type: Optional[str] = None,
        chapter_id: Optional[int] = None,
        log_query: bool = True,
    ) -> List[SearchResult]:
        """Hybrid search: vector + BM25 with RRF fusion.

        For small indices (<=5000 vectors), does full vector scan.
        For larger indices, pre-filters via BM25 candidates + recent chunks.
        """
        v_top_k = vector_top_k or self.cm.config.get("vector_top_k", 10)
        b_top_k = bm25_top_k or self.cm.config.get("bm25_top_k", 10)
        r_top_n = rerank_top_n or self.cm.config.get("rerank_top_n", 5)
        start_time = time.perf_counter()

        stats = self.cm.get_stats()
        vectors_count = stats.get("vectors", 0)
        use_full_scan = vectors_count <= self.cm.config.get("vector_full_scan_max_vectors", 5000)

        if use_full_scan:
            vector_results, bm25_results = await asyncio.gather(
                self.vector_search(query, v_top_k, chunk_type, chapter_id, log_query=False),
                asyncio.to_thread(
                    self.bm25_search, query, b_top_k, 1.5, 0.75,
                    chunk_type, chapter_id, False
                ),
            )
        else:
            # Pre-filter: get BM25 candidates + recent chunks
            bm25_candidates = max(
                self.cm.config.get("vector_prefilter_bm25_candidates", 200),
                b_top_k,
                v_top_k * 5,
                r_top_n * 10,
            )
            bm25_task = asyncio.to_thread(
                self.bm25_search, query, bm25_candidates, 1.5, 0.75,
                chunk_type, chapter_id, False
            )
            embed_task = self._embed([query])
            bm25_candidates_results, query_embeddings = await asyncio.gather(
                bm25_task, embed_task
            )

            if not query_embeddings or query_embeddings[0] is None:
                return []

            query_embedding = query_embeddings[0]
            candidate_ids = {r.chunk_id for r in bm25_candidates_results}

            # Fetch vectors for candidates
            rows = self._fetch_vectors_by_chunk_ids(list(candidate_ids), chunk_type, chapter_id)
            vector_results = self._vector_search_rows(query_embedding, rows, top_k=v_top_k)
            bm25_results = list(bm25_candidates_results)[:b_top_k]

        # RRF fusion
        rrf_k = self.cm.config.get("rrf_k", 60)
        rrf_scores: Dict[str, Dict[str, Any]] = {}

        for rank, result in enumerate(vector_results):
            if result.chunk_id not in rrf_scores:
                rrf_scores[result.chunk_id] = {"result": result, "score": 0.0}
            rrf_scores[result.chunk_id]["score"] += 1.0 / (rrf_k + rank + 1)

        for rank, result in enumerate(bm25_results):
            if result.chunk_id not in rrf_scores:
                rrf_scores[result.chunk_id] = {"result": result, "score": 0.0}
            rrf_scores[result.chunk_id]["score"] += 1.0 / (rrf_k + rank + 1)

        sorted_results = sorted(rrf_scores.values(), key=lambda x: x["score"], reverse=True)
        final_results = [item["result"] for item in sorted_results[:r_top_n]]
        for r in final_results:
            r.source = "hybrid"

        if log_query:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            self._log_query(query, "hybrid", final_results, latency_ms, chapter_id)
        return final_results

    # ------------------------------------------------------------------
    # Graph-hybrid search
    # ------------------------------------------------------------------

    async def graph_hybrid_search(
        self,
        query: str,
        top_k: int = 5,
        chunk_type: Optional[str] = None,
        chapter_id: Optional[int] = None,
        center_entities: Optional[List[str]] = None,
        log_query: bool = True,
    ) -> List[SearchResult]:
        """Graph-enhanced hybrid search.

        1. Run hybrid search as base recall
        2. Extract seed entities from query (character names, etc.)
        3. Expand via relationship graph
        4. Re-rank with graph priors
        """
        start_time = time.perf_counter()

        # Base hybrid recall
        base_results = await self.hybrid_search(
            query=query,
            vector_top_k=max(top_k * 3, self.cm.config.get("vector_top_k", 10)),
            bm25_top_k=max(top_k * 3, self.cm.config.get("bm25_top_k", 10)),
            rerank_top_n=max(top_k * 2, self.cm.config.get("rerank_top_n", 5)),
            chunk_type=chunk_type,
            chapter_id=chapter_id,
            log_query=False,
        )

        if not self.cm.config.get("graph_rag_enabled", True):
            final = list(base_results)[:top_k]
            if log_query:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                self._log_query(query, "graph_hybrid_fallback", final, latency_ms, chapter_id)
            return final

        # Extract seed entities from query
        seeds = self._extract_seed_entities(query, center_entities)
        if not seeds:
            final = list(base_results)[:top_k]
            if log_query:
                latency_ms = int((time.perf_counter() - start_time) * 1000)
                self._log_query(query, "graph_hybrid_no_seed", final, latency_ms, chapter_id)
            return final

        # Expand via graph (character relationships)
        expanded = await self._expand_entities(seeds)

        # Collect candidate chunks containing expanded entities
        candidate_ids = self._collect_graph_candidates(expanded, chapter_id)

        # Vector search within candidates
        graph_results = await self._vector_search_candidates(
            query, candidate_ids, top_k=max(top_k * 4, self.cm.config.get("rerank_top_n", 5) * 2),
            chunk_type=chunk_type,
        )

        # Apply graph priors
        seed_terms = set(seeds + expanded)
        max_chapter = chapter_id or self.cm.get_stats().get("max_chapter", 0)
        for r in graph_results:
            r.score = self._apply_graph_priors(r, seed_terms, max_chapter)
            r.source = "graph_hybrid"

        # Merge with base results
        merged: Dict[str, SearchResult] = {}
        for r in base_results:
            r.source = "graph_hybrid"
            merged[r.chunk_id] = r
        for r in graph_results:
            existing = merged.get(r.chunk_id)
            if existing is None or r.score > existing.score:
                merged[r.chunk_id] = r

        sorted_candidates = sorted(merged.values(), key=lambda x: x.score, reverse=True)
        final = sorted_candidates[:top_k]

        if log_query:
            latency_ms = int((time.perf_counter() - start_time) * 1000)
            self._log_query(query, "graph_hybrid", final, latency_ms, chapter_id)
        return final

    # ------------------------------------------------------------------
    # Unified search entry
    # ------------------------------------------------------------------

    async def search(
        self,
        query: str,
        top_k: int = 5,
        strategy: str = "auto",
        chunk_type: Optional[str] = None,
        chapter_id: Optional[int] = None,
        center_entities: Optional[List[str]] = None,
        filters: Optional[Dict[str, Any]] = None,
    ) -> List[SearchResult]:
        """Unified search entry.

        Strategies:
        - auto: automatically choose based on query and config
        - graph_hybrid: graph-enhanced hybrid search
        - bm25_fallback: pure BM25 (no embeddings needed)
        - hybrid: vector + BM25 fusion
        - vector: pure vector similarity
        """
        strategy = str(strategy or "auto").lower()

        if filters and chapter_id is None:
            try:
                chapter_id = int((filters or {}).get("to_chapter") or 0) or None
            except (TypeError, ValueError):
                chapter_id = None

        if strategy == "auto":
            # Simple heuristic: if query contains entity names, use graph_hybrid
            # if embeddings available; otherwise hybrid or bm25_fallback
            stats = self.cm.get_stats()
            has_vectors = stats.get("vectors", 0) > 0
            if has_vectors and self.cm.config.get("graph_rag_enabled", True):
                strategy = "graph_hybrid"
            elif has_vectors:
                strategy = "hybrid"
            else:
                strategy = "bm25_fallback"

        if strategy == "vector":
            return await self.vector_search(query, top_k, chunk_type, chapter_id)
        if strategy == "bm25" or strategy == "bm25_fallback":
            return self.bm25_search(query, top_k, chunk_type=chunk_type, chapter_id=chapter_id)
        if strategy == "graph_hybrid":
            return await self.graph_hybrid_search(
                query, top_k, chunk_type, chapter_id, center_entities
            )
        return await self.hybrid_search(
            query, top_k, top_k, top_k, chunk_type, chapter_id
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _cosine_similarity(self, a: List[float], b: List[float]) -> float:
        dot = sum(x * y for x, y in zip(a, b))
        norm_a = math.sqrt(sum(x * x for x in a))
        norm_b = math.sqrt(sum(x * x for x in b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return dot / (norm_a * norm_b)

    def _fetch_vectors_by_chunk_ids(
        self,
        chunk_ids: List[str],
        chunk_type: Optional[str] = None,
        chapter_id: Optional[int] = None,
    ) -> List[Tuple]:
        if not chunk_ids:
            return []
        import itertools

        rows: List[Tuple] = []
        with self.cm._get_conn() as conn:
            cursor = conn.cursor()
            for batch in self._chunks(chunk_ids, 500):
                placeholders = ",".join(["?"] * len(batch))
                sql = f"""
                    SELECT chunk_id, chapter_id, scene_index, content,
                           embedding, parent_chunk_id, chunk_type, source_file
                    FROM vectors WHERE chunk_id IN ({placeholders})
                """
                cursor.execute(sql, tuple(batch))
                rows.extend(cursor.fetchall())

        if chunk_type:
            rows = [r for r in rows if len(r) > 6 and r[6] == chunk_type]
        if chapter_id is not None:
            rows = [r for r in rows if len(r) > 1 and int(r[1] or 0) <= int(chapter_id)]
        return rows

    def _vector_search_rows(
        self,
        query_embedding: List[float],
        rows: List[Tuple],
        top_k: int,
    ) -> List[SearchResult]:
        results: List[SearchResult] = []
        for row in rows:
            chunk_id, ch_id, scene_idx, content, emb_bytes, parent_id, ctype, src = row
            if not emb_bytes:
                continue
            embedding = self.cm._deserialize_embedding(emb_bytes)
            score = self._cosine_similarity(query_embedding, embedding)
            results.append(SearchResult(
                chunk_id=chunk_id, chapter_id=ch_id, scene_index=scene_idx,
                content=content, score=score, source="vector",
                parent_chunk_id=parent_id, chunk_type=ctype, source_file=src,
            ))
        results.sort(key=lambda x: x.score, reverse=True)
        return results[:top_k]

    @staticmethod
    def _chunks(xs: List[str], size: int = 500):
        it = iter(xs)
        while True:
            batch = list(itertools.islice(it, size))
            if not batch:
                break
            yield batch

    def _log_query(
        self,
        query: str,
        query_type: str,
        results: List[SearchResult],
        latency_ms: int,
        chapter_id: Optional[int] = None,
    ) -> None:
        from collections import Counter
        hit_sources = Counter([r.chunk_type or "unknown" for r in results])
        self.cm.log_query(query, query_type, len(results), dict(hit_sources), latency_ms, chapter_id)

    # ------------------------------------------------------------------
    # Graph helpers
    # ------------------------------------------------------------------

    def _extract_seed_entities(
        self,
        query: str,
        center_entities: Optional[List[str]] = None,
    ) -> List[str]:
        """Extract seed entity names from query or provided list."""
        if center_entities:
            return [s.strip() for s in center_entities if s.strip()]
        # Extract Chinese names (2-8 chars) and English words
        tokens = set(re.findall(r"[\u4e00-\u9fff]{2,8}|[A-Za-z][A-Za-z0-9_]{1,24}", query))
        return list(tokens)[:20]

    async def _expand_entities(self, seeds: List[str]) -> List[str]:
        """Expand seed entities via character relationship graph.

        Uses the database to find related characters.
        """
        max_entities = self.cm.config.get("graph_rag_max_expanded_entities", 20)
        expanded = list(seeds)

        try:
            from backend.infrastructure.database import async_session_maker
            from backend.core.domain import Character, CharacterRelationship
            from sqlalchemy import select

            async with async_session_maker() as session:
                # Find character IDs matching seed names
                result = await session.execute(
                    select(Character).where(Character.name.in_(seeds))
                )
                seed_chars = result.scalars().all()
                seed_ids = {c.id for c in seed_chars}

                if not seed_ids:
                    return expanded[:max_entities]

                # Find related characters via relationships
                result = await session.execute(
                    select(CharacterRelationship)
                    .where(
                        (CharacterRelationship.character_id.in_(seed_ids)) |
                        (CharacterRelationship.target_id.in_(seed_ids))
                    )
                )
                rels = result.scalars().all()
                related_ids = set()
                for r in rels:
                    related_ids.add(r.character_id)
                    related_ids.add(r.target_id)

                # Fetch names of related characters
                if related_ids:
                    result = await session.execute(
                        select(Character).where(Character.id.in_(list(related_ids)))
                    )
                    related_chars = result.scalars().all()
                    for c in related_chars:
                        if c.name not in expanded:
                            expanded.append(c.name)
        except SQLAlchemyError as exc:
            logger.warning("Entity graph expansion failed: %s", exc)

        return expanded[:max_entities]

    def _collect_graph_candidates(
        self,
        entity_names: List[str],
        chapter_id: Optional[int] = None,
    ) -> List[str]:
        """Find chunk IDs containing any of the entity names."""
        if not entity_names:
            return []
        limit = self.cm.config.get("graph_rag_candidate_limit", 100)

        with self.cm._get_conn() as conn:
            cursor = conn.cursor()
            if chapter_id is None:
                cursor.execute(
                    "SELECT chunk_id, chapter_id, content FROM vectors ORDER BY chapter_id DESC"
                )
            else:
                cursor.execute(
                    "SELECT chunk_id, chapter_id, content FROM vectors WHERE chapter_id <= ? ORDER BY chapter_id DESC",
                    (chapter_id,),
                )
            rows = cursor.fetchall()

        scored: List[Tuple[str, int, int]] = []
        for cid, chid, content in rows:
            text = str(content or "")
            if not text:
                continue
            score = sum(1 for name in entity_names if name and name in text)
            if score > 0:
                scored.append((cid, chid or 0, score))

        scored.sort(key=lambda x: (x[2], x[1]), reverse=True)
        return [cid for cid, _, _ in scored[:limit]]

    def _apply_graph_priors(
        self,
        result: SearchResult,
        entity_terms: set[str],
        max_chapter: int,
    ) -> float:
        """Boost score based on entity presence and recency."""
        score = float(result.score)
        content = str(result.content or "")

        if any(term and term in content for term in entity_terms):
            score += self.cm.config.get("graph_rag_boost_same_entity", 0.15)

        if max_chapter > 0 and result.chapter_id:
            gap = max(0, max_chapter - int(result.chapter_id))
            recency = max(0.0, 1.0 - min(gap, 100) / 100.0)
            score += recency * self.cm.config.get("graph_rag_boost_recency", 0.05)

        return score

    async def _vector_search_candidates(
        self,
        query: str,
        candidate_ids: List[str],
        top_k: int,
        chunk_type: Optional[str] = None,
    ) -> List[SearchResult]:
        if not candidate_ids:
            return []
        query_embeddings = await self._embed([query])
        if not query_embeddings or query_embeddings[0] is None:
            return []
        query_embedding = query_embeddings[0]
        rows = self._fetch_vectors_by_chunk_ids(candidate_ids, chunk_type)
        return self._vector_search_rows(query_embedding, rows, top_k=top_k)

    # ------------------------------------------------------------------
    # LeanRAG-style retrieval pipeline
    # ------------------------------------------------------------------

    def _extract_entities_from_query(
        self,
        query: str,
        entity_registry: Optional[EntityRegistry] = None,
    ) -> List[str]:
        """Extract entity names from query using pattern matching.

        Matches Chinese name patterns (2-4 char names) commonly found in
        narrative queries, then optionally resolves them via EntityRegistry
        to canonical names.
        """
        entities: List[str] = []
        name_patterns = [
            re.compile(r"(?![的和与跟向对])([一-鿿]{2,4})(?=(?:的|和|与|跟|向|对))"),
            re.compile(r"(?:角色|人物|主角|配角)\s*[:：]?\s*([一-鿿]{2,4})"),
        ]
        for pattern in name_patterns:
            for match in pattern.finditer(query):
                name = match.group(1)
                if entity_registry:
                    record = entity_registry.resolve(name)
                    if record:
                        entities.append(record.canonical_name)
                else:
                    entities.append(name)
        return list(set(entities))

    async def _expand_via_narrative_kg(
        self,
        entities: List[str],
        narrative_kg: NarrativeKG,
        entity_registry: Optional[EntityRegistry] = None,
        max_hops: int = 2,
    ) -> List[str]:
        """Expand entity list via NarrativeKG graph traversal.

        For each seed entity, resolves it to a canonical ID, then performs
        BFS up to *max_hops* to discover related entities.  Returns the
        union of seed names and all discovered neighbor names.
        """
        expanded: set = set(entities)
        for entity_name in entities:
            if entity_registry:
                record = entity_registry.resolve(entity_name)
                if record:
                    neighbors = narrative_kg.get_neighbors(
                        record.canonical_id, max_hops=max_hops
                    )
                    for neighbor_id, _distance in neighbors.items():
                        node = narrative_kg.get_node(neighbor_id)
                        if node:
                            expanded.add(node.name)
        return list(expanded)

    def _rerank_candidates(
        self,
        candidates: List[Tuple[str, float]],
        query_entities: List[str],
        chapter_decay_fn: Any = None,
        current_chapter: int = 0,
    ) -> List[Tuple[str, float]]:
        """Rerank candidates by entity overlap + decay + recency.

        Each candidate is a ``(chunk_id, vec_distance)`` pair.  The final
        score combines:

        * vector similarity  (40 %)  — ``1 - vec_distance``
        * entity overlap     (40 %)  — Jaccard-like ratio
        * chapter decay      (20 %)  — provided *chapter_decay_fn*
        """
        scored: List[Tuple[str, float]] = []
        for chunk_id, vec_dist in candidates:
            # Entity overlap score (0-1)
            chunk_entities = self._get_chunk_entities(chunk_id)
            overlap = len(set(query_entities) & set(chunk_entities)) / max(
                len(query_entities), 1
            )

            # Decay score (use chapter-distance decay)
            chunk_chapter = self._get_chunk_chapter(chunk_id)
            decay = 1.0
            if chapter_decay_fn and chunk_chapter is not None:
                distance = max(0, current_chapter - chunk_chapter)
                decay = chapter_decay_fn(distance)

            # Combined score (lower vec_distance is better -> use 1 - dist)
            combined = (1.0 - vec_dist) * 0.4 + overlap * 0.4 + decay * 0.2
            scored.append((chunk_id, combined))

        scored.sort(key=lambda x: x[1], reverse=True)
        return scored

    async def leanrag_search(
        self,
        query: str,
        narrative_kg: Optional[NarrativeKG] = None,
        entity_registry: Optional[EntityRegistry] = None,
        sqlite_vec_service: Optional[SQLiteVecService] = None,
        max_results: int = 10,
        max_hops: int = 2,
    ) -> List[Dict[str, Any]]:
        """LeanRAG-style retrieval: entity-anchored + graph expansion + reranking.

        Pipeline:
            Query -> Entity Extraction -> Entity-Anchored Search (sqlite-vec)
                    -> Graph Expansion (NarrativeKG, 1-2 hops)
                    -> Candidate Collection (union)
                    -> Contextual Reranking (entity overlap + decay + recency)
                    -> Top-K Results
        """

        # Step 1: Extract entities from query
        entities = self._extract_entities_from_query(query, entity_registry)

        # Step 2: Entity-anchored search via sqlite-vec
        candidates: List[Tuple[str, float]] = []
        if sqlite_vec_service:
            query_embeddings = await self._embed([query])
            if query_embeddings and query_embeddings[0] is not None:
                query_bytes = self._floats_to_bytes(query_embeddings[0])
                vec_results = sqlite_vec_service.search_similar(
                    query_bytes, limit=max_results * 3
                )
                candidates.extend(vec_results)

        # Step 3: Graph expansion via NarrativeKG
        if narrative_kg and entities:
            expanded_entities = await self._expand_via_narrative_kg(
                entities, narrative_kg, entity_registry, max_hops
            )
            for entity in expanded_entities:
                entity_chunks = self._get_chunks_for_entity(entity)
                candidates.extend(entity_chunks)

        # Step 4: Deduplicate
        seen: set = set()
        unique_candidates: List[Tuple[str, float]] = []
        for chunk_id, dist in candidates:
            if chunk_id not in seen:
                seen.add(chunk_id)
                unique_candidates.append((chunk_id, dist))

        # Step 5: Rerank
        reranked = self._rerank_candidates(
            unique_candidates,
            entities,
            chapter_decay_fn=self._chapter_distance_decay,
            current_chapter=self._current_chapter,
        )

        # Step 6: Return top-K
        results: List[Dict[str, Any]] = []
        for chunk_id, score in reranked[:max_results]:
            chunk = self._get_chunk_content(chunk_id)
            if chunk:
                results.append(
                    {
                        "chunk_id": chunk_id,
                        "content": chunk,
                        "score": score,
                        "entities": self._get_chunk_entities(chunk_id),
                    }
                )

        return results

    # ------------------------------------------------------------------
    # LeanRAG helper methods
    # ------------------------------------------------------------------

    @staticmethod
    def _floats_to_bytes(floats: List[float]) -> bytes:
        """Convert a list of floats to raw float32 bytes for sqlite-vec."""
        import struct

        return struct.pack(f"{len(floats)}f", *floats)

    @staticmethod
    def _chapter_distance_decay(distance: int) -> float:
        """Chapter-distance decay: 1 / log2(distance + 2).

        Returns 1.0 for distance 0 and decays towards 0 for larger gaps.
        """
        if distance <= 0:
            return 1.0
        return 1.0 / math.log2(distance + 2)

    @property
    def _current_chapter(self) -> int:
        """Current chapter number from context manager stats."""
        return int(self.cm.get_stats().get("max_chapter", 0))

    def _get_chunk_entities(self, chunk_id: str) -> List[str]:
        """Get entity names mentioned in a chunk.

        Looks up the chunk content from the vectors table and extracts
        Chinese name tokens (2-4 chars) as a proxy for entity mentions.
        """
        content = self._get_chunk_content(chunk_id)
        if not content:
            return []
        return re.findall(r"[一-鿿]{2,4}", content)

    def _get_chunk_chapter(self, chunk_id: str) -> Optional[int]:
        """Get the chapter order for a chunk."""
        with self.cm._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT chapter_id FROM vectors WHERE chunk_id = ?",
                (chunk_id,),
            )
            row = cursor.fetchone()
            return int(row[0]) if row and row[0] is not None else None

    def _get_chunks_for_entity(self, entity: str) -> List[Tuple[str, float]]:
        """Find chunks mentioning an entity.

        Returns list of ``(chunk_id, 0.0)`` pairs — distance is 0.0 because
        these are exact entity matches rather than vector-distance results.
        """
        results: List[Tuple[str, float]] = []
        with self.cm._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT chunk_id, content FROM vectors ORDER BY chapter_id DESC"
            )
            for chunk_id, content in cursor.fetchall():
                if content and entity in str(content):
                    results.append((chunk_id, 0.0))
        return results

    def _get_chunk_content(self, chunk_id: str) -> Optional[str]:
        """Get the text content of a chunk by ID."""
        with self.cm._get_conn() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT content FROM vectors WHERE chunk_id = ?",
                (chunk_id,),
            )
            row = cursor.fetchone()
            return str(row[0]) if row and row[0] else None
