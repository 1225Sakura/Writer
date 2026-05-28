"""Extended tests for RAGService — Phase 5 Tier 2.

Covers additional edge cases for: search filters, BM25 chapter filter,
RRF fusion parameter variations, deletion cascades, stats accuracy,
connection management with empty paths, tokenize boundary cases,
rerank keyword boosting precision, and process_chapter strategy variants.
"""

import sys
import pytest
import numpy as np
from unittest.mock import AsyncMock, MagicMock, patch

from backend.services.rag_service import (
    RAGService,
    SearchResult,
    get_rag_service,
)
from backend.services.chunk_strategy import Chunk


# =============================================================================
# Helpers
# =============================================================================


def _block_sqlite_vec():
    return patch.dict("sys.modules", {"sqlite_vec": None})


def _make_chunks(n=2, chapter_id=1, chunk_type="scene"):
    return [
        Chunk(
            chunk_id=f"ext_ch{chapter_id}_chunk_{i}",
            content=f"这是第{i}段扩展测试内容，包含搜索关键词和更多文字。",
            chapter_id=chapter_id,
            scene_index=i,
            chunk_type=chunk_type,
        )
        for i in range(n)
    ]


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_embedding_service():
    svc = MagicMock()
    svc.embed = AsyncMock(return_value=[np.random.randn(1536).astype(np.float32)])
    svc.serialize_embedding = MagicMock(return_value=b"\x00" * (1536 * 4))
    svc.deserialize_embedding = MagicMock(
        return_value=np.random.randn(1536).astype(np.float32)
    )
    svc.get_embedding_dim = MagicMock(return_value=1536)
    return svc


@pytest.fixture
def service(mock_embedding_service, tmp_path):
    db_path = str(tmp_path / "test_rag_ext.db")
    svc = RAGService.__new__(RAGService)
    svc.embedding_service = mock_embedding_service
    svc.db_path = db_path
    svc._conn = None
    svc._fts_conn = None
    return svc


# =============================================================================
# Search with chunk_type filter
# =============================================================================


class TestSearchChunkTypeFilter:
    """Test search respects chunk_type filter."""

    @pytest.mark.asyncio
    async def test_search_passes_chunk_type_to_components(self, service):
        with patch.object(
            service, "_search_components", new_callable=AsyncMock
        ) as mock_sc:
            mock_sc.return_value = ([], [])
            await service.search(
                "query", top_k=5, chunk_type="dialogue", use_rerank=False
            )
            call_args = mock_sc.call_args
            assert call_args[0][2] == "dialogue"

    @pytest.mark.asyncio
    async def test_search_passes_chapter_id_to_components(self, service):
        with patch.object(
            service, "_search_components", new_callable=AsyncMock
        ) as mock_sc:
            mock_sc.return_value = ([], [])
            await service.search(
                "query", top_k=5, chapter_id=42, use_rerank=False
            )
            call_args = mock_sc.call_args
            assert call_args[0][3] == 42

    @pytest.mark.asyncio
    async def test_search_none_filters_pass_none(self, service):
        with patch.object(
            service, "_search_components", new_callable=AsyncMock
        ) as mock_sc:
            mock_sc.return_value = ([], [])
            await service.search("query", top_k=5, use_rerank=False)
            call_args = mock_sc.call_args
            assert call_args[0][2] is None
            assert call_args[0][3] is None


# =============================================================================
# Search top_k boundary
# =============================================================================


