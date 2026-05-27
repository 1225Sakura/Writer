"""Tests for StatusReporter - comprehensive coverage of all public/private methods."""

from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import pytest

from backend.services.status_reporter import StatusReporter


@pytest.fixture
def reporter():
    return StatusReporter()


def _mock_session_with_scalars(scalar_results=None, execute_results=None):
    """Helper to create a mock async session with configurable results."""
    mock_session = AsyncMock()

    if scalar_results is not None:
        mock_session.scalar = AsyncMock(side_effect=scalar_results)

    if execute_results is not None:
        mock_session.execute = AsyncMock(side_effect=execute_results)

    return mock_session


# =============================================================================
# _health_status_label (static method)
# =============================================================================


class TestHealthStatusLabel:
    """Test health score to label conversion."""

    def test_healthy(self, reporter):
        assert reporter._health_status_label(80) == "健康"
        assert reporter._health_status_label(100) == "健康"

    def test_good(self, reporter):
        assert reporter._health_status_label(60) == "良好"
        assert reporter._health_status_label(79) == "良好"

    def test_average(self, reporter):
        assert reporter._health_status_label(40) == "一般"
        assert reporter._health_status_label(59) == "一般"

    def test_needs_attention(self, reporter):
        assert reporter._health_status_label(20) == "需关注"
        assert reporter._health_status_label(39) == "需关注"

    def test_severe(self, reporter):
        assert reporter._health_status_label(0) == "严重"
        assert reporter._health_status_label(19) == "严重"


# =============================================================================
# _compute_health_score
# =============================================================================


class TestComputeHealthScore:
    """Test health score computation logic."""

    def test_perfect_score(self, reporter):
        score = reporter._compute_health_score(
            basic_stats={"total_chapters": 10, "completion_percentage": 100},
            character_activity={"total": 5, "active_count": 5},
            plot_thread_status={"total": 3, "resolved_count": 3, "overdue_count": 0},
            quality_overview={"inspection_coverage_pct": 100, "recent_7d": 10},
        )
        assert score >= 80

    def test_no_data_gives_no_debt_score(self, reporter):
        score = reporter._compute_health_score(
            basic_stats={"total_chapters": 0, "completion_percentage": 0},
            character_activity={"total": 0, "active_count": 0},
            plot_thread_status={"total": 0, "resolved_count": 0, "overdue_count": 0},
            quality_overview={"inspection_coverage_pct": 0, "recent_7d": 0},
        )
        assert score >= 40

    def test_dropped_characters_lower_score(self, reporter):
        score_good = reporter._compute_health_score(
            basic_stats={"total_chapters": 10, "completion_percentage": 50},
            character_activity={"total": 5, "active_count": 5},
            plot_thread_status={"total": 0, "resolved_count": 0, "overdue_count": 0},
            quality_overview={"inspection_coverage_pct": 50, "recent_7d": 5},
        )
        score_bad = reporter._compute_health_score(
            basic_stats={"total_chapters": 10, "completion_percentage": 50},
            character_activity={"total": 5, "active_count": 0},
            plot_thread_status={"total": 0, "resolved_count": 0, "overdue_count": 0},
            quality_overview={"inspection_coverage_pct": 50, "recent_7d": 5},
        )
        assert score_bad < score_good

    def test_overdue_threads_lower_score(self, reporter):
        score_clean = reporter._compute_health_score(
            basic_stats={"total_chapters": 10, "completion_percentage": 50},
            character_activity={"total": 0, "active_count": 0},
            plot_thread_status={"total": 3, "resolved_count": 3, "overdue_count": 0},
            quality_overview={"inspection_coverage_pct": 50, "recent_7d": 5},
        )
        score_overdue = reporter._compute_health_score(
            basic_stats={"total_chapters": 10, "completion_percentage": 50},
            character_activity={"total": 0, "active_count": 0},
            plot_thread_status={"total": 3, "resolved_count": 1, "overdue_count": 2},
            quality_overview={"inspection_coverage_pct": 50, "recent_7d": 5},
        )
        assert score_overdue < score_clean

    def test_high_coverage_increases_score(self, reporter):
        score_low = reporter._compute_health_score(
            basic_stats={"total_chapters": 10, "completion_percentage": 0},
            character_activity={"total": 0, "active_count": 0},
            plot_thread_status={"total": 0, "resolved_count": 0, "overdue_count": 0},
            quality_overview={"inspection_coverage_pct": 0, "recent_7d": 0},
        )
        score_high = reporter._compute_health_score(
            basic_stats={"total_chapters": 10, "completion_percentage": 0},
            character_activity={"total": 0, "active_count": 0},
            plot_thread_status={"total": 0, "resolved_count": 0, "overdue_count": 0},
            quality_overview={"inspection_coverage_pct": 100, "recent_7d": 0},
        )
        assert score_high > score_low


