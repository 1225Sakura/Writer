"""Tests for RAGAdapter - vector search, BM25, hybrid, graph-hybrid retrieval."""

import math
import pytest
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

from backend.core.services.ai.rag_adapter import RAGAdapter, SearchResult


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


# =============================================================================
# SearchResult
# =============================================================================


class TestSearchResult:
    """Test SearchResult dataclass."""

    def test_basic_fields(self):
        r = SearchResult(
            chunk_id="c1", chapter_id=1, scene_index=0,
            content="hello", score=0.9, source="vector"
        )
        assert r.chunk_id == "c1"
        assert r.score == 0.9
        assert r.source == "vector"

    def test_optional_fields_default_none(self):
        r = SearchResult(
            chunk_id="c1", chapter_id=1, scene_index=0,
            content="text", score=0.5, source="bm25"
        )
        assert r.parent_chunk_id is None
        assert r.chunk_type is None
        assert r.source_file is None

    def test_all_fields_set(self):
        r = SearchResult(
            chunk_id="c1", chapter_id=1, scene_index=2,
            content="text", score=0.8, source="hybrid",
            parent_chunk_id="p1", chunk_type="scene", source_file="f.txt"
        )
        assert r.parent_chunk_id == "p1"
        assert r.chunk_type == "scene"
        assert r.source_file == "f.txt"


# =============================================================================
# __init__ / degraded_mode_reason
# =============================================================================


class TestRAGAdapterInit:
    """Test adapter initialization."""

    def test_init_with_context_manager(self, cm):
        adapter = RAGAdapter(context_manager=cm)
        assert adapter.cm is cm
        assert adapter.degraded_mode_reason is None

    def test_degraded_mode_reason_initially_none(self, cm):
        adapter = RAGAdapter(context_manager=cm)
        assert adapter.degraded_mode_reason is None


# =============================================================================
# _cosine_similarity
# =============================================================================


class TestCosineSimilarity:
    """Test cosine similarity helper."""

    def test_identical_vectors(self, adapter):
        a = [1.0, 0.0, 0.0]
        assert adapter._cosine_similarity(a, a) == pytest.approx(1.0)

    def test_orthogonal_vectors(self, adapter):
        a = [1.0, 0.0]
        b = [0.0, 1.0]
        assert adapter._cosine_similarity(a, b) == pytest.approx(0.0)

    def test_opposite_vectors(self, adapter):
        a = [1.0, 0.0]
        b = [-1.0, 0.0]
        assert adapter._cosine_similarity(a, b) == pytest.approx(-1.0)

    def test_zero_vector_returns_zero(self, adapter):
        a = [0.0, 0.0]
        b = [1.0, 0.0]
        assert adapter._cosine_similarity(a, b) == 0.0

    def test_partial_similarity(self, adapter):
        a = [1.0, 1.0]
        b = [1.0, 0.0]
        expected = 1.0 / math.sqrt(2)
        assert adapter._cosine_similarity(a, b) == pytest.approx(expected)


# =============================================================================
# _embed
# =============================================================================


class TestEmbed:
    """Test the _embed helper."""

    @pytest.mark.asyncio
    async def test_embed_empty_texts(self, adapter):
        result = await adapter._embed([])
        assert result == []

    @pytest.mark.asyncio
    async def test_embed_router_none_no_api_key_returns_nones(self, adapter):
        """When router is None and no API key, _embed_via_minimax returns Nones."""
        with patch("backend.core.services.ai.rag_adapter.ai_service") as mock_ai:
            mock_ai.router = MagicMock()  # not None, so it goes to _embed_via_minimax
            with patch.object(adapter, "_embed_via_minimax", new_callable=AsyncMock, return_value=[None]):
                result = await adapter._embed(["hello"])
                assert result == [None]

    @pytest.mark.asyncio
    async def test_embed_success(self, adapter):
        fake_embedding = [0.1, 0.2, 0.3]
        with patch.object(adapter, "_embed_via_minimax", new_callable=AsyncMock) as mock_minimax:
            mock_minimax.return_value = [fake_embedding]
            with patch("backend.core.services.ai.rag_adapter.ai_service") as mock_ai:
                mock_ai.router = MagicMock()
                result = await adapter._embed(["hello"])
                assert result == [fake_embedding]

    @pytest.mark.asyncio
    async def test_embed_failure_sets_degraded(self, adapter):
        with patch.object(adapter, "_embed_via_minimax", new_callable=AsyncMock) as mock_minimax:
            from backend.utils.exceptions import RAGError
            mock_minimax.side_effect = RAGError("fail")
            with patch("backend.core.services.ai.rag_adapter.ai_service") as mock_ai:
                mock_ai.router = MagicMock()
                result = await adapter._embed(["hello"])
                assert result == [None]
                assert adapter.degraded_mode_reason == "embedding_failed"


