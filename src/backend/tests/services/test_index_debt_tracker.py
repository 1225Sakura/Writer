"""Tests for Index Debt Tracker - debt types, severity, resolution."""

import pytest
from backend.services.index_debt_tracker import (
    IndexDebtTracker,
    DebtType,
    DebtSeverity,
    DebtStatus,
)


@pytest.fixture
def tracker():
    return IndexDebtTracker()


# =============================================================================
# Enum values
# =============================================================================


class TestDebtTypes:
    """Test debt type enum values."""

    def test_chapter_reindex(self):
        assert DebtType.CHAPTER_REINDEX == "chapter_reindex"

    def test_entity_relink(self):
        assert DebtType.ENTITY_RELINK == "entity_relink"

    def test_orphan_entity(self):
        assert DebtType.ORPHAN_ENTITY == "orphan_entity"

    def test_plot_thread_gap(self):
        assert DebtType.PLOT_THREAD_GAP == "plot_thread_gap"

    def test_inspection_stale(self):
        assert DebtType.INSPECTION_STALE == "inspection_stale"

    def test_word_count_mismatch(self):
        assert DebtType.WORD_COUNT_MISMATCH == "word_count_mismatch"


class TestDebtSeverity:
    """Test debt severity enum."""

    def test_ordering(self):
        assert DebtSeverity.LOW == "low"
        assert DebtSeverity.MEDIUM == "medium"
        assert DebtSeverity.HIGH == "high"
        assert DebtSeverity.CRITICAL == "critical"


class TestDebtStatus:
    """Test debt status enum."""

    def test_values(self):
        assert DebtStatus.PENDING == "pending"
        assert DebtStatus.IN_PROGRESS == "in_progress"
        assert DebtStatus.RESOLVED == "resolved"
        assert DebtStatus.IGNORED == "ignored"


# =============================================================================
# Tracker initialization
# =============================================================================


class TestTrackerInit:
    """Test tracker initialization."""

    def test_cache_initially_none(self, tracker):
        assert tracker._debt_cache is None
        assert tracker._cache_timestamp is None

    def test_cache_ttl(self, tracker):
        assert tracker._cache_ttl_seconds == 30.0


# =============================================================================
# resolve_debt (with mocked scan)
# =============================================================================


class TestResolveDebt:
    """Test debt resolution."""

    @pytest.mark.asyncio
    async def test_resolve_existing_debt(self, tracker):
        fake_debts = [
            {"id": "reindex_ch_1", "type": "chapter_reindex", "status": DebtStatus.PENDING, "severity": "medium"},
        ]
        tracker.scan_all_debt = AsyncMock(return_value=fake_debts)
        result = await tracker.resolve_debt("reindex_ch_1")
        assert result["success"] is True
        assert "已解决" in result["message"]

    @pytest.mark.asyncio
    async def test_resolve_nonexistent_debt(self, tracker):
        tracker.scan_all_debt = AsyncMock(return_value=[])
        result = await tracker.resolve_debt("nonexistent")
        assert result["success"] is False
        assert "未找到" in result["message"]

    @pytest.mark.asyncio
    async def test_resolve_already_resolved(self, tracker):
        fake_debts = [
            {"id": "reindex_ch_1", "type": "chapter_reindex", "status": DebtStatus.RESOLVED},
        ]
        tracker.scan_all_debt = AsyncMock(return_value=fake_debts)
        result = await tracker.resolve_debt("reindex_ch_1")
        assert result["success"] is False
        assert "已经是" in result["message"]


# =============================================================================
# ignore_debt
# =============================================================================


class TestIgnoreDebt:
    """Test debt ignoring."""

    @pytest.mark.asyncio
    async def test_ignore_existing_debt(self, tracker):
        fake_debts = [
            {"id": "orphan_char_1", "type": "orphan_entity", "status": DebtStatus.PENDING},
        ]
        tracker.scan_all_debt = AsyncMock(return_value=fake_debts)
        result = await tracker.ignore_debt("orphan_char_1", reason="not needed")
        assert result["success"] is True
        assert "已忽略" in result["message"]

    @pytest.mark.asyncio
    async def test_ignore_nonexistent(self, tracker):
        tracker.scan_all_debt = AsyncMock(return_value=[])
        result = await tracker.ignore_debt("nonexistent")
        assert result["success"] is False