# =============================================================================
# Threshold constants
# =============================================================================


class TestThresholds:
    """Test reporter threshold constants."""

    def test_character_absence_warning(self, reporter):
        assert reporter.CHARACTER_ABSENCE_WARNING == 20

    def test_character_absence_critical(self, reporter):
        assert reporter.CHARACTER_ABSENCE_CRITICAL == 50

    def test_plot_thread_gap_warning(self, reporter):
        assert reporter.PLOT_THREAD_GAP_WARNING == 50

    def test_plot_thread_gap_critical(self, reporter):
        assert reporter.PLOT_THREAD_GAP_CRITICAL == 100

    def test_quality_score_warning(self, reporter):
        assert reporter.QUALITY_SCORE_WARNING == 70.0

    def test_quality_score_critical(self, reporter):
        assert reporter.QUALITY_SCORE_CRITICAL == 60.0


# =============================================================================
# _get_basic_stats
# =============================================================================


class TestGetBasicStats:
    """Test basic project statistics gathering."""

    @pytest.mark.asyncio
    async def test_basic_stats_returns_all_fields(self, reporter):
        mock_session = AsyncMock()
        # scalar calls: chapter, character, outline, if_line, plot_thread, draft,
        # item, location, faction, world_setting, rule, chat_session
        scalar_values = [5, 3, 2, 1, 4, 6, 7, 8, 9, 10, 11, 12]
        mock_session.scalar = AsyncMock(side_effect=scalar_values)

        # execute calls: sum(word_count), status group, max order
        mock_sum = MagicMock()
        mock_sum.scalar_one_or_none.return_value = 50000
        mock_status = MagicMock()
        mock_status.all.return_value = [("draft", 3), ("published", 2)]
        mock_max = MagicMock()
        mock_max.scalar_one_or_none.return_value = 5
        mock_session.execute = AsyncMock(side_effect=[mock_sum, mock_status, mock_max])

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_basic_stats()

        assert result["total_chapters"] == 5
        assert result["total_characters"] == 3
        assert result["total_word_count"] == 50000
        assert result["chapters_by_status"] == {"draft": 3, "published": 2}
        assert result["max_chapter_order"] == 5

    @pytest.mark.asyncio
    async def test_basic_stats_handles_none_values(self, reporter):
        mock_session = AsyncMock()
        mock_session.scalar = AsyncMock(return_value=None)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = None
        mock_result.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_basic_stats()

        assert result["total_chapters"] == 0
        assert result["total_word_count"] == 0


# =============================================================================
# _get_character_activity
# =============================================================================