# =============================================================================
# _embed_via_minimax
# =============================================================================


class TestEmbedViaMinimax:
    """Test direct MiniMax embedding API call."""

    @pytest.mark.asyncio
    async def test_no_api_key_returns_nones(self, adapter):
        with patch("backend.config.settings") as mock_settings:
            mock_settings.minimax_api_key = None
            result = await adapter._embed_via_minimax(["a", "b"])
            assert result == [None, None]

    @pytest.mark.asyncio
    async def test_successful_api_call(self, adapter):
        fake_response = {
            "data": [
                {"index": 0, "embedding": [0.1, 0.2]},
                {"index": 1, "embedding": [0.3, 0.4]},
            ]
        }
        mock_resp = MagicMock()
        mock_resp.json.return_value = fake_response
        mock_resp.raise_for_status = MagicMock()

        with patch("backend.config.settings") as mock_settings:
            mock_settings.minimax_api_key = "test-key"
            mock_settings.minimax_api_url = "https://api.example.com/v1"
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.post.return_value = mock_resp
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client_cls.return_value = mock_client
                result = await adapter._embed_via_minimax(["a", "b"])
                assert len(result) == 2
                assert result[0] == [0.1, 0.2]
                assert result[1] == [0.3, 0.4]

    @pytest.mark.asyncio
    async def test_api_error_returns_nones(self, adapter):
        from backend.utils.exceptions import AIServiceError
        mock_resp = MagicMock()
        mock_resp.raise_for_status.side_effect = AIServiceError("HTTP 500")

        with patch("backend.config.settings") as mock_settings:
            mock_settings.minimax_api_key = "test-key"
            mock_settings.minimax_api_url = "https://api.example.com/v1"
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.post.return_value = mock_resp
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client_cls.return_value = mock_client
                result = await adapter._embed_via_minimax(["a"])
                assert result == [None]

    @pytest.mark.asyncio
    async def test_pads_fewer_results_than_inputs(self, adapter):
        """If API returns fewer embeddings than inputs, pad with None."""
        fake_response = {
            "data": [{"index": 0, "embedding": [0.1]}]
        }
        mock_resp = MagicMock()
        mock_resp.json.return_value = fake_response
        mock_resp.raise_for_status = MagicMock()

        with patch("backend.config.settings") as mock_settings:
            mock_settings.minimax_api_key = "test-key"
            mock_settings.minimax_api_url = "https://api.example.com/v1"
            with patch("httpx.AsyncClient") as mock_client_cls:
                mock_client = AsyncMock()
                mock_client.post.return_value = mock_resp
                mock_client.__aenter__ = AsyncMock(return_value=mock_client)
                mock_client.__aexit__ = AsyncMock(return_value=False)
                mock_client_cls.return_value = mock_client
                result = await adapter._embed_via_minimax(["a", "b"])
                assert len(result) == 2
                assert result[0] == [0.1]
                assert result[1] is None


# =============================================================================
# _extract_seed_entities
# =============================================================================


