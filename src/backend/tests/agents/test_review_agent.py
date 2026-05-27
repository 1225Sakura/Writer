"""Tests for ReviewAgent — multi-round quality review agent.

Covers:
- Happy path: three-phase review (quick scan, deep analysis, cross-validation)
- Error handling: empty content, missing pipeline, checker failures
- Cross-validation: score disagreements, issue count disagreements, missing phases
- Report synthesis and confidence adjustment
"""

from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.agents.base import AgentContext, AgentResult
from backend.agents.review_agent import ReviewAgent
from backend.agents.checkers.base import CheckerResult
from backend.utils.exceptions import CheckerAnalysisError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_review_agent() -> ReviewAgent:
    provider = MagicMock()
    provider.generate = AsyncMock(return_value="ok")
    provider.name = "mock_provider"
    event_bus = AsyncMock()
    event_bus.publish = AsyncMock()
    return ReviewAgent(provider=provider, event_bus=event_bus)


def _make_checker_result(score=85, issues=None, suggestions=None):
    return CheckerResult(
        score=score,
        issues=issues or [],
        suggestions=suggestions or [],
    )


def _make_mock_pipeline(quick_results=None, deep_results=None, aggregate=None):
    pipeline = MagicMock()
    pipeline.run_quick_scan = AsyncMock(return_value=quick_results or {})
    pipeline.run_deep_analysis = AsyncMock(return_value=deep_results or {})
    pipeline.aggregate_results = MagicMock(return_value=aggregate or {
        "overall_score": 85,
        "severity": "low",
        "issue_breakdown": {},
        "checker_scores": {},
    })
    return pipeline


# ===========================================================================
# Execute Tests
# ===========================================================================

class TestReviewAgentExecute:
    """Test execute method."""

    @pytest.mark.asyncio
    async def test_empty_content_returns_zero_score(self):
        agent = _make_review_agent()
        context = AgentContext(task="")
        result = await agent.execute(context)
        assert result.content["overall_score"] == 0
        assert result.content["severity"] == "critical"
        assert any("empty" in w.lower() for w in result.warnings)

    @pytest.mark.asyncio
    async def test_no_pipeline_returns_empty_results(self):
        agent = _make_review_agent()
        # No pipeline set
        context = AgentContext(task="some chapter content")
        result = await agent.execute(context)
        assert result.content["overall_score"] == 100  # manual aggregate with no results
        assert any("Quick scan" in w for w in result.warnings)

    @pytest.mark.asyncio
    async def test_with_pipeline_returns_full_report(self):
        agent = _make_review_agent()
        quick = {"pacing": _make_checker_result(80)}
        deep = {"pacing": _make_checker_result(85)}
        pipeline = _make_mock_pipeline(quick_results=quick, deep_results=deep)
        agent.set_pipeline(pipeline)

        context = AgentContext(task="chapter content", settings={"context": {}})
        result = await agent.execute(context)
        assert "overall_score" in result.content
        assert result.metadata["phases_completed"] == 3

    @pytest.mark.asyncio
    async def test_confidence_based_on_severity(self):
        agent = _make_review_agent()
        quick = {"pacing": _make_checker_result(90)}
        deep = {"pacing": _make_checker_result(90)}
        pipeline = _make_mock_pipeline(
            quick_results=quick,
            deep_results=deep,
            aggregate={"overall_score": 90, "severity": "low", "issue_breakdown": {}, "checker_scores": {}},
        )
        agent.set_pipeline(pipeline)

        context = AgentContext(task="content")
        result = await agent.execute(context)
        assert result.confidence == 0.85  # low severity

    @pytest.mark.asyncio
    async def test_confidence_adjusted_for_many_disagreements(self):
        agent = _make_review_agent()
        # Quick finds many issues, deep finds none -> disagreements
        quick = {"pacing": _make_checker_result(40, issues=[{"type": "pacing", "message": "too slow"}] * 5)}
        deep = {"pacing": _make_checker_result(90, issues=[])}
        pipeline = _make_mock_pipeline(
            quick_results=quick,
            deep_results=deep,
            aggregate={"overall_score": 65, "severity": "medium", "issue_breakdown": {}, "checker_scores": {}},
        )
        agent.set_pipeline(pipeline)

        context = AgentContext(task="content")
        result = await agent.execute(context)
        # Should have reduced confidence due to disagreements
        assert result.confidence < 0.70


# ===========================================================================
# Pipeline Failure Tests
# ===========================================================================

class TestReviewAgentPipelineFailures:
    """Test handling of checker pipeline failures."""

    @pytest.mark.asyncio
    async def test_quick_scan_failure_adds_warning(self):
        agent = _make_review_agent()
        pipeline = MagicMock()
        pipeline.run_quick_scan = AsyncMock(side_effect=CheckerAnalysisError(message="scan failed"))
        pipeline.run_deep_analysis = AsyncMock(return_value={})
        pipeline.aggregate_results = MagicMock(return_value={
            "overall_score": 100, "severity": "low", "issue_breakdown": {}, "checker_scores": {},
        })
        agent.set_pipeline(pipeline)

        context = AgentContext(task="content")
        result = await agent.execute(context)
        assert any("Quick scan" in w for w in result.warnings)

    @pytest.mark.asyncio
    async def test_deep_analysis_failure_adds_warning(self):
        agent = _make_review_agent()
        pipeline = MagicMock()
        pipeline.run_quick_scan = AsyncMock(return_value={})
        pipeline.run_deep_analysis = AsyncMock(side_effect=CheckerAnalysisError(message="deep failed"))
        pipeline.aggregate_results = MagicMock(return_value={
            "overall_score": 100, "severity": "low", "issue_breakdown": {}, "checker_scores": {},
        })
        agent.set_pipeline(pipeline)

        context = AgentContext(task="content")
        result = await agent.execute(context)
        assert any("Deep analysis" in w for w in result.warnings)


