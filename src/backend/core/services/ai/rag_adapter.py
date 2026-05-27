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

from backend.services.context_manager import ContextManager, TextChunk
from backend.core.services.ai.ai_service import ai_service

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
            except Exception as exc:
                logger.warning("Could not initialize embedding provider: %s", exc)
                self._degraded_mode_reason = "embedding_provider_unavailable"
                return [None] * len(texts)

        # Use the provider's embedding capability if available
        # Since our AIProvider interface doesn't define embed(), we use
        # a lightweight HTTP call to MiniMax's embedding endpoint
        try:
            return await self._embed_via_minimax(texts)
        except Exception as exc:
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
            except Exception as exc:
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
        except Exception as exc:
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