class TestExtractSeedEntities:
    """Test entity extraction from query text."""

    def test_center_entities_returned(self, adapter):
        result = adapter._extract_seed_entities("query", center_entities=["Alice", "Bob"])
        assert result == ["Alice", "Bob"]

    def test_center_entities_strips_whitespace(self, adapter):
        result = adapter._extract_seed_entities("query", center_entities=["  Alice  ", "  ", "Bob"])
        assert result == ["Alice", "Bob"]

    def test_chinese_names_extracted(self, adapter):
        result = adapter._extract_seed_entities("张三和李四一起去修炼")
        assert "张三和李四一起去修炼" not in result  # whole string is >8 chars
        # The regex extracts 2-8 char sequences
        assert len(result) > 0

    def test_english_words_extracted(self, adapter):
        result = adapter._extract_seed_entities("Alice and Bob are friends")
        assert len(result) > 0

    def test_empty_query_returns_empty(self, adapter):
        result = adapter._extract_seed_entities("")
        assert result == []

    def test_max_20_entities_via_regex(self, adapter):
        """Regex path limits to 20 tokens."""
        # Build a query with many 2-char Chinese tokens
        query = " ".join([f"名{i}" for i in range(30)])
        result = adapter._extract_seed_entities(query)
        assert len(result) <= 20


# =============================================================================
# _apply_graph_priors
# =============================================================================


class TestApplyGraphPriors:
    """Test graph prior boosting."""

    def test_entity_boost(self, adapter):
        r = SearchResult(
            chunk_id="c1", chapter_id=1, scene_index=0,
            content="张三在这里", score=0.5, source="vector"
        )
        score = adapter._apply_graph_priors(r, {"张三"}, max_chapter=5)
        assert score > 0.5  # entity boost applied

    def test_no_entity_no_boost(self, adapter):
        r = SearchResult(
            chunk_id="c1", chapter_id=1, scene_index=0,
            content="无关内容", score=0.5, source="vector"
        )
        score = adapter._apply_graph_priors(r, {"张三"}, max_chapter=5)
        # No entity match, but recency may add a tiny boost
        assert score >= 0.5

    def test_recency_boost_recent_chapter(self, adapter):
        r = SearchResult(
            chunk_id="c1", chapter_id=5, scene_index=0,
            content="text", score=0.5, source="vector"
        )
        score = adapter._apply_graph_priors(r, set(), max_chapter=5)
        # chapter_id == max_chapter -> gap=0 -> recency=1.0
        assert score == pytest.approx(0.5 + 0.05)

    def test_recency_decay_old_chapter(self, adapter):
        r = SearchResult(
            chunk_id="c1", chapter_id=0, scene_index=0,
            content="text", score=0.5, source="vector"
        )
        score = adapter._apply_graph_priors(r, set(), max_chapter=100)
        # gap=100 -> recency=0.0
        assert score == pytest.approx(0.5)

    def test_zero_max_chapter_no_recency(self, adapter):
        r = SearchResult(
            chunk_id="c1", chapter_id=1, scene_index=0,
            content="text", score=0.5, source="vector"
        )
        score = adapter._apply_graph_priors(r, set(), max_chapter=0)
        assert score == pytest.approx(0.5)


# =============================================================================
# _chunks (batch helper)
# =============================================================================


class TestChunksBatch:
    """Test the static _chunks batching helper."""

    def test_exact_batch(self, adapter):
        items = list(range(10))
        batches = list(adapter._chunks(items, 5))
        assert len(batches) == 2
        assert batches[0] == list(range(5))
        assert batches[1] == list(range(5, 10))

    def test_partial_batch(self, adapter):
        items = list(range(7))
        batches = list(adapter._chunks(items, 5))
        assert len(batches) == 2
        assert batches[1] == [5, 6]

    def test_empty_list(self, adapter):
        batches = list(adapter._chunks([], 5))
        assert batches == []

    def test_single_batch(self, adapter):
        items = list(range(3))
        batches = list(adapter._chunks(items, 5))
        assert len(batches) == 1
        assert batches[0] == [0, 1, 2]


# =============================================================================
# _vector_search_rows
# =============================================================================