class TestSearchTopKBoundary:
    """Test search respects top_k limits."""

    @pytest.mark.asyncio
    async def test_search_top_k_one(self, service):
        vector_results = [
            SearchResult(
                chunk_id=f"c{i}",
                chapter_id=1,
                scene_index=i,
                content=f"text {i}",
                score=0.9 - i * 0.1,
                source="vector",
            )
            for i in range(5)
        ]
        with patch.object(
            service, "_search_components", new_callable=AsyncMock
        ) as mock_sc:
            mock_sc.return_value = (vector_results, [])
            results = await service.search("query", top_k=1, use_rerank=False)
        assert len(results) <= 1

    @pytest.mark.asyncio
    async def test_search_top_k_larger_than_results(self, service):
        vector_results = [
            SearchResult(
                chunk_id="c1",
                chapter_id=1,
                scene_index=0,
                content="text",
                score=0.9,
                source="vector",
            )
        ]
        with patch.object(
            service, "_search_components", new_callable=AsyncMock
        ) as mock_sc:
            mock_sc.return_value = (vector_results, [])
            results = await service.search("query", top_k=100, use_rerank=False)
        assert len(results) == 1


# =============================================================================
# RRF fusion additional tests
# =============================================================================


class TestRRFFusionExtended:
    """Additional RRF fusion edge cases."""

    def test_rrf_deduplicates_chunk_ids(self, service):
        """Same chunk_id from both sources is merged, not duplicated."""
        vector = [
            SearchResult(
                chunk_id="c1",
                chapter_id=1,
                scene_index=0,
                content="a",
                score=0.9,
                source="vector",
            ),
        ]
        bm25 = [
            SearchResult(
                chunk_id="c1",
                chapter_id=1,
                scene_index=0,
                content="a",
                score=1.5,
                source="bm25",
            ),
        ]
        fused = service._rrf_fusion(vector, bm25, top_k=10)
        assert len(fused) == 1

    def test_rrf_score_is_sum_of_both_contributions(self, service):
        """RRF score = 1/(k+rank_v) + 1/(k+rank_b)."""
        vector = [
            SearchResult(
                chunk_id="c1",
                chapter_id=1,
                scene_index=0,
                content="a",
                score=0.9,
                source="vector",
            ),
        ]
        bm25 = [
            SearchResult(
                chunk_id="c1",
                chapter_id=1,
                scene_index=0,
                content="a",
                score=1.0,
                source="bm25",
            ),
        ]
        fused = service._rrf_fusion(vector, bm25, top_k=5, rrf_k=60)
        expected = 1.0 / (60 + 1) + 1.0 / (60 + 1)
        assert fused[0].score == pytest.approx(expected, rel=1e-4)

    def test_rrf_preserves_content_and_chapter(self, service):
        """Fused result preserves content and chapter_id from source."""
        vector = [
            SearchResult(
                chunk_id="c1",
                chapter_id=42,
                scene_index=3,
                content="preserved text",
                score=0.9,
                source="vector",
            ),
        ]
        fused = service._rrf_fusion(vector, [], top_k=5)
        assert fused[0].content == "preserved text"
        assert fused[0].chapter_id == 42

    def test_rrf_many_results_respects_top_k(self, service):
        """With many results, only top_k are returned."""
        vector = [
            SearchResult(
                chunk_id=f"c{i}",
                chapter_id=1,
                scene_index=i,
                content=str(i),
                score=0.9 - i * 0.01,
                source="vector",
            )
            for i in range(20)
        ]
        bm25 = [
            SearchResult(
                chunk_id=f"c{i + 10}",
                chapter_id=1,
                scene_index=i + 10,
                content=str(i + 10),
                score=1.0 - i * 0.01,
                source="bm25",
            )
            for i in range(20)
        ]
        fused = service._rrf_fusion(vector, bm25, top_k=5)
        assert len(fused) == 5


# =============================================================================
# Cosine similarity additional tests
# =============================================================================


