"""Tests for LeanRAG-style retrieval pipeline in RAGAdapter.

Covers:
- Entity extraction from Chinese queries
- Graph expansion via NarrativeKG
- Candidate reranking with entity overlap + decay + recency
- End-to-end leanrag_search pipeline
"""

import math
import struct
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.core.services.ai.rag_adapter import RAGAdapter, SearchResult
from backend.services.narrative_kg import NarrativeKG, NarrativeNode, NarrativeEdge
from backend.services.entity_registry import EntityRegistry, EntityRecord


# =============================================================================
# Fixtures
# =============================================================================


def _make_cm(**config_overrides):
    """Create a mock ContextManager with sensible defaults."""
    cm = MagicMock()
    config = {
        "vector_top_k": 10,
        "bm25_top_k": 10,
        "rerank_top_n": 5,
        "rrf_k": 60,
        "vector_full_scan_max_vectors": 5000,
        "graph_rag_enabled": True,
        "graph_rag_max_expanded_entities": 20,
        "graph_rag_candidate_limit": 100,
        "graph_rag_boost_same_entity": 0.15,
        "graph_rag_boost_recency": 0.05,
        "vector_prefilter_bm25_candidates": 200,
    }
    config.update(config_overrides)
    cm.config = config
    cm.get_stats.return_value = {"vectors": 100, "max_chapter": 5}
    cm._tokenize.side_effect = lambda text: [
        t for t in text.split() if len(t) >= 2
    ]
    cm._deserialize_embedding.side_effect = lambda b: [0.1] * 8
    cm.log_query = MagicMock()
    return cm


def _make_conn(rows=None):
    """Create a mock sqlite connection returning given rows."""
    conn = MagicMock()
    cursor = MagicMock()
    cursor.fetchall.return_value = rows or []
    cursor.fetchone.return_value = None
    conn.cursor.return_value = cursor
    conn.__enter__ = MagicMock(return_value=conn)
    conn.__exit__ = MagicMock(return_value=False)
    return conn


@pytest.fixture
def cm():
    return _make_cm()


@pytest.fixture
def adapter(cm):
    return RAGAdapter(context_manager=cm)


@pytest.fixture
def entity_registry():
    """EntityRegistry with a few test entities."""
    registry = EntityRegistry()
    registry.register(EntityRecord(
        canonical_id=1, entity_type="character", canonical_name="张三",
        aliases=["小张"],
    ))
    registry.register(EntityRecord(
        canonical_id=2, entity_type="character", canonical_name="李四",
        aliases=["小李"],
    ))
    registry.register(EntityRecord(
        canonical_id=3, entity_type="location", canonical_name="青云山",
        aliases=[],
    ))
    return registry


@pytest.fixture
def narrative_kg():
    """NarrativeKG with a small test graph.

    Graph:
        张三 --allies_with--> 李四
        李四 --located_in--> 青云山
        张三 --antagonist_of--> 王五
    """
    kg = NarrativeKG()
    kg.add_node(NarrativeNode(canonical_id=1, entity_type="character", name="张三"))
    kg.add_node(NarrativeNode(canonical_id=2, entity_type="character", name="李四"))
    kg.add_node(NarrativeNode(canonical_id=3, entity_type="location", name="青云山"))
    kg.add_node(NarrativeNode(canonical_id=4, entity_type="character", name="王五"))

    kg.add_edge(NarrativeEdge(source_id=1, target_id=2, relationship="allies_with"))
    kg.add_edge(NarrativeEdge(source_id=2, target_id=3, relationship="located_in"))
    kg.add_edge(NarrativeEdge(source_id=1, target_id=4, relationship="antagonist_of"))
    return kg


# =============================================================================
# test_extract_entities_from_query
# =============================================================================