class TestGetCharacterActivity:
    """Test character activity analysis."""

    @pytest.mark.asyncio
    async def test_active_characters_with_relationships(self, reporter):
        mock_char = MagicMock()
        mock_char.id = 1
        mock_char.name = "主角"
        mock_char.tier = "S"

        # Session 1: character query
        mock_session1 = AsyncMock()
        mock_result1 = MagicMock()
        mock_result1.scalars.return_value.all.return_value = [mock_char]

        # Session 2: max chapter order
        mock_session2 = AsyncMock()
        mock_result2 = MagicMock()
        mock_result2.scalar_one_or_none.return_value = 10

        # Session 3: relationship count
        mock_session3 = AsyncMock()
        mock_session3.scalar = AsyncMock(return_value=3)

        call_count = 0
        async def mock_session_factory():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                m = AsyncMock()
                m.execute = AsyncMock(return_value=mock_result1)
                return m
            elif call_count == 2:
                m = AsyncMock()
                m.execute = AsyncMock(return_value=mock_result2)
                return m
            else:
                return mock_session3

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(side_effect=[
                mock_session1, mock_session2, mock_session3
            ])
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_session1.execute = AsyncMock(return_value=mock_result1)
            mock_session2.execute = AsyncMock(return_value=mock_result2)
            result = await reporter._get_character_activity()

        assert result["total"] == 1
        assert result["active_count"] == 1
        assert result["dropped_count"] == 0

    @pytest.mark.asyncio
    async def test_dropped_characters_no_relationships(self, reporter):
        mock_char = MagicMock()
        mock_char.id = 1
        mock_char.name = "路人甲"
        mock_char.tier = "C"

        mock_session_chars = AsyncMock()
        mock_result_chars = MagicMock()
        mock_result_chars.scalars.return_value.all.return_value = [mock_char]
        mock_session_chars.execute = AsyncMock(return_value=mock_result_chars)

        mock_session_max = AsyncMock()
        mock_result_max = MagicMock()
        mock_result_max.scalar_one_or_none.return_value = 10
        mock_session_max.execute = AsyncMock(return_value=mock_result_max)

        mock_session_rel = AsyncMock()
        mock_session_rel.scalar = AsyncMock(return_value=0)

        sessions = [mock_session_chars, mock_session_max, mock_session_rel]
        session_iter = iter(sessions)

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(side_effect=sessions)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_character_activity()

        assert result["total"] == 1
        assert result["active_count"] == 0
        assert result["dropped_count"] == 1
        assert result["dropped_characters"][0]["name"] == "路人甲"


# =============================================================================
# _get_plot_thread_status
# =============================================================================


class TestGetPlotThreadStatus:
    """Test plot thread status analysis."""

    @pytest.mark.asyncio
    async def test_resolved_threads(self, reporter):
        mock_thread = MagicMock()
        mock_thread.id = 1
        mock_thread.title = "伏笔A"
        mock_thread.status = "resolved"
        mock_thread.created_chapter_id = 1
        mock_thread.reveal_chapter_id = 5

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_thread]
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_plot_thread_status()

        assert result["total"] == 1
        assert result["resolved_count"] == 1
        assert result["active_count"] == 0
        assert result["overdue_count"] == 0

    @pytest.mark.asyncio
    async def test_overdue_thread_critical(self, reporter):
        mock_thread = MagicMock()
        mock_thread.id = 1
        mock_thread.title = "老伏笔"
        mock_thread.status = "active"
        mock_thread.created_chapter_id = 1
        mock_thread.reveal_chapter_id = 200  # gap=199 > 100

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_thread]
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_plot_thread_status()

        assert result["overdue_count"] == 1
        assert result["overdue_threads"][0]["overdue_status"] == "严重超时"

    @pytest.mark.asyncio
    async def test_overdue_thread_warning(self, reporter):
        mock_thread = MagicMock()
        mock_thread.id = 1
        mock_thread.title = "伏笔B"
        mock_thread.status = "active"
        mock_thread.created_chapter_id = 10
        mock_thread.reveal_chapter_id = 70  # gap=60 > 50

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_thread]
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_plot_thread_status()

        assert result["overdue_count"] == 1
        assert result["overdue_threads"][0]["overdue_status"] == "轻度超时"

    @pytest.mark.asyncio
    async def test_active_thread_within_threshold(self, reporter):
        mock_thread = MagicMock()
        mock_thread.id = 1
        mock_thread.title = "伏笔C"
        mock_thread.status = "active"
        mock_thread.created_chapter_id = 10
        mock_thread.reveal_chapter_id = 30  # gap=20 < 50

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_thread]
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_plot_thread_status()

        assert result["active_count"] == 1
        assert result["overdue_count"] == 0

    @pytest.mark.asyncio
    async def test_thread_without_reveal_chapter(self, reporter):
        mock_thread = MagicMock()
        mock_thread.id = 1
        mock_thread.title = "未揭示伏笔"
        mock_thread.status = "active"
        mock_thread.created_chapter_id = 1
        mock_thread.reveal_chapter_id = None

        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = [mock_thread]
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_plot_thread_status()

        assert result["active_count"] == 1

    @pytest.mark.asyncio
    async def test_empty_threads(self, reporter):
        mock_session = AsyncMock()
        mock_result = MagicMock()
        mock_result.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(return_value=mock_result)

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_plot_thread_status()

        assert result["total"] == 0


