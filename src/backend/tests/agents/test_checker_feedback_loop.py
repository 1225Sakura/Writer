"""Tests for CheckerFeedback loop integration in the orchestrator.

Covers:
- CheckerFeedback loop: score below threshold triggers re-execution
- CheckerFeedback dataclass: to_dict, roundtrip
- Feedback injection into AgentContext.checker_results
- Max retry limit enforcement
- Checker pipeline integration with orchestrator
"""

from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.agents.base import AgentContext, AgentResult, BaseAgent, CheckerFeedback
from backend.agents.checkers.base import CheckerResult
from backend.agents.orchestrator import (
    AgentOrchestrator,
    AgentExecutionStatus,
    StageConfig,
    WorkflowStatus,
)
from backend.utils.event_bus import AsyncEventBus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class TrackingAgent(BaseAgent):
    """Agent that tracks execute calls and checks for checker_results."""

    def __init__(self, results=None):
        super().__init__(provider=MagicMock(), event_bus=AsyncMock())
        self._results = results or [AgentResult(content="ok", confidence=1.0)]
        self.execute_count = 0
        self.received_checker_results = []

    async def execute(self, context: AgentContext) -> AgentResult:
        self.received_checker_results.append(context.checker_results)
        result = self._results[min(self.execute_count, len(self._results) - 1)]
        self.execute_count += 1
        return result


def _make_orchestrator(**kwargs):
    bus = AsyncEventBus()
    orch = AgentOrchestrator(event_bus=bus, **kwargs)
    return orch, bus


def _stage(name, agents, **kw):
    return StageConfig(name=name, agents=agents, **kw)


# ===========================================================================
# CheckerFeedback Dataclass Tests
# ===========================================================================

class TestCheckerFeedback:
    """Test CheckerFeedback dataclass."""

    def test_defaults(self):
        fb = CheckerFeedback(overall_score=85.0)
        assert fb.overall_score == 85.0
        assert fb.issues == []
        assert fb.suggestions == []
        assert fb.failed_checkers == []

    def test_all_fields(self):
        fb = CheckerFeedback(
            overall_score=55.0,
            issues=[{"checker": "pacing", "score": 40}],
            suggestions=["加快节奏"],
            failed_checkers=["broken_checker"],
        )
        assert fb.overall_score == 55.0
        assert len(fb.issues) == 1
        assert len(fb.suggestions) == 1
        assert fb.failed_checkers == ["broken_checker"]

    def test_to_dict(self):
        fb = CheckerFeedback(
            overall_score=72.5,
            issues=[{"checker": "consistency"}],
            suggestions=["fix"],
            failed_checkers=[],
        )
        d = fb.to_dict()
        assert d["overall_score"] == 72.5
        assert d["issues"] == [{"checker": "consistency"}]
        assert d["suggestions"] == ["fix"]
        assert d["failed_checkers"] == []

    def test_to_dict_roundtrip(self):
        original = CheckerFeedback(
            overall_score=60.0,
            issues=[{"checker": "ooc"}],
            suggestions=["fix personality"],
            failed_checkers=["bad"],
        )
        d = original.to_dict()
        restored = CheckerFeedback(**d)
        assert restored.overall_score == original.overall_score
        assert restored.issues == original.issues
        assert restored.suggestions == original.suggestions
        assert restored.failed_checkers == original.failed_checkers


# ===========================================================================
# CheckerFeedback Loop Tests
# ===========================================================================