class TestVectorSearchRows:
    """Test vector search over raw rows."""

    def test_returns_sorted_by_score(self, adapter):
        emb_a = [1.0, 0.0, 0.0]
        emb_b = [0.0, 1.0, 0.0]
        query_emb = [1.0, 0.0, 0.0]

        adapter.cm._deserialize_embedding.side_effect = [emb_a, emb_b]
        rows = [
            ("c1", 1, 0, "text a", b"emb1", None, "scene", None),
            ("c2", 1, 1, "text b", b"emb2", None, "scene", None),
        ]
        results = adapter._vector_search_rows(query_emb, rows, top_k=10)
        assert len(results) == 2
        assert results[0].chunk_id == "c1"  # higher similarity
        assert results[0].score > results[1].score

    def test_respects_top_k(self, adapter):
        adapter.cm._deserialize_embedding.return_value = [1.0, 0.0]
        rows = [
            (f"c{i}", 1, i, f"text {i}", b"emb", None, "scene", None)
            for i in range(10)
        ]
        results = adapter._vector_search_rows([1.0, 0.0], rows, top_k=3)
        assert len(results) == 3

    def test_skips_null_embeddings(self, adapter):
        rows = [
            ("c1", 1, 0, "text", None, None, "scene", None),
        ]
        results = adapter._vector_search_rows([1.0], rows, top_k=10)
        assert len(results) == 0


# =============================================================================
# _collect_graph_candidates
# =============================================================================


class TestCollectGraphCandidates:
    """Test graph candidate collection from database."""

    def test_empty_entities_returns_empty(self, adapter):
        result = adapter._collect_graph_candidates([])
        assert result == []

    def test_finds_matching_chunks(self, adapter):
        conn = _make_conn(rows=[
            ("c1", 1, "张三在这里修炼"),
            ("c2", 2, "李四走了过来"),
            ("c3", 3, "无关内容"),
        ])
        adapter.cm._get_conn = MagicMock(return_value=conn)
        result = adapter._collect_graph_candidates(["张三"], chapter_id=None)
        assert "c1" in result
        # c2 and c3 don't contain "张三"
        assert len(result) >= 1

    def test_with_chapter_filter(self, adapter):
        conn = _make_conn(rows=[
            ("c1", 1, "张三修炼"),
        ])
        adapter.cm._get_conn = MagicMock(return_value=conn)
        result = adapter._collect_graph_candidates(["张三"], chapter_id=5)
        # Should have executed SQL with chapter_id filter
        cursor = conn.cursor()
        cursor.execute.assert_called_once()
        sql = cursor.execute.call_args[0][0]
        assert "chapter_id <=" in sql


# =============================================================================
# _log_query
# =============================================================================


class TestLogQuery:
    """Test query logging."""

    def test_log_query_calls_cm(self, adapter):
        results = [
            SearchResult("c1", 1, 0, "text", 0.9, "vector", chunk_type="scene"),
            SearchResult("c2", 2, 0, "text", 0.8, "vector", chunk_type="chapter"),
        ]
        adapter._log_query("test query", "vector", results, 42, chapter_id=1)
        adapter.cm.log_query.assert_called_once()
        call_args = adapter.cm.log_query.call_args[0]
        assert call_args[0] == "test query"
        assert call_args[1] == "vector"
        assert call_args[2] == 2
        assert call_args[4] == 42


# =============================================================================
# bm25_search
# =============================================================================


class TestBM25Search:
    """Test BM25 keyword search."""

    def test_empty_query_returns_empty(self, adapter):
        adapter.cm._tokenize.return_value = []
        result = adapter.bm25_search("")
        assert result == []

    def test_basic_bm25_search(self, adapter):
        adapter.cm._tokenize.return_value = ["修炼", "功法"]
        conn = MagicMock()
        cursor = MagicMock()

        # fetchone calls in order:
        # 1. doc_stats -> (count, avg_length)
        # 2. vectors content for c1
        cursor.fetchone.side_effect = [
            (10, 50.0),  # doc_stats
            (1, 0, "内容", None, "scene", None),  # vectors content for c1
        ]
        # fetchall calls in order:
        # 1. bm25_index for term "修炼"
        # 2. bm25_index for term "功法"
        cursor.fetchall.side_effect = [
            [("c1", 3, 50)],  # bm25_index results for "修炼"
            [("c1", 2, 50)],  # bm25_index results for "功法"
        ]
        conn.cursor.return_value = cursor
        conn.__enter__ = MagicMock(return_value=conn)
        conn.__exit__ = MagicMock(return_value=False)
        adapter.cm._get_conn = MagicMock(return_value=conn)

        results = adapter.bm25_search("修炼功法", log_query=False)
        assert len(results) >= 1
        assert results[0].source == "bm25"

    def test_bm25_with_chunk_type_filter(self, adapter):
        adapter.cm._tokenize.return_value = ["测试"]
        conn = MagicMock()
        cursor = MagicMock()
        cursor.fetchone.return_value = (10, 50.0)
        cursor.fetchall.return_value = [("c1", 2, 50)]
        cursor.fetchone.side_effect = [
            (10, 50.0),  # doc_stats
            (1, 0, "text", None, "scene", None),  # vectors
        ]
        conn.cursor.return_value = cursor
        conn.__enter__ = MagicMock(return_value=conn)
        conn.__exit__ = MagicMock(return_value=False)
        adapter.cm._get_conn = MagicMock(return_value=conn)

        results = adapter.bm25_search("测试", chunk_type="scene", log_query=False)
        # Should have called with chunk_type filter
        assert isinstance(results, list)


