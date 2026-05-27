"""Tests for ObservabilityService - system metrics, quality trends, API stats, timelines."""

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from backend.services.observability import ObservabilityService


@pytest.fixture
def service():
    return ObservabilityService()


def _mock_insp(id=1, chapter_id=1, inspection_type="quality", auto_fixed=False,
               created_at=None, issues_json=None, suggestions_json=None):
    """Create a mock AIInspectionResult."""
    m = MagicMock()
    m.id = id
    m.chapter_id = chapter_id
    m.inspection_type = inspection_type
    m.auto_fixed = auto_fixed
    m.created_at = created_at or datetime(2025, 6, 1, tzinfo=timezone.utc)
    m.issues_json = issues_json
    m.suggestions_json = suggestions_json
    return m


def _mock_chapter(id=1, chapter_order=1, title="第一章", status="draft",
                  word_count=3000, updated_at=None):
    """Create a mock Chapter."""
    m = MagicMock()
    m.id = id
    m.chapter_order = chapter_order
    m.title = title
    m.status = status
    m.word_count = word_count
    m.updated_at = updated_at or datetime(2025, 6, 1, tzinfo=timezone.utc)
    return m


# =============================================================================
# _get_entity_counts
# =============================================================================


class TestGetEntityCounts:
    """Test entity count queries."""

    @pytest.mark.asyncio
    async def test_returns_all_entity_keys(self, service):
        mock_session = AsyncMock()
        mock_session.scalar = AsyncMock(return_value=5)
        result = await service._get_entity_counts(mock_session)
        assert "chapters" in result
        assert "characters" in result
        assert "plot_threads" in result
        assert "draft_versions" in result
        assert "ai_inspections" in result
        assert all(v == 5 for v in result.values())

    @pytest.mark.asyncio
    async def test_none_values_default_to_zero(self, service):
        mock_session = AsyncMock()
        mock_session.scalar = AsyncMock(return_value=None)
        result = await service._get_entity_counts(mock_session)
        assert all(v == 0 for v in result.values())


# =============================================================================
# _get_chapter_stats
# =============================================================================


class TestGetChapterStats:
    """Test chapter statistics."""

    @pytest.mark.asyncio
    async def test_chapter_stats_structure(self, service):
        mock_session = AsyncMock()

        mock_sum = MagicMock()
        mock_sum.scalar_one_or_none.return_value = 10000
        mock_status = MagicMock()
        mock_status.all.return_value = [("draft", 3), ("published", 2)]
        mock_avg = MagicMock()
        mock_avg.scalar_one_or_none.return_value = 2000
        mock_max = MagicMock()
        mock_max.scalar_one_or_none.return_value = 5

        mock_session.execute = AsyncMock(side_effect=[mock_sum, mock_status, mock_avg, mock_max])

        result = await service._get_chapter_stats(mock_session)
        assert result["total_word_count"] == 10000
        assert result["average_word_count"] == 2000.0
        assert result["max_chapter_order"] == 5
        assert result["by_status"] == {"draft": 3, "published": 2}

    @pytest.mark.asyncio
    async def test_chapter_stats_none_values(self, service):
        mock_session = AsyncMock()

        mock_none = MagicMock()
        mock_none.scalar_one_or_none.return_value = None
        mock_empty = MagicMock()
        mock_empty.all.return_value = []

        mock_session.execute = AsyncMock(side_effect=[mock_none, mock_empty, mock_none, mock_none])

        result = await service._get_chapter_stats(mock_session)
        assert result["total_word_count"] == 0
        assert result["average_word_count"] == 0.0
        assert result["max_chapter_order"] == 0


# =============================================================================
# _get_inspection_stats
# =============================================================================


class TestGetInspectionStats:
    """Test inspection statistics."""

    @pytest.mark.asyncio
    async def test_inspection_stats_structure(self, service):
        mock_session = AsyncMock()

        mock_type = MagicMock()
        mock_type.all.return_value = [("quality", 5), ("consistency", 3)]
        mock_auto = MagicMock()
        mock_auto.all.return_value = [("True", 2), ("False", 6)]
        mock_recent = MagicMock()
        mock_recent.scalar_one_or_none.return_value = 3

        mock_session.execute = AsyncMock(side_effect=[mock_type, mock_auto, mock_recent])

        result = await service._get_inspection_stats(mock_session)
        assert result["by_type"]["quality"] == 5
        assert result["auto_fixed_counts"]["True"] == 2
        assert result["recent_24h"] == 3

    @pytest.mark.asyncio
    async def test_inspection_stats_empty(self, service):
        mock_session = AsyncMock()

        mock_empty = MagicMock()
        mock_empty.all.return_value = []
        mock_zero = MagicMock()
        mock_zero.scalar_one_or_none.return_value = 0

        mock_session.execute = AsyncMock(side_effect=[mock_empty, mock_empty, mock_zero])

        result = await service._get_inspection_stats(mock_session)
        assert result["by_type"] == {}
        assert result["recent_24h"] == 0