class TestExtractEntitiesFromQuery:
    """Extract entity names from Chinese query text."""

    def test_basic_pattern_match(self, adapter):
        """Matches 'X的' pattern (entity followed by possessive particle)."""
        entities = adapter._extract_entities_from_query("张三的修炼功法")
        assert "张三" in entities

    def test_conjunction_pattern(self, adapter):
        """Matches 'X和Y的' pattern — names before particles."""
        entities = adapter._extract_entities_from_query("张三和李四的修炼")
        assert "张三" in entities
        assert "李四" in entities

    def test_role_label_pattern(self, adapter):
        """Matches '角色：X' pattern."""
        entities = adapter._extract_entities_from_query("角色：张三")
        assert "张三" in entities

    def test_with_entity_registry_resolves(self, adapter, entity_registry):
        """Resolves alias '小张' to canonical name '张三'."""
        entities = adapter._extract_entities_from_query(
            "小张的修炼", entity_registry=entity_registry
        )
        assert "张三" in entities

    def test_no_entities_returns_empty(self, adapter):
        """Query with no Chinese name patterns returns empty."""
        entities = adapter._extract_entities_from_query("hello world")
        assert entities == []

    def test_deduplicates(self, adapter):
        """Same entity appearing twice is deduplicated."""
        entities = adapter._extract_entities_from_query("张三的功法与张三的对决")
        assert entities.count("张三") == 1

    def test_unresolved_names_still_collected(self, adapter, entity_registry):
        """Names not in registry are still collected when no registry provided."""
        entities = adapter._extract_entities_from_query("赵六的故事")
        assert "赵六" in entities

    def test_unresolved_names_skipped_with_registry(self, adapter, entity_registry):
        """Names not in registry are skipped when registry is provided."""
        entities = adapter._extract_entities_from_query(
            "赵六的故事", entity_registry=entity_registry
        )
        assert "赵六" not in entities


# =============================================================================
# test_expand_via_narrative_kg
# =============================================================================


class TestExpandViaNarrativeKG:
    """Graph expansion adds related entities via NarrativeKG traversal."""

    @pytest.mark.asyncio
    async def test_one_hop_expansion(self, adapter, narrative_kg, entity_registry):
        """Expanding 张三 with 1 hop finds 李四 and 王五 (direct neighbors)."""
        expanded = await adapter._expand_via_narrative_kg(
            ["张三"], narrative_kg, entity_registry, max_hops=1
        )
        assert "张三" in expanded  # seed included
        assert "李四" in expanded  # 1-hop neighbor
        assert "王五" in expanded  # 1-hop neighbor

    @pytest.mark.asyncio
    async def test_two_hop_expansion(self, adapter, narrative_kg, entity_registry):
        """Expanding 张三 with 2 hops also finds 青云山 (via 李四)."""
        expanded = await adapter._expand_via_narrative_kg(
            ["张三"], narrative_kg, entity_registry, max_hops=2
        )
        assert "张三" in expanded
        assert "李四" in expanded
        assert "王五" in expanded
        assert "青云山" in expanded  # 2-hop via 李四 -> 青云山

    @pytest.mark.asyncio
    async def test_no_registry_returns_seeds_only(self, adapter, narrative_kg):
        """Without registry, cannot resolve seeds to IDs so only seeds returned."""
        expanded = await adapter._expand_via_narrative_kg(
            ["张三"], narrative_kg, entity_registry=None, max_hops=2
        )
        assert expanded == ["张三"]

    @pytest.mark.asyncio
    async def test_multiple_seeds(self, adapter, narrative_kg, entity_registry):
        """Multiple seed entities are all expanded."""
        expanded = await adapter._expand_via_narrative_kg(
            ["张三", "李四"], narrative_kg, entity_registry, max_hops=1
        )
        assert "张三" in expanded
        assert "李四" in expanded
        assert "王五" in expanded  # from 张三
        assert "青云山" in expanded  # from 李四

    @pytest.mark.asyncio
    async def test_empty_seeds(self, adapter, narrative_kg, entity_registry):
        """Empty seed list returns empty."""
        expanded = await adapter._expand_via_narrative_kg(
            [], narrative_kg, entity_registry, max_hops=2
        )
        assert expanded == []

    @pytest.mark.asyncio
    async def test_unknown_entity_no_crash(self, adapter, narrative_kg, entity_registry):
        """Unknown entity name (not in KG) is gracefully skipped."""
        expanded = await adapter._expand_via_narrative_kg(
            ["不存在"], narrative_kg, entity_registry, max_hops=2
        )
        assert expanded == ["不存在"]


# =============================================================================
# test_rerank_candidates
# =============================================================================