# =============================================================================
# _get_writing_progress
# =============================================================================


class TestGetWritingProgress:
    """Test writing progress analysis."""

    @pytest.mark.asyncio
    async def test_writing_progress_structure(self, reporter):
        mock_chapter = MagicMock()
        mock_chapter.id = 1
        mock_chapter.chapter_order = 1
        mock_chapter.title = "第一章"
        mock_chapter.status = "published"
        mock_chapter.word_count = 3000
        mock_chapter.created_at = datetime(2025, 1, 1, tzinfo=timezone.utc)

        mock_session = AsyncMock()

        mock_chapters_result = MagicMock()
        mock_chapters_result.scalars.return_value.all.return_value = [mock_chapter]

        mock_sum_result = MagicMock()
        mock_sum_result.scalar_one_or_none.return_value = 3000

        mock_avg_result = MagicMock()
        mock_avg_result.scalar_one_or_none.return_value = 3000

        mock_recent_count = MagicMock()
        mock_recent_count.scalar_one_or_none.return_value = 1

        mock_recent_words = MagicMock()
        mock_recent_words.scalar_one_or_none.return_value = 3000

        mock_session.execute = AsyncMock(side_effect=[
            mock_chapters_result, mock_sum_result, mock_avg_result,
            mock_recent_count, mock_recent_words
        ])

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_writing_progress()

        assert result["total_chapters"] == 1
        assert result["total_words"] == 3000
        assert result["average_words_per_chapter"] == 3000.0
        assert result["target_words"] == 2_000_000
        assert result["completion_percentage"] > 0
        assert "chapter_timeline" in result

    @pytest.mark.asyncio
    async def test_writing_progress_empty(self, reporter):
        mock_session = AsyncMock()

        mock_empty = MagicMock()
        mock_empty.scalars.return_value.all.return_value = []
        mock_none = MagicMock()
        mock_none.scalar_one_or_none.return_value = None

        mock_session.execute = AsyncMock(side_effect=[
            mock_empty, mock_none, mock_none, mock_none, mock_none
        ])

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_writing_progress()

        assert result["total_chapters"] == 0
        assert result["total_words"] == 0
        assert result["completion_percentage"] == 0.0


# =============================================================================
# _get_quality_overview
# =============================================================================