# ===========================================================================
# Cross-Validation Tests
# ===========================================================================

class TestCrossValidation:
    """Test _find_disagreements method."""

    def test_score_disagreement(self):
        agent = _make_review_agent()
        quick = {"pacing": CheckerResult(score=40)}
        deep = {"pacing": CheckerResult(score=90)}
        disagreements = agent._find_disagreements(quick, deep)
        score_disagreements = [d for d in disagreements if d["type"] == "score_disagreement"]
        assert len(score_disagreements) == 1

    def test_issue_count_disagreement(self):
        agent = _make_review_agent()
        quick = {"pacing": CheckerResult(score=80, issues=[{"type": "a"}] * 10)}
        deep = {"pacing": CheckerResult(score=80, issues=[{"type": "b"}])}
        disagreements = agent._find_disagreements(quick, deep)
        count_disagreements = [d for d in disagreements if d["type"] == "issue_count_disagreement"]
        assert len(count_disagreements) == 1

    def test_missing_quick_scan(self):
        agent = _make_review_agent()
        quick = {}
        deep = {"pacing": CheckerResult(score=80, issues=[{"type": "a"}])}
        disagreements = agent._find_disagreements(quick, deep)
        assert any(d["type"] == "missing_quick_scan" for d in disagreements)

    def test_missing_deep_analysis(self):
        agent = _make_review_agent()
        quick = {"pacing": CheckerResult(score=80, issues=[{"type": "a"}])}
        deep = {}
        disagreements = agent._find_disagreements(quick, deep)
        assert any(d["type"] == "missing_deep_analysis" for d in disagreements)

    def test_missed_by_quick_scan(self):
        agent = _make_review_agent()
        quick = {"pacing": CheckerResult(score=100, issues=[])}
        deep = {"pacing": CheckerResult(score=60, issues=[{"type": "a"}, {"type": "b"}])}
        disagreements = agent._find_disagreements(quick, deep)
        assert any(d["type"] == "missed_by_quick_scan" for d in disagreements)

    def test_missed_by_deep_analysis(self):
        agent = _make_review_agent()
        quick = {"pacing": CheckerResult(score=60, issues=[{"type": "a"}])}
        deep = {"pacing": CheckerResult(score=100, issues=[])}
        disagreements = agent._find_disagreements(quick, deep)
        assert any(d["type"] == "missed_by_deep_analysis" for d in disagreements)

    def test_no_disagreement(self):
        agent = _make_review_agent()
        quick = {"pacing": CheckerResult(score=85, issues=[{"type": "a"}])}
        deep = {"pacing": CheckerResult(score=85, issues=[{"type": "a"}])}
        disagreements = agent._find_disagreements(quick, deep)
        assert len(disagreements) == 0


# ===========================================================================
# Report Synthesis Tests
# ===========================================================================

class TestReportSynthesis:
    """Test _synthesize_report method."""

    def test_report_with_deep_results(self):
        agent = _make_review_agent()
        quick = {"pacing": CheckerResult(score=80)}
        deep = {"pacing": CheckerResult(score=85, suggestions=["improve pacing"])}
        pipeline = _make_mock_pipeline()
        agent.set_pipeline(pipeline)

        report = agent._synthesize_report(quick, deep, [])
        assert "overall_score" in report
        assert "issues" in report
        assert "suggestions" in report

    def test_report_falls_back_to_quick_when_deep_missing(self):
        agent = _make_review_agent()
        quick = {"pacing": CheckerResult(score=75)}
        deep = {}
        pipeline = _make_mock_pipeline()
        agent.set_pipeline(pipeline)

        report = agent._synthesize_report(quick, deep, [])
        assert "overall_score" in report

    def test_manual_aggregate_empty(self):
        agent = _make_review_agent()
        result = agent._manual_aggregate({})
        assert result["overall_score"] == 100
        assert result["severity"] == "low"

    def test_manual_aggregate_low_severity(self):
        agent = _make_review_agent()
        results = {"pacing": CheckerResult(score=90)}
        result = agent._manual_aggregate(results)
        assert result["severity"] == "low"

    def test_manual_aggregate_medium_severity(self):
        agent = _make_review_agent()
        results = {"pacing": CheckerResult(score=65)}
        result = agent._manual_aggregate(results)
        assert result["severity"] == "medium"

    def test_manual_aggregate_high_severity(self):
        agent = _make_review_agent()
        results = {"pacing": CheckerResult(score=45)}
        result = agent._manual_aggregate(results)
        assert result["severity"] == "high"

    def test_manual_aggregate_critical_severity(self):
        agent = _make_review_agent()
        results = {"pacing": CheckerResult(score=30)}
        result = agent._manual_aggregate(results)
        assert result["severity"] == "critical"


# ===========================================================================
# Pipeline Configuration Tests
# ===========================================================================

class TestPipelineConfig:
    """Test set_pipeline method."""

    def test_set_pipeline(self):
        agent = _make_review_agent()
        assert agent._pipeline is None
        pipeline = MagicMock()
        agent.set_pipeline(pipeline)
        assert agent._pipeline is pipeline