class TestRerankCandidates:
    """Reranking produces correct order by combined score."""

    def test_entity_overlap_higher_ranks_first(self, adapter):
        """Chunk with more entity overlap scores higher."""
        candidates = [
            ("chunk_no_overlap", 0.1),   # low vec distance, no overlap
            ("chunk_full_overlap", 0.3),  # higher vec distance, full overlap
        ]
        query_entities = ["张三", "李四"]

        # Mock _get_chunk_entities to return known entities per chunk
        def mock_entities(cid):
            if cid == "chunk_full_overlap":
                return ["张三", "李四"]
            return []

        def mock_chapter(cid):
            return 1

        with patch.object(adapter, "_get_chunk_entities", side_effect=mock_entities):
            with patch.object(adapter, "_get_chunk_chapter", side_effect=mock_chapter):
                result = adapter._rerank_candidates(
                    candidates, query_entities,
                    chapter_decay_fn=lambda d: 1.0,
                    current_chapter=5,
                )

        # chunk_full_overlap has overlap=1.0 * 0.4 = 0.4
        # chunk_no_overlap has overlap=0.0 * 0.4 = 0.0
        # Even with vec_dist difference, overlap dominates
        assert result[0][0] == "chunk_full_overlap"

    def test_decay_prefers_recent(self, adapter):
        """More recent chapter gets higher decay score."""
        candidates = [
            ("old_chunk", 0.2),
            ("new_chunk", 0.2),
        ]
        query_entities = []

        def mock_entities(cid):
            return []

        def mock_chapter(cid):
            if cid == "old_chunk":
                return 1
            return 5  # new_chunk is chapter 5

        with patch.object(adapter, "_get_chunk_entities", side_effect=mock_entities):
            with patch.object(adapter, "_get_chunk_chapter", side_effect=mock_chapter):
                result = adapter._rerank_candidates(
                    candidates, query_entities,
                    chapter_decay_fn=lambda d: 1.0 / math.log2(d + 2) if d > 0 else 1.0,
                    current_chapter=5,
                )

        # new_chunk: decay=1.0 (distance=0), old_chunk: decay=1/log2(6)~0.387
        assert result[0][0] == "new_chunk"

    def test_vec_distance_matters(self, adapter):
        """When entity overlap is equal, lower vec distance wins."""
        candidates = [
            ("close_chunk", 0.1),
            ("far_chunk", 0.9),
        ]
        query_entities = ["张三"]

        def mock_entities(cid):
            return ["张三"]  # same overlap for both

        def mock_chapter(cid):
            return 1  # same chapter for both

        with patch.object(adapter, "_get_chunk_entities", side_effect=mock_entities):
            with patch.object(adapter, "_get_chunk_chapter", side_effect=mock_chapter):
                result = adapter._rerank_candidates(
                    candidates, query_entities,
                    chapter_decay_fn=lambda d: 1.0,
                    current_chapter=5,
                )

        # close_chunk: (1-0.1)*0.4 + 1*0.4 + 1*0.2 = 0.36+0.4+0.2 = 0.96
        # far_chunk:   (1-0.9)*0.4 + 1*0.4 + 1*0.2 = 0.04+0.4+0.2 = 0.64
        assert result[0][0] == "close_chunk"

    def test_empty_candidates(self, adapter):
        """Empty input returns empty output."""
        result = adapter._rerank_candidates([], ["张三"])
        assert result == []

    def test_no_decay_fn(self, adapter):
        """Works without chapter_decay_fn (decay defaults to 1.0)."""
        candidates = [("c1", 0.5)]

        def mock_entities(cid):
            return []

        def mock_chapter(cid):
            return 1

        with patch.object(adapter, "_get_chunk_entities", side_effect=mock_entities):
            with patch.object(adapter, "_get_chunk_chapter", side_effect=mock_chapter):
                result = adapter._rerank_candidates(candidates, [])

        assert len(result) == 1
        assert result[0][0] == "c1"


# =============================================================================
# test_chapter_distance_decay
# =============================================================================


class TestChapterDistanceDecay:
    """Chapter-distance decay function."""

    def test_zero_distance_returns_one(self, adapter):
        assert RAGAdapter._chapter_distance_decay(0) == 1.0

    def test_negative_distance_returns_one(self, adapter):
        assert RAGAdapter._chapter_distance_decay(-5) == 1.0

    def test_positive_distance_decays(self, adapter):
        result = RAGAdapter._chapter_distance_decay(6)
        expected = 1.0 / math.log2(6 + 2)  # 1/log2(8) = 1/3
        assert result == pytest.approx(expected)

    def test_large_distance_approaches_zero(self, adapter):
        result = RAGAdapter._chapter_distance_decay(1000)
        assert result < 0.11  # 1/log2(1002) ~ 0.1003


# =============================================================================
# test_floats_to_bytes
# =============================================================================