class TestGetQualityOverview:
    """Test quality overview gathering."""

    @pytest.mark.asyncio
    async def test_quality_overview_structure(self, reporter):
        mock_session = AsyncMock()

        # scalar: inspection_count, total_chapters
        mock_session.scalar = AsyncMock(side_effect=[10, 5])

        # execute: by_type, recent, inspected_chapters
        mock_type_result = MagicMock()
        mock_type_result.all.return_value = [("quality", 6), ("consistency", 4)]

        mock_recent_result = MagicMock()
        mock_recent_result.scalar_one_or_none.return_value = 3

        mock_inspected_result = MagicMock()
        mock_inspected_result.scalar_one_or_none.return_value = 4

        mock_session.execute = AsyncMock(side_effect=[
            mock_type_result, mock_recent_result, mock_inspected_result
        ])

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_quality_overview()

        assert result["total_inspections"] == 10
        assert result["by_type"]["quality"] == 6
        assert result["recent_7d"] == 3
        assert result["chapters_with_inspection"] == 4
        assert result["inspection_coverage_pct"] == 80.0

    @pytest.mark.asyncio
    async def test_quality_overview_no_chapters(self, reporter):
        mock_session = AsyncMock()
        mock_session.scalar = AsyncMock(side_effect=[0, 0])

        mock_type_result = MagicMock()
        mock_type_result.all.return_value = []
        mock_recent_result = MagicMock()
        mock_recent_result.scalar_one_or_none.return_value = 0
        mock_inspected_result = MagicMock()
        mock_inspected_result.scalar_one_or_none.return_value = 0

        mock_session.execute = AsyncMock(side_effect=[
            mock_type_result, mock_recent_result, mock_inspected_result
        ])

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_quality_overview()

        assert result["inspection_coverage_pct"] == 0.0


# =============================================================================
# _get_recent_activity
# =============================================================================


class TestGetRecentActivity:
    """Test recent activity gathering."""

    @pytest.mark.asyncio
    async def test_recent_activity_with_data(self, reporter):
        mock_chapter = MagicMock()
        mock_chapter.id = 1
        mock_chapter.title = "第一章"
        mock_chapter.chapter_order = 1
        mock_chapter.created_at = datetime(2025, 1, 1, tzinfo=timezone.utc)

        mock_insp = MagicMock()
        mock_insp.id = 1
        mock_insp.chapter_id = 1
        mock_insp.inspection_type = "quality"
        mock_insp.created_at = datetime(2025, 1, 1, tzinfo=timezone.utc)

        mock_draft = MagicMock()
        mock_draft.id = 1
        mock_draft.chapter_id = 1
        mock_draft.version_number = 1
        mock_draft.created_at = datetime(2025, 1, 1, tzinfo=timezone.utc)

        mock_session = AsyncMock()

        mock_chapters_r = MagicMock()
        mock_chapters_r.scalars.return_value.all.return_value = [mock_chapter]
        mock_insp_r = MagicMock()
        mock_insp_r.scalars.return_value.all.return_value = [mock_insp]
        mock_draft_r = MagicMock()
        mock_draft_r.scalars.return_value.all.return_value = [mock_draft]

        mock_session.execute = AsyncMock(side_effect=[mock_chapters_r, mock_insp_r, mock_draft_r])

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_recent_activity()

        assert len(result["recent_chapters"]) == 1
        assert result["recent_chapters"][0]["title"] == "第一章"
        assert len(result["recent_inspections"]) == 1
        assert len(result["recent_drafts"]) == 1

    @pytest.mark.asyncio
    async def test_recent_activity_empty(self, reporter):
        mock_session = AsyncMock()
        mock_empty = MagicMock()
        mock_empty.scalars.return_value.all.return_value = []
        mock_session.execute = AsyncMock(side_effect=[mock_empty, mock_empty, mock_empty])

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter._get_recent_activity()

        assert result["recent_chapters"] == []
        assert result["recent_inspections"] == []
        assert result["recent_drafts"] == []


# =============================================================================
# get_quick_status
# =============================================================================


