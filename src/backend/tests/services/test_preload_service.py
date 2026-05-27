"""Tests for PreloadService - cache preloading at startup."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from backend.services.preload_service import PreloadService


@pytest.fixture
def service():
    """Create a PreloadService with mocked cache."""
    return PreloadService(tiered_cache=None)


# =============================================================================
# get_preload_summary
# =============================================================================

class TestPreloadSummary:
    """Test preload summary reporting."""

    def test_initial_summary_in_progress(self, service):
        """Initial summary shows in_progress status."""
        summary = service.get_preload_summary()
        assert summary["status"] == "in_progress"
        assert summary["total_items"] == 0
        assert summary["elapsed_ms"] == 0.0

    def test_summary_after_completion(self, service):
        """Summary after completion shows completed status."""
        service._stats["completed_at"] = 1.0
        service._stats["elapsed_ms"] = 100.0
        service._stats["total_items"] = 42
        summary = service.get_preload_summary()
        assert summary["status"] == "completed"
        assert summary["total_items"] == 42

    def test_summary_has_categories(self, service):
        """Summary includes categories dict."""
        summary = service.get_preload_summary()
        assert "categories" in summary
        assert "errors" in summary


# =============================================================================
# _safe_preload
# =============================================================================

class TestSafePreload:
    """Test safe preload execution."""

    @pytest.mark.asyncio
    async def test_safe_preload_records_count(self, service):
        """_safe_preload records the count from the coroutine."""
        async def mock_preload():
            return 5

        await service._safe_preload("test_category", mock_preload)
        assert service._stats["categories"]["test_category"]["count"] == 5
        assert service._stats["total_items"] == 5

    @pytest.mark.asyncio
    async def test_safe_preload_handles_database_error(self, service):
        """_safe_preload catches DatabaseError and records it."""
        from backend.utils.exceptions import DatabaseError

        async def failing_preload():
            raise DatabaseError("DB connection failed")

        await service._safe_preload("failing", failing_preload)
        assert service._stats["categories"]["failing"]["count"] == 0
        assert len(service._stats["errors"]) == 1
        assert "failing" in service._stats["errors"][0]

    @pytest.mark.asyncio
    async def test_safe_preload_accumulates_total(self, service):
        """Multiple preloads accumulate total_items."""
        async def preload_a():
            return 3

        async def preload_b():
            return 7

        await service._safe_preload("a", preload_a)
        await service._safe_preload("b", preload_b)
        assert service._stats["total_items"] == 10


# =============================================================================
# preload_all (mocked DB)
# =============================================================================

class TestPreloadAll:
    """Test full preload execution with mocked DB."""

    @pytest.mark.asyncio
    async def test_preload_all_returns_summary(self, service):
        """preload_all returns a summary dict."""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("backend.services.preload_service.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            with patch("backend.services.preload_service.get_cache_service") as mock_cache:
                mock_cache.return_value = MagicMock()

                summary = await service.preload_all()
                assert summary["status"] == "completed"
                assert summary["total_items"] == 0
                assert summary["elapsed_ms"] > 0

    @pytest.mark.asyncio
    async def test_preload_all_has_all_categories(self, service):
        """preload_all reports all preload categories."""
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("backend.services.preload_service.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            with patch("backend.services.preload_service.get_cache_service") as mock_cache:
                mock_cache.return_value = MagicMock()

                summary = await service.preload_all()
                categories = summary["categories"]
                expected = [
                    "settings", "recent_chapters", "active_outlines",
                    "characters", "world_settings", "rules",
                    "items", "locations", "factions",
                ]
                for cat in expected:
                    assert cat in categories


# =============================================================================
# _cache_set
# =============================================================================

class TestCacheSet:
    """Test cache set helper."""

    def test_cache_set_calls_cache_service(self, service):
        """_cache_set stores value in cache_service."""
        with patch("backend.services.preload_service.get_cache_service") as mock_get:
            mock_cache = MagicMock()
            mock_get.return_value = mock_cache

            service._cache_set("test", "key1", {"data": "value"}, ttl=300)
            mock_cache.set.assert_called_once_with("test", "key1", {"data": "value"}, ttl=300)

    def test_cache_set_with_tiered_cache(self):
        """_cache_set also stores in TieredCache if provided."""
        mock_tiered = MagicMock()
        service = PreloadService(tiered_cache=mock_tiered)

        with patch("backend.services.preload_service.get_cache_service") as mock_get:
            mock_get.return_value = MagicMock()

            service._cache_set("test", "key1", {"data": "value"}, ttl=300)
            mock_tiered.set.assert_called_once_with("key1", {"data": "value"}, ttl=300, tier="l1")


# =============================================================================
# RECENT_CHAPTERS_LIMIT
# =============================================================================

class TestConstants:
    """Test class constants."""

    def test_recent_chapters_limit(self, service):
        """RECENT_CHAPTERS_LIMIT is a reasonable number."""
        assert service.RECENT_CHAPTERS_LIMIT == 20