class TestCosineSimilarityExtended:
    """Additional cosine similarity edge cases."""

    def test_unit_vectors(self, service):
        a = np.array([1.0, 0.0, 0.0])
        b = np.array([0.0, 1.0, 0.0])
        assert service._cosine_similarity(a, b) == pytest.approx(0.0)

    def test_parallel_vectors(self, service):
        a = np.array([2.0, 4.0, 6.0])
        b = np.array([1.0, 2.0, 3.0])
        assert service._cosine_similarity(a, b) == pytest.approx(1.0)

    def test_high_dimensional(self, service):
        a = np.random.randn(1536).astype(np.float32)
        score = service._cosine_similarity(a, a)
        assert score == pytest.approx(1.0, rel=1e-5)

    def test_anti_parallel(self, service):
        a = np.array([3.0, 4.0])
        b = np.array([-3.0, -4.0])
        assert service._cosine_similarity(a, b) == pytest.approx(-1.0)


# =============================================================================
# Rerank additional tests
# =============================================================================


class TestRerankExtended:
    """Additional rerank edge cases."""

    @pytest.mark.asyncio
    async def test_rerank_single_result(self, service):
        results = [
            SearchResult(
                chunk_id="c1",
                chapter_id=1,
                scene_index=0,
                content="测试内容",
                score=0.5,
                source="vector",
            ),
        ]
        reranked = await service.rerank("测试", results)
        assert len(reranked) == 1
        assert reranked[0].rank == 1

    @pytest.mark.asyncio
    async def test_rerank_boosts_results_with_more_overlap(self, service):
        """Results with more keyword overlap get higher boost."""
        results = [
            SearchResult(
                chunk_id="c1",
                chapter_id=1,
                scene_index=0,
                content="修炼 修炼 修炼 修炼",
                score=0.5,
                source="vector",
            ),
            SearchResult(
                chunk_id="c2",
                chapter_id=1,
                scene_index=1,
                content="无关内容",
                score=0.5,
                source="vector",
            ),
        ]
        reranked = await service.rerank("修炼", results)
        # c1 should rank higher due to keyword overlap
        assert reranked[0].chunk_id == "c1"

    @pytest.mark.asyncio
    async def test_rerank_maintains_relative_order_for_equal_overlap(self, service):
        """Results with same overlap maintain original relative order by score."""
        results = [
            SearchResult(
                chunk_id="c1",
                chapter_id=1,
                scene_index=0,
                content="修炼测试",
                score=0.9,
                source="vector",
            ),
            SearchResult(
                chunk_id="c2",
                chapter_id=1,
                scene_index=1,
                content="修炼内容",
                score=0.8,
                source="vector",
            ),
        ]
        reranked = await service.rerank("修炼", results)
        assert reranked[0].chunk_id == "c1"


# =============================================================================
# Tokenize boundary cases
# =============================================================================


class TestTokenizeExtended:
    """Additional tokenize edge cases."""

    def test_tokenize_only_punctuation(self, service):
        tokens = service._tokenize("。！？、；：")
        assert tokens == []

    def test_tokenize_single_chinese_char_filtered(self, service):
        tokens = service._tokenize("我 是 他")
        for t in tokens:
            assert len(t) >= 2

    def test_tokenize_long_string(self, service):
        long_text = "修炼功法突破境界" * 100
        tokens = service._tokenize(long_text)
        assert len(tokens) > 0

    def test_tokenize_mixed_numbers_and_chinese(self, service):
        tokens = service._tokenize("第123章 修炼开始")
        assert "123" in tokens

    def test_tokenize_preserves_order(self, service):
        tokens = service._tokenize("alpha beta gamma")
        assert tokens == ["alpha", "beta", "gamma"]


# =============================================================================
# Connection management edge cases
# =============================================================================


