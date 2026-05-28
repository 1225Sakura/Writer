"""Tests for CheckerPipeline orchestrating multiple checkers."""

import pytest
import pytest_asyncio
from unittest.mock import MagicMock, AsyncMock

from backend.agents.checkers.pipeline import CheckerPipeline
from backend.agents.checkers.base import BaseChecker, CheckerResult


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def mock_checker():
    """Create a mock checker."""
    checker = MagicMock(spec=BaseChecker)
    checker.name = "mock_checker"
    checker.description = "A mock checker for testing"
    checker.quick_scan = AsyncMock()
    checker.deep_analyze = AsyncMock()
    return checker


@pytest.fixture
def checker_pipeline(mock_checker):
    """Create a CheckerPipeline with one mock checker."""
    return CheckerPipeline(checkers=[mock_checker])


# =============================================================================
# CheckerPipeline Initialization Tests
# =============================================================================

class TestCheckerPipelineInit:
    """Test CheckerPipeline initialization."""

    def test_empty_pipeline(self):
        """CheckerPipeline can be initialized with empty list."""
        pipeline = CheckerPipeline(checkers=[])
        assert pipeline.checkers == []

    def test_pipeline_with_checkers(self, mock_checker):
        """CheckerPipeline stores checkers correctly."""
        pipeline = CheckerPipeline(checkers=[mock_checker])
        assert len(pipeline.checkers) == 1
        assert pipeline.checkers[0] == mock_checker


# =============================================================================
# Quick Scan Tests
# =============================================================================

class TestQuickScan:
    """Test quick_scan parallel execution."""

    @pytest.mark.asyncio
    async def test_quick_scan_runs_all_checkers(self, mock_checker):
        """quick_scan runs quick_scan on all registered checkers."""
        mock_checker.quick_scan.return_value = CheckerResult(
            score=85,
            issues=[],
            suggestions=["建议1"],
        )

        pipeline = CheckerPipeline(checkers=[mock_checker])
        content = "测试内容"

        results = await pipeline.run_quick_scan(content)

        mock_checker.quick_scan.assert_called_once_with(content)
        assert "mock_checker" in results

    @pytest.mark.asyncio
    async def test_quick_scan_empty_content(self, mock_checker):
        """quick_scan handles empty content."""
        mock_checker.quick_scan.return_value = CheckerResult(score=100)

        pipeline = CheckerPipeline(checkers=[mock_checker])
        results = await pipeline.run_quick_scan("")

        assert "mock_checker" in results

    @pytest.mark.asyncio
    async def test_quick_scan_no_checkers(self):
        """quick_scan with no checkers returns empty dict."""
        pipeline = CheckerPipeline(checkers=[])
        results = await pipeline.run_quick_scan("any content")

        assert results == {}

    @pytest.mark.asyncio
    async def test_quick_scan_multiple_checkers(self):
        """quick_scan runs multiple checkers in parallel."""
        checker1 = MagicMock(spec=BaseChecker)
        checker1.name = "checker1"
        checker1.quick_scan = AsyncMock(return_value=CheckerResult(score=90))

        checker2 = MagicMock(spec=BaseChecker)
        checker2.name = "checker2"
        checker2.quick_scan = AsyncMock(return_value=CheckerResult(score=80))

        pipeline = CheckerPipeline(checkers=[checker1, checker2])
        results = await pipeline.run_quick_scan("content")

        assert len(results) == 2
        assert "checker1" in results
        assert "checker2" in results


# =============================================================================
# Deep Analysis Tests
# =============================================================================

class TestDeepAnalysis:
    """Test deep_analyze parallel execution."""

    @pytest.mark.asyncio
    async def test_deep_analyze_runs_all_checkers(self, mock_checker):
        """deep_analyze runs deep_analyze on all registered checkers."""
        mock_checker.deep_analyze.return_value = CheckerResult(
            score=75,
            issues=[{"type": "pacing", "message": "节奏过慢"}],
            suggestions=["加快节奏"],
        )

        pipeline = CheckerPipeline(checkers=[mock_checker])
        content = "测试内容"
        context = {"chapter": 1, "outline": "主线"}

        results = await pipeline.run_deep_analysis(content, context)

        mock_checker.deep_analyze.assert_called_once_with(content, context)
        assert "mock_checker" in results

    @pytest.mark.asyncio
    async def test_deep_analyze_no_checkers(self):
        """deep_analyze with no checkers returns empty dict."""
        pipeline = CheckerPipeline(checkers=[])
        results = await pipeline.run_deep_analysis("content", {})

        assert results == {}

    @pytest.mark.asyncio
    async def test_deep_analyze_multiple_checkers(self):
        """deep_analyze runs multiple checkers in parallel."""
        checker1 = MagicMock(spec=BaseChecker)
        checker1.name = "checker1"
        checker1.deep_analyze = AsyncMock(return_value=CheckerResult(score=85))

        checker2 = MagicMock(spec=BaseChecker)
        checker2.name = "checker2"
        checker2.deep_analyze = AsyncMock(return_value=CheckerResult(score=70))

        pipeline = CheckerPipeline(checkers=[checker1, checker2])
        results = await pipeline.run_deep_analysis("content", {"key": "value"})

        assert len(results) == 2