# =============================================================================
# _get_workflow_stats
# =============================================================================


class TestGetWorkflowStats:
    """Test workflow statistics."""

    @pytest.mark.asyncio
    async def test_workflow_stats_structure(self, service):
        mock_session = AsyncMock()

        mock_status = MagicMock()
        mock_status.all.return_value = [("completed", 10)]
        mock_session.scalar = AsyncMock(return_value=50)
        mock_recent = MagicMock()
        mock_recent.scalar_one_or_none.return_value = 5

        mock_session.execute = AsyncMock(side_effect=[mock_status, mock_recent])

        result = await service._get_workflow_stats(mock_session)
        assert result["by_status"]["completed"] == 10
        assert result["total_agent_logs"] == 50
        assert result["recent_24h"] == 5

    @pytest.mark.asyncio
    async def test_workflow_stats_none_agent_logs(self, service):
        mock_session = AsyncMock()

        mock_status = MagicMock()
        mock_status.all.return_value = []
        mock_session.scalar = AsyncMock(return_value=None)
        mock_recent = MagicMock()
        mock_recent.scalar_one_or_none.return_value = None

        mock_session.execute = AsyncMock(side_effect=[mock_status, mock_recent])

        result = await service._get_workflow_stats(mock_session)
        assert result["total_agent_logs"] == 0
        assert result["recent_24h"] == 0


# =============================================================================
# get_system_metrics
# =============================================================================


class TestGetSystemMetrics:
    """Test the combined system metrics method."""

    @pytest.mark.asyncio
    async def test_system_metrics_structure(self, service):
        with patch("backend.services.observability.metrics_service") as mock_ms, \
             patch("backend.services.observability.async_session_maker") as mock_maker:

            mock_ms.get_summary = AsyncMock(return_value={"requests": {"total": 5}})

            mock_session = AsyncMock()
            mock_session.scalar = AsyncMock(return_value=3)

            mock_sum = MagicMock()
            mock_sum.scalar_one_or_none.return_value = 5000
            mock_status = MagicMock()
            mock_status.all.return_value = [("draft", 2)]
            mock_avg = MagicMock()
            mock_avg.scalar_one_or_none.return_value = 2500
            mock_max = MagicMock()
            mock_max.scalar_one_or_none.return_value = 2

            mock_type = MagicMock()
            mock_type.all.return_value = []
            mock_auto = MagicMock()
            mock_auto.all.return_value = []
            mock_recent_insp = MagicMock()
            mock_recent_insp.scalar_one_or_none.return_value = 0

            mock_wf_status = MagicMock()
            mock_wf_status.all.return_value = []
            mock_wf_recent = MagicMock()
            mock_wf_recent.scalar_one_or_none.return_value = 0

            # entity_counts: 5 scalar calls, chapter_stats: 4 execute, inspection_stats: 3 execute, workflow_stats: 1 scalar + 2 execute
            mock_session.scalar = AsyncMock(return_value=3)
            mock_session.execute = AsyncMock(side_effect=[
                # chapter_stats
                mock_sum, mock_status, mock_avg, mock_max,
                # inspection_stats
                mock_type, mock_auto, mock_recent_insp,
                # workflow_stats
                mock_wf_status, mock_wf_recent,
            ])

            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_system_metrics(window_seconds=60.0)

        assert "timestamp" in result
        assert result["window_seconds"] == 60.0
        assert "runtime" in result
        assert "entities" in result
        assert "chapters" in result
        assert "inspections" in result
        assert "workflows" in result


# =============================================================================
# get_writing_quality_trends
# =============================================================================