class TestFloatsToBytes:
    """Convert float list to raw bytes for sqlite-vec."""

    def test_basic_conversion(self):
        floats = [1.0, 2.0, 3.0]
        result = RAGAdapter._floats_to_bytes(floats)
        unpacked = struct.unpack("3f", result)
        assert unpacked == pytest.approx((1.0, 2.0, 3.0))

    def test_empty_list(self):
        result = RAGAdapter._floats_to_bytes([])
        assert result == b""

    def test_single_float(self):
        result = RAGAdapter._floats_to_bytes([0.5])
        unpacked = struct.unpack("1f", result)
        assert unpacked == pytest.approx((0.5,))


# =============================================================================
# test_leanrag_search_end_to_end
# =============================================================================


class TestLeanRagSearchEndToEnd:
    """Full LeanRAG pipeline test with mocked dependencies."""

    @pytest.mark.asyncio
    async def test_full_pipeline(
        self, adapter, narrative_kg, entity_registry
    ):
        """Complete pipeline: entity extraction -> vec search -> graph expand -> rerank."""
        # Mock sqlite_vec_service
        mock_vec = MagicMock()
        mock_vec.search_similar.return_value = [
            ("c1", 0.3),
            ("c2", 0.5),
        ]

        # Mock embedding
        with patch.object(adapter, "_embed", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [[0.1] * 8]

            # Mock helper methods
            def mock_content(cid):
                mapping = {
                    "c1": "张三在这里修炼",
                    "c2": "李四走了过来",
                    "c3": "青云山很高",
                    "c4": "王五出现了",
                }
                return mapping.get(cid)

            def mock_entities(cid):
                mapping = {
                    "c1": ["张三"],
                    "c2": ["李四"],
                    "c3": ["青云山"],
                    "c4": ["王五"],
                }
                return mapping.get(cid, [])

            def mock_chapter(cid):
                mapping = {"c1": 1, "c2": 2, "c3": 3, "c4": 4}
                return mapping.get(cid)

            def mock_entity_chunks(entity):
                mapping = {
                    "张三": [("c1", 0.0)],
                    "李四": [("c2", 0.0)],
                    "青云山": [("c3", 0.0)],
                    "王五": [("c4", 0.0)],
                    "小张": [],
                }
                return mapping.get(entity, [])

            with patch.object(adapter, "_get_chunk_content", side_effect=mock_content):
                with patch.object(adapter, "_get_chunk_entities", side_effect=mock_entities):
                    with patch.object(adapter, "_get_chunk_chapter", side_effect=mock_chapter):
                        with patch.object(adapter, "_get_chunks_for_entity", side_effect=mock_entity_chunks):
                            results = await adapter.leanrag_search(
                                query="张三的修炼功法",
                                narrative_kg=narrative_kg,
                                entity_registry=entity_registry,
                                sqlite_vec_service=mock_vec,
                                max_results=10,
                                max_hops=2,
                            )

        # Should return results
        assert len(results) > 0

        # All results should have required keys
        for r in results:
            assert "chunk_id" in r
            assert "content" in r
            assert "score" in r
            assert "entities" in r

        # Results should be sorted by score (descending)
        scores = [r["score"] for r in results]
        assert scores == sorted(scores, reverse=True)

        # c1 (张三) should rank highly due to entity overlap
        chunk_ids = [r["chunk_id"] for r in results]
        assert "c1" in chunk_ids

    @pytest.mark.asyncio
    async def test_no_services_returns_empty(self, adapter):
        """Without any services, returns empty results."""
        with patch.object(adapter, "_embed", new_callable=AsyncMock, return_value=[None]):
            results = await adapter.leanrag_search(
                query="测试查询",
                narrative_kg=None,
                entity_registry=None,
                sqlite_vec_service=None,
            )
        assert results == []

    @pytest.mark.asyncio
    async def test_vec_only_no_kg(self, adapter):
        """Pipeline works with only sqlite_vec_service (no NarrativeKG)."""
        mock_vec = MagicMock()
        mock_vec.search_similar.return_value = [
            ("c1", 0.2),
            ("c2", 0.4),
        ]

        with patch.object(adapter, "_embed", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [[0.1] * 8]

            def mock_content(cid):
                return {"c1": "一些文字", "c2": "另一些文字"}.get(cid)

            def mock_entities(cid):
                return {"c1": ["角色"], "c2": []}.get(cid, [])

            def mock_chapter(cid):
                return {"c1": 1, "c2": 2}.get(cid)

            with patch.object(adapter, "_get_chunk_content", side_effect=mock_content):
                with patch.object(adapter, "_get_chunk_entities", side_effect=mock_entities):
                    with patch.object(adapter, "_get_chunk_chapter", side_effect=mock_chapter):
                        results = await adapter.leanrag_search(
                            query="角色的故事",
                            sqlite_vec_service=mock_vec,
                            max_results=5,
                        )

        assert len(results) == 2
        assert results[0]["chunk_id"] == "c1"  # lower distance

    @pytest.mark.asyncio
    async def test_kg_only_no_vec(self, adapter, narrative_kg, entity_registry):
        """Pipeline works with only NarrativeKG (no sqlite_vec_service)."""
        with patch.object(adapter, "_embed", new_callable=AsyncMock, return_value=[None]):

            def mock_content(cid):
                return {"c1": "张三修炼中", "c2": "李四旁观"}.get(cid)

            def mock_entities(cid):
                return {"c1": ["张三"], "c2": ["李四"]}.get(cid, [])

            def mock_chapter(cid):
                return {"c1": 1, "c2": 2}.get(cid)

            def mock_entity_chunks(entity):
                return {
                    "张三": [("c1", 0.0)],
                    "李四": [("c2", 0.0)],
                    "青云山": [],
                    "王五": [],
                    "小张": [],
                }.get(entity, [])

            with patch.object(adapter, "_get_chunk_content", side_effect=mock_content):
                with patch.object(adapter, "_get_chunk_entities", side_effect=mock_entities):
                    with patch.object(adapter, "_get_chunk_chapter", side_effect=mock_chapter):
                        with patch.object(adapter, "_get_chunks_for_entity", side_effect=mock_entity_chunks):
                            results = await adapter.leanrag_search(
                                query="张三的修炼",
                                narrative_kg=narrative_kg,
                                entity_registry=entity_registry,
                                max_results=10,
                                max_hops=2,
                            )

        assert len(results) >= 1
        chunk_ids = [r["chunk_id"] for r in results]
        assert "c1" in chunk_ids

    @pytest.mark.asyncio
    async def test_deduplication(self, adapter, entity_registry):
        """Duplicate chunks from vec search and graph expansion are deduplicated."""
        mock_vec = MagicMock()
        mock_vec.search_similar.return_value = [
            ("c1", 0.3),  # also returned by entity expansion
            ("c2", 0.5),
        ]

        with patch.object(adapter, "_embed", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [[0.1] * 8]

            def mock_content(cid):
                return {"c1": "张三的故事", "c2": "其他内容"}.get(cid)

            def mock_entities(cid):
                return {"c1": ["张三"], "c2": []}.get(cid, [])

            def mock_chapter(cid):
                return {"c1": 1, "c2": 2}.get(cid)

            def mock_entity_chunks(entity):
                return {"张三": [("c1", 0.0), ("c2", 0.0)]}.get(entity, [])

            with patch.object(adapter, "_get_chunk_content", side_effect=mock_content):
                with patch.object(adapter, "_get_chunk_entities", side_effect=mock_entities):
                    with patch.object(adapter, "_get_chunk_chapter", side_effect=mock_chapter):
                        with patch.object(adapter, "_get_chunks_for_entity", side_effect=mock_entity_chunks):
                            results = await adapter.leanrag_search(
                                query="张三的修炼",
                                entity_registry=entity_registry,
                                sqlite_vec_service=mock_vec,
                                max_results=10,
                            )

        # c1 appears in both vec and entity results but should be deduplicated
        chunk_ids = [r["chunk_id"] for r in results]
        assert chunk_ids.count("c1") == 1

    @pytest.mark.asyncio
    async def test_max_results_limit(self, adapter):
        """Results are capped at max_results."""
        mock_vec = MagicMock()
        mock_vec.search_similar.return_value = [
            (f"c{i}", 0.1 * i) for i in range(20)
        ]

        with patch.object(adapter, "_embed", new_callable=AsyncMock) as mock_embed:
            mock_embed.return_value = [[0.1] * 8]

            with patch.object(adapter, "_get_chunk_content", return_value="text"):
                with patch.object(adapter, "_get_chunk_entities", return_value=[]):
                    with patch.object(adapter, "_get_chunk_chapter", return_value=1):
                        results = await adapter.leanrag_search(
                            query="test",
                            sqlite_vec_service=mock_vec,
                            max_results=3,
                        )

        assert len(results) <= 3