class TestGetQuickStatus:
    """Test quick status endpoint."""

    @pytest.mark.asyncio
    async def test_quick_status_structure(self, reporter):
        mock_session = AsyncMock()
        mock_session.scalar = AsyncMock(side_effect=[10, 5, 3])

        mock_sum_result = MagicMock()
        mock_sum_result.scalar_one_or_none.return_value = 50000

        mock_pending_result = MagicMock()
        mock_pending_result.scalar_one_or_none.return_value = 2

        mock_session.execute = AsyncMock(side_effect=[mock_sum_result, mock_pending_result])

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter.get_quick_status()

        assert "timestamp" in result
        assert result["total_chapters"] == 10
        assert result["total_words"] == 50000
        assert result["pending_chapters"] == 2
        assert "recent_24h" in result

    @pytest.mark.asyncio
    async def test_quick_status_handles_none(self, reporter):
        mock_session = AsyncMock()
        mock_session.scalar = AsyncMock(return_value=None)

        mock_none_result = MagicMock()
        mock_none_result.scalar_one_or_none.return_value = None
        mock_session.execute = AsyncMock(return_value=mock_none_result)

        with patch("backend.services.status_reporter.async_session_maker") as mock_maker:
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)
            result = await reporter.get_quick_status()

        assert result["total_chapters"] == 0
        assert result["total_words"] == 0


# =============================================================================
# generate_status_report (integration)
# =============================================================================


class TestGenerateStatusReport:
    """Test the full status report generation."""

    @pytest.mark.asyncio
    async def test_report_has_all_sections(self, reporter):
        with patch.object(reporter, '_get_basic_stats', new_callable=AsyncMock) as m_basic, \
             patch.object(reporter, '_get_character_activity', new_callable=AsyncMock) as m_char, \
             patch.object(reporter, '_get_plot_thread_status', new_callable=AsyncMock) as m_plot, \
             patch.object(reporter, '_get_writing_progress', new_callable=AsyncMock) as m_write, \
             patch.object(reporter, '_get_quality_overview', new_callable=AsyncMock) as m_quality, \
             patch.object(reporter, '_get_recent_activity', new_callable=AsyncMock) as m_recent:

            m_basic.return_value = {"total_chapters": 5, "completion_percentage": 10}
            m_char.return_value = {"total": 3, "active_count": 3}
            m_plot.return_value = {"total": 2, "resolved_count": 1, "overdue_count": 0}
            m_write.return_value = {"total_words": 10000}
            m_quality.return_value = {"inspection_coverage_pct": 50, "recent_7d": 2}
            m_recent.return_value = {"recent_chapters": []}

            result = await reporter.generate_status_report()

        assert "generated_at" in result
        assert "health_score" in result
        assert "health_status" in result
        assert "basic_stats" in result
        assert "character_activity" in result
        assert "plot_threads" in result
        assert "writing_progress" in result
        assert "quality_overview" in result
        assert "recent_activity" in result

    @pytest.mark.asyncio
    async def test_report_health_score_is_float(self, reporter):
        with patch.object(reporter, '_get_basic_stats', new_callable=AsyncMock) as m_basic, \
             patch.object(reporter, '_get_character_activity', new_callable=AsyncMock) as m_char, \
             patch.object(reporter, '_get_plot_thread_status', new_callable=AsyncMock) as m_plot, \
             patch.object(reporter, '_get_writing_progress', new_callable=AsyncMock) as m_write, \
             patch.object(reporter, '_get_quality_overview', new_callable=AsyncMock) as m_quality, \
             patch.object(reporter, '_get_recent_activity', new_callable=AsyncMock) as m_recent:

            m_basic.return_value = {"total_chapters": 0, "completion_percentage": 0}
            m_char.return_value = {"total": 0, "active_count": 0}
            m_plot.return_value = {"total": 0, "resolved_count": 0, "overdue_count": 0}
            m_write.return_value = {}
            m_quality.return_value = {"inspection_coverage_pct": 0, "recent_7d": 0}
            m_recent.return_value = {}

            result = await reporter.generate_status_report()

        assert isinstance(result["health_score"], float)
        assert isinstance(result["health_status"], str)