class TestGetWritingQualityTrends:
    """Test writing quality trend analysis."""

    @pytest.mark.asyncio
    async def test_empty_inspections(self, service):
        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_writing_quality_trends()
        assert result["count"] == 0
        assert result["overall_avg"] == 0.0
        assert result["trend"] == []

    @pytest.mark.asyncio
    async def test_with_issues_json_list(self, service):
        issues = [{"severity": "high"}, {"severity": "low"}, {"severity": "high"}]
        insp = _mock_insp(issues_json=json.dumps(issues))

        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [insp]
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_writing_quality_trends()

        assert result["count"] == 1
        assert result["severity_totals"]["high"] == 2
        assert result["severity_totals"]["low"] == 1

    @pytest.mark.asyncio
    async def test_with_issues_json_dict(self, service):
        issues = {"high": 3, "low": 1}
        insp = _mock_insp(issues_json=json.dumps(issues))

        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [insp]
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_writing_quality_trends()

        assert result["severity_totals"]["high"] == 3

    @pytest.mark.asyncio
    async def test_with_suggestions_json_list(self, service):
        suggestions = [
            {"dimension": "pacing", "score": 8.5},
            {"dimension": "dialogue", "score": 7.0},
        ]
        insp = _mock_insp(suggestions_json=json.dumps(suggestions))

        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [insp]
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_writing_quality_trends()

        assert result["dimension_avg"]["pacing"] == 8.5
        assert result["dimension_avg"]["dialogue"] == 7.0
        assert result["overall_avg"] == 7.8

    @pytest.mark.asyncio
    async def test_with_suggestions_json_dict(self, service):
        suggestions = {"pacing": 8.0, "dialogue": 6.0}
        insp = _mock_insp(suggestions_json=json.dumps(suggestions))

        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [insp]
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_writing_quality_trends()

        assert result["dimension_avg"]["pacing"] == 8.0
        assert result["overall_avg"] == 7.0

    @pytest.mark.asyncio
    async def test_with_invalid_json(self, service):
        insp = _mock_insp(issues_json="not valid json", suggestions_json="also bad")

        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [insp]
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_writing_quality_trends()

        assert result["count"] == 1
        assert result["severity_totals"] == {}

    @pytest.mark.asyncio
    async def test_filter_by_chapter_id(self, service):
        insp = _mock_insp(chapter_id=5)
        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [insp]
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_writing_quality_trends(chapter_id=5)

        assert result["count"] == 1

    @pytest.mark.asyncio
    async def test_trend_reversed_to_oldest_first(self, service):
        old_insp = _mock_insp(id=1, created_at=datetime(2025, 1, 1, tzinfo=timezone.utc))
        new_insp = _mock_insp(id=2, created_at=datetime(2025, 6, 1, tzinfo=timezone.utc))

        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [new_insp, old_insp]
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_writing_quality_trends()

        # reversed: oldest first
        assert result["trend"][0]["id"] == 1
        assert result["trend"][1]["id"] == 2

    @pytest.mark.asyncio
    async def test_auto_fixed_flag(self, service):
        insp = _mock_insp(auto_fixed=True)
        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = [insp]
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_writing_quality_trends()

        assert result["trend"][0]["auto_fixed"] is True


# =============================================================================
# get_historical_system_metrics
# =============================================================================


class TestGetHistoricalSystemMetrics:
    """Test historical metrics delegation."""

    @pytest.mark.asyncio
    async def test_delegates_to_metrics_service(self, service):
        with patch("backend.services.observability.metrics_service") as mock_ms:
            mock_ms.get_historical_metrics = AsyncMock(return_value=[{"timestamp": 1.0}])
            result = await service.get_historical_system_metrics(hours=12)
        assert result == [{"timestamp": 1.0}]
        mock_ms.get_historical_metrics.assert_called_once_with(12)


# =============================================================================
# get_api_call_stats
# =============================================================================


class TestGetApiCallStats:
    """Test API call statistics."""

    @pytest.mark.asyncio
    async def test_api_call_stats_structure(self, service):
        with patch("backend.services.observability.metrics_service") as mock_ms:
            mock_ms.get_summary = AsyncMock(return_value={
                "ai_calls": {
                    "total": 100, "success": 95, "failed": 5,
                    "success_rate": 0.95, "avg_ms": 500.0,
                    "p95_ms": 1200.0, "per_minute": 2.0,
                }
            })
            result = await service.get_api_call_stats(window_seconds=3600.0)

        assert result["window_seconds"] == 3600.0
        assert "timestamp" in result
        assert result["summary"]["total_calls"] == 100
        assert result["summary"]["successful"] == 95
        assert result["summary"]["failed"] == 5
        assert result["summary"]["success_rate"] == 0.95
        assert result["summary"]["avg_latency_ms"] == 500.0
        assert result["summary"]["p95_latency_ms"] == 1200.0
        assert result["summary"]["calls_per_minute"] == 2.0

    @pytest.mark.asyncio
    async def test_api_call_stats_missing_keys(self, service):
        with patch("backend.services.observability.metrics_service") as mock_ms:
            mock_ms.get_summary = AsyncMock(return_value={"ai_calls": {}})
            result = await service.get_api_call_stats()

        assert result["summary"]["total_calls"] == 0
        assert result["summary"]["success_rate"] == 0.0