# =============================================================================
# vector_search
# =============================================================================


class TestVectorSearch:
    """Test cosine similarity vector search."""

    @pytest.mark.asyncio
    async def test_embed_failure_returns_empty(self, adapter):
        adapter.cm._get_conn = MagicMock(return_value=_make_conn())
        with patch.object(adapter, "_embed", new_callable=AsyncMock, return_value=[None]):
            results = await adapter.vector_search("query")
            assert results == []

    @pytest.mark.asyncio
    async def test_vector_search_with_results(self, adapter):
        conn = _make_conn(rows=[
            ("c1", 1, 0, "text", b"emb", None, "scene", None),
        ])
        adapter.cm._get_conn = MagicMock(return_value=conn)
        adapter.cm._deserialize_embedding.return_value = [1.0, 0.0, 0.0]

        with patch.object(adapter, "_embed", new_callable=AsyncMock, return_value=[[1.0, 0.0, 0.0]]):
            results = await adapter.vector_search("query", log_query=False)
            assert len(results) == 1
            assert results[0].source == "vector"

    @pytest.mark.asyncio
    async def test_vector_search_respects_top_k(self, adapter):
        rows = [(f"c{i}", 1, i, f"text{i}", b"emb", None, "scene", None) for i in range(20)]
        conn = _make_conn(rows=rows)
        adapter.cm._get_conn = MagicMock(return_value=conn)
        adapter.cm._deserialize_embedding.return_value = [1.0, 0.0]

        with patch.object(adapter, "_embed", new_callable=AsyncMock, return_value=[[1.0, 0.0]]):
            results = await adapter.vector_search("query", top_k=5, log_query=False)
            assert len(results) <= 5


# =============================================================================
# search (unified entry)
# =============================================================================