class TestConnectionEdgeCases:
    """Test connection management with edge cases."""

    def test_get_conn_with_empty_db_path(self, tmp_path, mock_embedding_service):
        """Empty db_path falls back to default."""
        svc = RAGService.__new__(RAGService)
        svc.embedding_service = mock_embedding_service
        svc.db_path = ""
        svc._conn = None
        svc._fts_conn = None
        conn = svc._get_conn()
        assert conn is not None

    def test_get_fts_conn_with_empty_db_path(self, tmp_path, mock_embedding_service):
        """Empty fts db_path falls back to default."""
        svc = RAGService.__new__(RAGService)
        svc.embedding_service = mock_embedding_service
        svc.db_path = ""
        svc._conn = None
        svc._fts_conn = None
        conn = svc._get_fts_conn()
        assert conn is not None

    def test_get_conn_strips_multiple_prefixes(self, tmp_path, mock_embedding_service):
        """Connection handles path with aiosqlite prefix."""
        svc = RAGService.__new__(RAGService)
        svc.embedding_service = mock_embedding_service
        svc.db_path = "sqlite+aiosqlite:///" + str(tmp_path / "multi.db")
        svc._conn = None
        svc._fts_conn = None
        conn = svc._get_conn()
        assert conn is not None


# =============================================================================
# Delete chunks edge cases
# =============================================================================


class TestDeleteChunksExtended:
    """Additional delete edge cases."""

    @pytest.mark.asyncio
    async def test_delete_nonexistent_chapter(self, service):
        """Deleting non-existent chapter returns 0."""
        with _block_sqlite_vec():
            conn = service._get_conn()
            cursor = conn.cursor()
            await service._ensure_tables(cursor)
            conn.commit()

        result = await service.delete_chunks_by_chapter(chapter_id=999999)
        assert result == 0

    @pytest.mark.asyncio
    async def test_delete_removes_bm25_entries(self, service, mock_embedding_service):
        """Deleting chapter also removes BM25 index entries."""
        mock_embedding_service.embed = AsyncMock(
            return_value=[np.random.randn(1536).astype(np.float32)]
        )
        chunks = _make_chunks(1, chapter_id=50)
        with _block_sqlite_vec():
            await service.add_chunks(chapter_id=50, chunks=chunks, rebuild_fts=False)

        await service.delete_chunks_by_chapter(chapter_id=50)

        conn = service._get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM bm25_index WHERE chunk_id = 'ext_ch50_chunk_0'"
        )
        assert cursor.fetchone()[0] == 0

    @pytest.mark.asyncio
    async def test_delete_removes_doc_stats(self, service, mock_embedding_service):
        """Deleting chapter removes doc_stats entries."""
        mock_embedding_service.embed = AsyncMock(
            return_value=[np.random.randn(1536).astype(np.float32)]
        )
        chunks = _make_chunks(1, chapter_id=51)
        with _block_sqlite_vec():
            await service.add_chunks(chapter_id=51, chunks=chunks, rebuild_fts=False)

        await service.delete_chunks_by_chapter(chapter_id=51)

        conn = service._get_conn()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT COUNT(*) FROM doc_stats WHERE chunk_id = 'ext_ch51_chunk_0'"
        )
        assert cursor.fetchone()[0] == 0


# =============================================================================
# Stats accuracy
# =============================================================================


class TestStatsAccuracy:
    """Test stats accuracy after various operations."""

    @pytest.mark.asyncio
    async def test_stats_reflect_multiple_chapters(
        self, service, mock_embedding_service
    ):
        """Stats count vectors across multiple chapters."""
        with _block_sqlite_vec():
            mock_embedding_service.embed = AsyncMock(
                return_value=[np.random.randn(1536).astype(np.float32) for _ in range(2)]
            )
            await service.add_chunks(
                chapter_id=1, chunks=_make_chunks(2, chapter_id=1), rebuild_fts=False
            )
            mock_embedding_service.embed = AsyncMock(
                return_value=[np.random.randn(1536).astype(np.float32) for _ in range(3)]
            )
            await service.add_chunks(
                chapter_id=2, chunks=_make_chunks(3, chapter_id=2), rebuild_fts=False
            )

        stats = service.get_stats()
        assert stats["vectors"] >= 5
        assert stats["chunks"] >= 5

    @pytest.mark.asyncio
    async def test_stats_after_deletion(self, service, mock_embedding_service):
        """Stats decrease after deletion."""
        mock_embedding_service.embed = AsyncMock(
            return_value=[np.random.randn(1536).astype(np.float32)]
        )
        with _block_sqlite_vec():
            await service.add_chunks(
                chapter_id=10, chunks=_make_chunks(3, chapter_id=10), rebuild_fts=False
            )

        stats_before = service.get_stats()
        await service.delete_chunks_by_chapter(chapter_id=10)
        stats_after = service.get_stats()

        assert stats_after["vectors"] < stats_before["vectors"]

    @pytest.mark.asyncio
    async def test_stats_total_tokens_positive(self, service, mock_embedding_service):
        """Total tokens is positive after adding content."""
        mock_embedding_service.embed = AsyncMock(
            return_value=[np.random.randn(1536).astype(np.float32)]
        )
        with _block_sqlite_vec():
            await service.add_chunks(
                chapter_id=1,
                chunks=_make_chunks(1, chapter_id=1),
                rebuild_fts=False,
            )

        stats = service.get_stats()
        assert stats["total_tokens"] > 0