# =============================================================================
# get_chapter_quality_timeline
# =============================================================================


class TestGetChapterQualityTimeline:
    """Test chapter quality timeline."""

    @pytest.mark.asyncio
    async def test_timeline_empty(self, service):
        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalars.return_value.all.return_value = []
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_chapter_quality_timeline()
        assert result == []

    @pytest.mark.asyncio
    async def test_timeline_with_dict_suggestions(self, service):
        ch = _mock_chapter(id=1, chapter_order=1, title="第一章")
        insp = _mock_insp(suggestions_json=json.dumps({"overall_score": 8.5}))

        with patch("backend.services.observability.async_session_maker") as mock_maker:
            sessions = []

            # First session: chapter query
            s1 = AsyncMock()
            r1 = MagicMock()
            r1.scalars.return_value.all.return_value = [ch]
            s1.execute = AsyncMock(return_value=r1)
            sessions.append(s1)

            # Second session: inspection query
            s2 = AsyncMock()
            r2 = MagicMock()
            r2.scalar_one_or_none.return_value = insp
            s2.execute = AsyncMock(return_value=r2)
            sessions.append(s2)

            # Third session: inspection count
            s3 = AsyncMock()
            r3 = MagicMock()
            r3.scalar_one_or_none.return_value = 2
            s3.execute = AsyncMock(return_value=r3)
            sessions.append(s3)

            mock_maker.return_value.__aenter__ = AsyncMock(side_effect=sessions)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_chapter_quality_timeline(limit=10)

        assert len(result) == 1
        assert result[0]["chapter_id"] == 1
        assert result[0]["quality_score"] == 8.5
        assert result[0]["inspection_count"] == 2

    @pytest.mark.asyncio
    async def test_timeline_with_list_suggestions(self, service):
        ch = _mock_chapter(id=2, chapter_order=2, title="第二章")
        insp = _mock_insp(suggestions_json=json.dumps([
            {"score": 7.0}, {"score": 9.0}
        ]))

        with patch("backend.services.observability.async_session_maker") as mock_maker:
            s1 = AsyncMock()
            r1 = MagicMock()
            r1.scalars.return_value.all.return_value = [ch]
            s1.execute = AsyncMock(return_value=r1)

            s2 = AsyncMock()
            r2 = MagicMock()
            r2.scalar_one_or_none.return_value = insp
            s2.execute = AsyncMock(return_value=r2)

            s3 = AsyncMock()
            r3 = MagicMock()
            r3.scalar_one_or_none.return_value = 1
            s3.execute = AsyncMock(return_value=r3)

            mock_maker.return_value.__aenter__ = AsyncMock(side_effect=[s1, s2, s3])
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_chapter_quality_timeline()

        assert result[0]["quality_score"] == 8.0

    @pytest.mark.asyncio
    async def test_timeline_no_inspection(self, service):
        ch = _mock_chapter(id=3, chapter_order=3, title="第三章")

        with patch("backend.services.observability.async_session_maker") as mock_maker:
            s1 = AsyncMock()
            r1 = MagicMock()
            r1.scalars.return_value.all.return_value = [ch]
            s1.execute = AsyncMock(return_value=r1)

            s2 = AsyncMock()
            r2 = MagicMock()
            r2.scalar_one_or_none.return_value = None
            s2.execute = AsyncMock(return_value=r2)

            s3 = AsyncMock()
            r3 = MagicMock()
            r3.scalar_one_or_none.return_value = 0
            s3.execute = AsyncMock(return_value=r3)

            mock_maker.return_value.__aenter__ = AsyncMock(side_effect=[s1, s2, s3])
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service.get_chapter_quality_timeline()

        assert result[0]["quality_score"] is None
        assert result[0]["inspection_count"] == 0


# =============================================================================
# _get_inspection_count_for_chapter
# =============================================================================


class TestGetInspectionCountForChapter:
    """Test inspection count helper."""

    @pytest.mark.asyncio
    async def test_returns_count(self, service):
        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = 5
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service._get_inspection_count_for_chapter(1)
        assert result == 5

    @pytest.mark.asyncio
    async def test_returns_zero_for_none(self, service):
        with patch("backend.services.observability.async_session_maker") as mock_maker:
            mock_session = AsyncMock()
            mock_result = MagicMock()
            mock_result.scalar_one_or_none.return_value = None
            mock_session.execute = AsyncMock(return_value=mock_result)
            mock_maker.return_value.__aenter__ = AsyncMock(return_value=mock_session)
            mock_maker.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await service._get_inspection_count_for_chapter(999)
        assert result == 0