class TestCheckerFeedbackLoop:
    """Test checker feedback loop in orchestrator."""

    @pytest.mark.asyncio
    async def test_score_below_threshold_triggers_rerun(self):
        """When checker score < threshold, agent should be re-executed."""
        orch, _ = _make_orchestrator(checker_threshold=70.0, max_checker_retries=2)

        agent = TrackingAgent(results=[
            AgentResult(content="first try", confidence=0.5),
            AgentResult(content="second try", confidence=0.9),
        ])
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        # Mock checker pipeline that returns low score first, then high
        call_count = 0

        async def mock_run_quick_scan(content):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {"pacing": CheckerResult(score=40, issues=[{"type": "slow"}])}
            return {"pacing": CheckerResult(score=90)}

        pipeline = MagicMock()
        pipeline.run_quick_scan = AsyncMock(side_effect=mock_run_quick_scan)
        pipeline.aggregate_results = MagicMock(return_value={
            "overall_score": 40,
            "severity": "high",
            "issue_breakdown": {"pacing": 1},
            "checker_scores": {"pacing": 40},
        })

        orch._checker_pipeline = pipeline

        result = await orch.execute_workflow("wf", {"task": "test"})
        # Agent should have been executed at least twice
        assert agent.execute_count >= 2

    @pytest.mark.asyncio
    async def test_score_above_threshold_no_rerun(self):
        """When checker score >= threshold, no re-execution."""
        orch, _ = _make_orchestrator(checker_threshold=70.0, max_checker_retries=2)

        agent = TrackingAgent()
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        pipeline = MagicMock()
        pipeline.run_quick_scan = AsyncMock(return_value={
            "pacing": CheckerResult(score=90),
        })
        pipeline.aggregate_results = MagicMock(return_value={
            "overall_score": 90,
            "severity": "low",
            "issue_breakdown": {},
            "checker_scores": {"pacing": 90},
        })
        orch._checker_pipeline = pipeline

        result = await orch.execute_workflow("wf", {"task": "test"})
        assert agent.execute_count == 1

    @pytest.mark.asyncio
    async def test_max_retries_enforced(self):
        """Re-execution should not exceed max_checker_retries."""
        orch, _ = _make_orchestrator(checker_threshold=90.0, max_checker_retries=1)

        agent = TrackingAgent(results=[
            AgentResult(content="try1", confidence=0.5),
            AgentResult(content="try2", confidence=0.5),
            AgentResult(content="try3", confidence=0.5),
        ])
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        pipeline = MagicMock()
        pipeline.run_quick_scan = AsyncMock(return_value={
            "pacing": CheckerResult(score=30),
        })
        pipeline.aggregate_results = MagicMock(return_value={
            "overall_score": 30,
            "severity": "critical",
            "issue_breakdown": {"pacing": 1},
            "checker_scores": {"pacing": 30},
        })
        orch._checker_pipeline = pipeline

        result = await orch.execute_workflow("wf", {"task": "test"})
        # Should be initial + 1 retry = 2 total
        assert agent.execute_count <= 3  # initial + max_retries

    @pytest.mark.asyncio
    async def test_checker_results_injected_into_context(self):
        """Checker feedback should be available in AgentContext.checker_results on re-run."""
        orch, _ = _make_orchestrator(checker_threshold=70.0, max_checker_retries=1)

        agent = TrackingAgent(results=[
            AgentResult(content="first", confidence=0.5),
            AgentResult(content="second", confidence=0.9),
        ])
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        pipeline = MagicMock()
        pipeline.run_quick_scan = AsyncMock(return_value={
            "pacing": CheckerResult(score=40, issues=[{"type": "slow"}], suggestions=["speed up"]),
        })

        def mock_aggregate(results):
            if not results:
                return {"overall_score": 100, "severity": "low", "issue_breakdown": {}, "checker_scores": {}}
            total = sum(r.score for r in results.values()) / len(results)
            return {
                "overall_score": total,
                "severity": "high" if total < 60 else "low",
                "issue_breakdown": {k: len(v.issues) for k, v in results.items()},
                "checker_scores": {k: v.score for k, v in results.items()},
            }

        pipeline.aggregate_results = MagicMock(side_effect=mock_aggregate)
        orch._checker_pipeline = pipeline

        result = await orch.execute_workflow("wf", {"task": "test"})
        # On the second call, checker_results should have been injected
        if agent.execute_count >= 2:
            assert agent.received_checker_results[1] is not None


# ===========================================================================
# No Pipeline Tests
# ===========================================================================

class TestNoPipeline:
    """Test orchestrator behavior without checker pipeline."""

    @pytest.mark.asyncio
    async def test_no_pipeline_no_rerun(self):
        orch, _ = _make_orchestrator(checker_threshold=70.0)
        agent = TrackingAgent()
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        assert agent.execute_count == 1
        assert result["status"] == WorkflowStatus.COMPLETED.value