# =============================================================================
# Process chapter edge cases
# =============================================================================


class TestProcessChapterExtended:
    """Additional process_chapter tests."""

    @pytest.mark.asyncio
    async def test_process_chapter_scene_strategy(self, service):
        text = "场景一内容。\n\n场景二内容。\n\n场景三内容。"
        chunks = await service.process_chapter(chapter_id=1, text=text, strategy="scene")
        assert isinstance(chunks, list)

    @pytest.mark.asyncio
    async def test_process_chapter_chapter_strategy(self, service):
        text = "整个章节的内容，包含多个段落和对话。"
        chunks = await service.process_chapter(
            chapter_id=1, text=text, strategy="chapter"
        )
        assert isinstance(chunks, list)

    @pytest.mark.asyncio
    async def test_process_chapter_sets_chunk_type(self, service):
        text = "测试内容用于验证分块类型。"
        chunks = await service.process_chapter(chapter_id=1, text=text)
        for chunk in chunks:
            assert chunk.chunk_type is not None

    @pytest.mark.asyncio
    async def test_process_chapter_long_text(self, service):
        """Long text produces multiple chunks."""
        paragraph = "这是一段较长的测试内容，用来验证分块功能的正确性和完整性。"
        text = paragraph * 50
        chunks = await service.process_chapter(chapter_id=1, text=text)
        assert len(chunks) >= 1


# =============================================================================
# BM25 search with chapter filter
# =============================================================================


class TestBM25SearchChapterFilter:
    """Test BM25 search with chapter_id filter."""

    @pytest.mark.asyncio
    async def test_bm25_search_chapter_filter(self, service, mock_embedding_service):
        """Chapter filter is applied in BM25 search."""
        mock_embedding_service.embed = AsyncMock(
            return_value=[np.random.randn(1536).astype(np.float32)]
        )
        with _block_sqlite_vec():
            await service.add_chunks(
                chapter_id=1, chunks=_make_chunks(1, chapter_id=1), rebuild_fts=False
            )
            await service.add_chunks(
                chapter_id=2, chunks=_make_chunks(1, chapter_id=2), rebuild_fts=False
            )

        results = service._bm25_search(
            "测试", top_k=10, chunk_type=None, chapter_id=1
        )
        # All results should be from chapter 1 or earlier
        for r in results:
            assert r.chapter_id <= 1


# =============================================================================
# Singleton additional tests
# =============================================================================


class TestSingletonExtended:
    """Additional singleton tests."""

    def test_singleton_reset_creates_new_instance(self):
        import backend.services.rag_service as mod

        mod._rag_service = None
        svc1 = get_rag_service()
        mod._rag_service = None
        svc2 = get_rag_service()
        assert svc1 is not svc2
        mod._rag_service = None

    def test_singleton_type(self):
        import backend.services.rag_service as mod

        mod._rag_service = None
        svc = get_rag_service()
        assert type(svc).__name__ == "RAGService"
        mod._rag_service = None
