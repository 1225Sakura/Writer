"""Tests for ConditionalEdge routing in AgentOrchestrator."""

from __future__ import annotations

import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, MagicMock

from backend.agents.base import AgentContext, AgentResult, BaseAgent
from backend.agents.orchestrator import (
    AgentOrchestrator,
    ConditionalEdge,
    StageConfig,
    WorkflowContext,
)
from backend.utils.event_bus import AsyncEventBus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class StubAgent(BaseAgent):
    """Minimal agent returning a fixed result."""

    def __init__(self, result: AgentResult | None = None) -> None:
        super().__init__(provider=MagicMock(), event_bus=AsyncMock())
        self._result = result or AgentResult(content="ok", confidence=1.0)

    async def execute(self, context: AgentContext) -> AgentResult:
        return self._result


def _make_orchestrator() -> tuple[AgentOrchestrator, AsyncEventBus]:
    bus = AsyncEventBus()
    orch = AgentOrchestrator(event_bus=bus, agent_timeout=5.0)
    return orch, bus


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestConditionalEdgeDataclass:
    """Test ConditionalEdge dataclass construction."""

    def test_create_conditional_edge(self):
        """ConditionalEdge stores all fields correctly."""
        edge = ConditionalEdge(
            source_agent="reviewer",
            condition=lambda r: r.get("confidence", 0) < 0.6,
            true_target="rewrite",
            false_target="publish",
        )
        assert edge.source_agent == "reviewer"
        assert edge.true_target == "rewrite"
        assert edge.false_target == "publish"
        assert edge.condition({"confidence": 0.3}) is True
        assert edge.condition({"confidence": 0.9}) is False


class TestEvaluateConditionalEdge:
    """Test _evaluate_conditional_edge method."""

    @pytest.mark.asyncio
    async def test_condition_true_returns_true_target(self):
        """When condition is True, returns true_target."""
        orch, _ = _make_orchestrator()
        edge = ConditionalEdge(
            source_agent="checker",
            condition=lambda r: True,
            true_target="fix_stage",
            false_target="done_stage",
        )
        result = await orch._evaluate_conditional_edge(edge, {"score": 30})
        assert result == "fix_stage"

    @pytest.mark.asyncio
    async def test_condition_false_returns_false_target(self):
        """When condition is False, returns false_target."""
        orch, _ = _make_orchestrator()
        edge = ConditionalEdge(
            source_agent="checker",
            condition=lambda r: False,
            true_target="fix_stage",
            false_target="done_stage",
        )
        result = await orch._evaluate_conditional_edge(edge, {"score": 90})
        assert result == "done_stage"

    @pytest.mark.asyncio
    async def test_condition_with_score_threshold(self):
        """Condition can evaluate score < 60 from agent result."""
        orch, _ = _make_orchestrator()
        edge = ConditionalEdge(
            source_agent="reviewer",
            condition=lambda r: r.get("confidence", 1.0) < 0.6,
            true_target="rewrite",
            false_target="publish",
        )
        # Low confidence -> true_target
        result = await orch._evaluate_conditional_edge(edge, {"confidence": 0.3})
        assert result == "rewrite"

        # High confidence -> false_target
        result = await orch._evaluate_conditional_edge(edge, {"confidence": 0.9})
        assert result == "publish"

    @pytest.mark.asyncio
    async def test_condition_exception_defaults_to_false_target(self):
        """If condition raises, defaults to false_target."""
        orch, _ = _make_orchestrator()

        def bad_condition(r):
            raise ValueError("broken")

        edge = ConditionalEdge(
            source_agent="checker",
            condition=bad_condition,
            true_target="fix",
            false_target="skip",
        )
        result = await orch._evaluate_conditional_edge(edge, {"data": 1})
        assert result == "skip"


class TestConditionalEdgeInWorkflow:
    """Test ConditionalEdge integration within workflow execution."""

    @pytest.mark.asyncio
    async def test_conditional_edge_with_agent_result(self):
        """ConditionalEdge works with real agent result dicts."""
        orch, bus = _make_orchestrator()

        agent = StubAgent(AgentResult(content="low quality text", confidence=0.4))
        orch.register_agent("writer", agent)

        orch.register_workflow(
            "test_flow",
            stages=[
                StageConfig(name="write", agents=["writer"]),
            ],
        )

        # After execution, evaluate conditional edge on the result
        result = await orch.execute_workflow(
            "test_flow", context={"task": "write chapter"}
        )

        writer_result = result["stage_results"]["write"]["agent_results"]["writer"]

        edge = ConditionalEdge(
            source_agent="writer",
            condition=lambda r: r.get("confidence", 1.0) < 0.6,
            true_target="rewrite",
            false_target="publish",
        )

        target = await orch._evaluate_conditional_edge(edge, writer_result)
        assert target == "rewrite"