# =============================================================================
# resolve_debts_by_entity
# =============================================================================


class TestResolveDebtsByEntity:
    """Test entity-based debt resolution."""

    @pytest.mark.asyncio
    async def test_resolve_matching_entity(self, tracker):
        fake_debts = [
            {"entity_type": "chapter", "entity_id": 1, "status": DebtStatus.PENDING},
            {"entity_type": "chapter", "entity_id": 1, "status": DebtStatus.PENDING},
            {"entity_type": "chapter", "entity_id": 2, "status": DebtStatus.PENDING},
        ]
        tracker.scan_all_debt = AsyncMock(return_value=fake_debts)
        result = await tracker.resolve_debts_by_entity("chapter", 1)
        assert result["success"] is True
        assert result["resolved_count"] == 2

    @pytest.mark.asyncio
    async def test_resolve_no_matching_entity(self, tracker):
        fake_debts = [
            {"entity_type": "chapter", "entity_id": 2, "status": DebtStatus.PENDING},
        ]
        tracker.scan_all_debt = AsyncMock(return_value=fake_debts)
        result = await tracker.resolve_debts_by_entity("chapter", 99)
        assert result["resolved_count"] == 0


# =============================================================================
# get_debt_summary (with mocked scan)
# =============================================================================


class TestGetDebtSummary:
    """Test debt summary generation."""

    @pytest.mark.asyncio
    async def test_summary_structure(self, tracker):
        fake_debts = [
            {"type": "chapter_reindex", "severity": "medium", "status": DebtStatus.PENDING},
            {"type": "orphan_entity", "severity": "low", "status": DebtStatus.PENDING},
        ]
        tracker.scan_all_debt = AsyncMock(return_value=fake_debts)
        summary = await tracker.get_debt_summary()
        assert summary["total"] == 2
        assert summary["by_type"]["chapter_reindex"] == 1
        assert summary["by_severity"]["medium"] == 1
        assert "timestamp" in summary


# =============================================================================
# get_debts_by_type
# =============================================================================


class TestGetDebtsByType:
    """Test filtering debts by type."""

    @pytest.mark.asyncio
    async def test_filter_by_type(self, tracker):
        fake_debts = [
            {"type": "chapter_reindex", "status": DebtStatus.PENDING},
            {"type": "orphan_entity", "status": DebtStatus.PENDING},
            {"type": "chapter_reindex", "status": DebtStatus.RESOLVED},
        ]
        tracker.scan_all_debt = AsyncMock(return_value=fake_debts)
        result = await tracker.get_debts_by_type(DebtType.CHAPTER_REINDEX)
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_filter_by_type_and_status(self, tracker):
        fake_debts = [
            {"type": "chapter_reindex", "status": DebtStatus.PENDING},
            {"type": "chapter_reindex", "status": DebtStatus.RESOLVED},
        ]
        tracker.scan_all_debt = AsyncMock(return_value=fake_debts)
        result = await tracker.get_debts_by_type(DebtType.CHAPTER_REINDEX, status=DebtStatus.PENDING)
        assert len(result) == 1


# =============================================================================
# get_debts_by_entity
# =============================================================================


class TestGetDebtsByEntity:
    """Test filtering debts by entity."""

    @pytest.mark.asyncio
    async def test_filter_by_entity(self, tracker):
        fake_debts = [
            {"entity_type": "chapter", "entity_id": 1, "status": DebtStatus.PENDING},
            {"entity_type": "chapter", "entity_id": 2, "status": DebtStatus.PENDING},
        ]
        tracker.scan_all_debt = AsyncMock(return_value=fake_debts)
        result = await tracker.get_debts_by_entity("chapter", 1)
        assert len(result) == 1


# Import AsyncMock for Python 3.7 compat
from unittest.mock import AsyncMock