# =============================================================================
# Aggregate Results Tests
# =============================================================================

class TestAggregateResults:
    """Test result aggregation."""

    def test_aggregate_empty_results(self):
        """aggregate_results handles empty results dict."""
        pipeline = CheckerPipeline(checkers=[])

        aggregated = pipeline.aggregate_results({})

        assert aggregated["overall_score"] == 100
        assert aggregated["total_issues"] == 0
        assert aggregated["issue_breakdown"] == {}

    def test_aggregate_single_checker(self):
        """aggregate_results computes correct stats for single checker."""
        pipeline = CheckerPipeline(checkers=[])

        results = {
            "checker1": CheckerResult(
                score=80,
                issues=[{"type": "error", "message": "问题1"}],
                suggestions=["建议1", "建议2"],
            )
        }

        aggregated = pipeline.aggregate_results(results)

        assert aggregated["overall_score"] == 80
        assert aggregated["total_issues"] == 1
        assert aggregated["issue_breakdown"] == {"checker1": 1}
        assert len(aggregated["all_suggestions"]) == 2

    def test_aggregate_multiple_checkers(self):
        """aggregate_results averages scores from multiple checkers."""
        pipeline = CheckerPipeline(checkers=[])

        results = {
            "checker1": CheckerResult(score=100),
            "checker2": CheckerResult(score=80),
            "checker3": CheckerResult(score=60),
        }

        aggregated = pipeline.aggregate_results(results)

        assert aggregated["overall_score"] == 80  # (100 + 80 + 60) / 3
        assert aggregated["checker_scores"]["checker1"] == 100
        assert aggregated["checker_scores"]["checker2"] == 80
        assert aggregated["checker_scores"]["checker3"] == 60

    def test_aggregate_severity_classification(self):
        """aggregate_results classifies severity based on score."""
        pipeline = CheckerPipeline(checkers=[])

        # High severity (score < 40)
        results_low = {"c1": CheckerResult(score=30)}
        aggregated_low = pipeline.aggregate_results(results_low)
        assert aggregated_low["severity"] == "critical"

        # Medium severity (score 60-79)
        results_med = {"c1": CheckerResult(score=70)}
        aggregated_med = pipeline.aggregate_results(results_med)
        assert aggregated_med["severity"] == "medium"

        # Low severity (score >= 80)
        results_high = {"c1": CheckerResult(score=90)}
        aggregated_high = pipeline.aggregate_results(results_high)
        assert aggregated_high["severity"] == "low"


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Test error handling in checker execution."""

    @pytest.mark.asyncio
    async def test_checker_exception_returns_zero_score(self, mock_checker):
        """Exception in checker returns CheckerResult with score 0."""
        mock_checker.quick_scan = AsyncMock(side_effect=RuntimeError("Test error"))

        pipeline = CheckerPipeline(checkers=[mock_checker])
        results = await pipeline.run_quick_scan("content")

        assert "mock_checker" in results
        assert results["mock_checker"].score == 0
        assert len(results["mock_checker"].issues) == 1
        assert "checker_error" in results["mock_checker"].issues[0]["type"]

    @pytest.mark.asyncio
    async def test_multiple_checkers_one_fails(self):
        """One checker failing doesn't affect others."""
        checker1 = MagicMock(spec=BaseChecker)
        checker1.name = "good_checker"
        checker1.quick_scan = AsyncMock(return_value=CheckerResult(score=95))

        checker2 = MagicMock(spec=BaseChecker)
        checker2.name = "bad_checker"
        checker2.quick_scan = AsyncMock(side_effect=RuntimeError("Failed"))

        pipeline = CheckerPipeline(checkers=[checker1, checker2])
        results = await pipeline.run_quick_scan("content")

        assert results["good_checker"].score == 95
        assert results["bad_checker"].score == 0
        assert len(results) == 2