class TestSearchUnified:
    """Test the unified search entry point."""

    @pytest.mark.asyncio
    async def test_strategy_vector(self, adapter):
        with patch.object(adapter, "vector_search", new_callable=AsyncMock) as mock_vs:
            mock_vs.return_value = []
            await adapter.search("q", strategy="vector")
            mock_vs.assert_called_once()

    @pytest.mark.asyncio
    async def test_strategy_bm25(self, adapter):
        with patch.object(adapter, "bm25_search") as mock_bm:
            mock_bm.return_value = []
            await adapter.search("q", strategy="bm25")
            mock_bm.assert_called_once()

    @pytest.mark.asyncio
    async def test_strategy_bm25_fallback(self, adapter):
        with patch.object(adapter, "bm25_search") as mock_bm:
            mock_bm.return_value = []
            await adapter.search("q", strategy="bm25_fallback")
            mock_bm.assert_called_once()

    @pytest.mark.asyncio
    async def test_strategy_graph_hybrid(self, adapter):
        with patch.object(adapter, "graph_hybrid_search", new_callable=AsyncMock) as mock_gh:
            mock_gh.return_value = []
            await adapter.search("q", strategy="graph_hybrid")
            mock_gh.assert_called_once()

    @pytest.mark.asyncio
    async def test_strategy_hybrid(self, adapter):
        with patch.object(adapter, "hybrid_search", new_callable=AsyncMock) as mock_h:
            mock_h.return_value = []
            await adapter.search("q", strategy="hybrid")
            mock_h.assert_called_once()

    @pytest.mark.asyncio
    async def test_strategy_auto_with_graph_enabled(self, adapter):
        adapter.cm.get_stats.return_value = {"vectors": 100}
        adapter.cm.config["graph_rag_enabled"] = True
        with patch.object(adapter, "graph_hybrid_search", new_callable=AsyncMock) as mock_gh:
            mock_gh.return_value = []
            await adapter.search("q", strategy="auto")
            mock_gh.assert_called_once()

    @pytest.mark.asyncio
    async def test_strategy_auto_no_vectors(self, adapter):
        adapter.cm.get_stats.return_value = {"vectors": 0}
        with patch.object(adapter, "bm25_search") as mock_bm:
            mock_bm.return_value = []
            await adapter.search("q", strategy="auto")
            mock_bm.assert_called_once()

    @pytest.mark.asyncio
    async def test_strategy_auto_vectors_no_graph(self, adapter):
        adapter.cm.get_stats.return_value = {"vectors": 100}
        adapter.cm.config["graph_rag_enabled"] = False
        with patch.object(adapter, "hybrid_search", new_callable=AsyncMock) as mock_h:
            mock_h.return_value = []
            await adapter.search("q", strategy="auto")
            mock_h.assert_called_once()

    @pytest.mark.asyncio
    async def test_filters_to_chapter_id(self, adapter):
        with patch.object(adapter, "bm25_search") as mock_bm:
            mock_bm.return_value = []
            await adapter.search("q", strategy="bm25", filters={"to_chapter": "5"})
            call_kwargs = mock_bm.call_args[1]
            assert call_kwargs.get("chapter_id") == 5

    @pytest.mark.asyncio
    async def test_none_strategy_defaults_to_auto(self, adapter):
        adapter.cm.get_stats.return_value = {"vectors": 0}
        with patch.object(adapter, "bm25_search") as mock_bm:
            mock_bm.return_value = []
            await adapter.search("q", strategy=None)
            mock_bm.assert_called_once()


# =============================================================================
# graph_hybrid_search
# =============================================================================


class TestGraphHybridSearch:
    """Test graph-enhanced hybrid search."""

    @pytest.mark.asyncio
    async def test_graph_disabled_falls_back_to_hybrid(self, adapter):
        adapter.cm.config["graph_rag_enabled"] = False
        base_results = [
            SearchResult("c1", 1, 0, "text", 0.9, "hybrid"),
        ]
        with patch.object(adapter, "hybrid_search", new_callable=AsyncMock, return_value=base_results):
            results = await adapter.graph_hybrid_search("query", top_k=5, log_query=False)
            assert len(results) == 1
            # When graph is disabled, base results are returned with source unchanged
            assert results[0].chunk_id == "c1"

    @pytest.mark.asyncio
    async def test_no_seeds_falls_back_to_base(self, adapter):
        with patch.object(adapter, "hybrid_search", new_callable=AsyncMock, return_value=[
            SearchResult("c1", 1, 0, "text", 0.9, "hybrid"),
        ]):
            with patch.object(adapter, "_extract_seed_entities", return_value=[]):
                results = await adapter.graph_hybrid_search("a", top_k=5, log_query=False)
                assert len(results) == 1

    @pytest.mark.asyncio
    async def test_full_graph_pipeline(self, adapter):
        base_results = [SearchResult("c1", 1, 0, "text", 0.5, "hybrid")]
        graph_results = [SearchResult("c2", 2, 0, "张三text", 0.8, "vector")]

        with patch.object(adapter, "hybrid_search", new_callable=AsyncMock, return_value=base_results):
            with patch.object(adapter, "_extract_seed_entities", return_value=["张三"]):
                with patch.object(adapter, "_expand_entities", new_callable=AsyncMock, return_value=["张三", "李四"]):
                    with patch.object(adapter, "_collect_graph_candidates", return_value=["c2"]):
                        with patch.object(adapter, "_vector_search_candidates", new_callable=AsyncMock, return_value=graph_results):
                            results = await adapter.graph_hybrid_search("张三的故事", top_k=5, log_query=False)
                            assert len(results) >= 1
                            for r in results:
                                assert r.source == "graph_hybrid"
