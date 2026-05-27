"""Tests for AgentOrchestrator hardening (US-024 Phase 4.7).

Covers:
- Per-agent timeout via asyncio.wait_for
- Cancellation support (cancel_execution + cancellation between stages/agents)
- WorkflowContext timing and error history tracking
- Specific exception types (no bare except Exception in business logic)
"""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
import pytest_asyncio

from backend.agents.base import AgentContext, AgentResult, BaseAgent
from backend.agents.orchestrator import (
    AgentExecutionStatus,
    AgentOrchestrator,
    AgentTimingRecord,
    StageConfig,
    WorkflowContext,
    WorkflowStatus,
)
from backend.utils.event_bus import AsyncEventBus
from backend.utils.exceptions import (
    AgentError,
    AgentTimeoutError,
    AIServiceError,
    DatabaseError,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


class StubAgent(BaseAgent):
    """Minimal agent for testing. Returns a fixed result after optional delay."""

    def __init__(
        self,
        result: AgentResult | None = None,
        delay: float = 0.0,
        raise_exc: BaseException | None = None,
    ) -> None:
        # BaseAgent.__init__ requires provider and event_bus; use mocks
        super().__init__(provider=MagicMock(), event_bus=AsyncMock())
        self._result = result or AgentResult(content="ok", confidence=1.0)
        self._delay = delay
        self._raise_exc = raise_exc
        self.execute_count = 0

    async def execute(self, context: AgentContext) -> AgentResult:
        self.execute_count += 1
        if self._delay > 0:
            await asyncio.sleep(self._delay)
        if self._raise_exc is not None:
            raise self._raise_exc
        return self._result


def _make_orchestrator(
    agent_timeout: float = 5.0,
    **kwargs,
) -> tuple[AgentOrchestrator, AsyncEventBus]:
    """Create an orchestrator with a real event bus."""
    bus = AsyncEventBus()
    orch = AgentOrchestrator(event_bus=bus, agent_timeout=agent_timeout, **kwargs)
    return orch, bus


def _stage(name: str, agents: list[str], **kw) -> StageConfig:
    return StageConfig(name=name, agents=agents, **kw)


# ---------------------------------------------------------------------------
# Timeout Tests
# ---------------------------------------------------------------------------


class TestAgentTimeout:
    """Per-agent timeout enforcement via asyncio.wait_for."""

    @pytest.mark.asyncio
    async def test_agent_timeout_raises_agent_timeout_error(self) -> None:
        """Agent exceeding timeout should be recorded as failed with timeout error."""
        orch, _ = _make_orchestrator(agent_timeout=0.1)
        slow = StubAgent(delay=5.0)
        orch.register_agent("slow", slow)
        orch.register_workflow("wf", [_stage("s1", ["slow"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        # Agent failure is caught at stage level; workflow completes with failed agent
        agent_res = result["stage_results"]["s1"]["agent_results"]["slow"]
        assert agent_res["status"] == AgentExecutionStatus.FAILED.value
        assert "timed out" in agent_res["error"].lower()

    @pytest.mark.asyncio
    async def test_agent_within_timeout_succeeds(self) -> None:
        """Agent completing before timeout should succeed normally."""
        orch, _ = _make_orchestrator(agent_timeout=5.0)
        fast = StubAgent(delay=0.0)
        orch.register_agent("fast", fast)
        orch.register_workflow("wf", [_stage("s1", ["fast"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        assert result["status"] == WorkflowStatus.COMPLETED.value
        stage_res = result["stage_results"]["s1"]["agent_results"]["fast"]
        assert stage_res["status"] == AgentExecutionStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_timeout_records_timing_and_error(self) -> None:
        """Timeout should record in agent_timings and error_history."""
        orch, _ = _make_orchestrator(agent_timeout=0.05)
        slow = StubAgent(delay=5.0)
        orch.register_agent("slow", slow)
        orch.register_workflow("wf", [_stage("s1", ["slow"])])

        await orch.execute_workflow("wf", {"task": "test"})

        # Find the execution context
        exec_id = list(orch._executions.keys())[0]
        ctx = orch._executions[exec_id]
        assert len(ctx.agent_timings) >= 1
        timing = ctx.agent_timings[0]
        assert timing.agent_name == "slow"
        assert timing.status == AgentExecutionStatus.FAILED.value
        assert timing.error is not None
        assert "timed out" in timing.error.lower()
        assert timing.duration_ms > 0
        # Error history
        assert len(ctx.error_history) >= 1
        assert ctx.error_history[0]["error_type"] == "AgentTimeoutError"


# ---------------------------------------------------------------------------
# Cancellation Tests
# ---------------------------------------------------------------------------


class TestCancellation:
    """Cancellation support via cancel_execution flag."""

    @pytest.mark.asyncio
    async def test_cancel_before_execution_returns_cancelled(self) -> None:
        """Cancelling between stages should return CANCELLED status."""
        orch, _ = _make_orchestrator(agent_timeout=30.0)
        # Two-stage workflow: first completes fast, second is slow
        # Cancel between stages via event handler
        fast = StubAgent(delay=0.0)
        slow = StubAgent(delay=30.0)
        orch.register_agent("fast", fast)
        orch.register_agent("slow", slow)
        orch.register_workflow(
            "wf",
            [_stage("s1", ["fast"]), _stage("s2", ["slow"], depends_on=["s1"])],
        )

        async def on_stage_completed(payload: dict) -> None:
            # Cancel after first stage completes
            await orch.cancel_execution(payload["execution_id"])

        orch._event_bus.subscribe("workflow.stage.completed", on_stage_completed)

        result = await orch.execute_workflow("wf", {"task": "test"})
        # After cancelling between stages, workflow returns cancelled
        assert result["status"] == WorkflowStatus.CANCELLED.value

    @pytest.mark.asyncio
    async def test_cancel_sets_flag(self) -> None:
        """cancel_execution should set the cancelled flag on WorkflowContext."""
        orch, _ = _make_orchestrator()
        ctx = WorkflowContext(execution_id="ex1", workflow_name="wf")
        orch._executions["ex1"] = ctx
        orch._execution_status["ex1"] = WorkflowStatus.RUNNING

        result = await orch.cancel_execution("ex1")
        assert result is True
        assert ctx.cancelled is True
        assert orch._execution_status["ex1"] == WorkflowStatus.CANCELLED

    @pytest.mark.asyncio
    async def test_cancel_nonexistent_execution(self) -> None:
        """Cancelling a non-existent execution should return False."""
        orch, _ = _make_orchestrator()
        result = await orch.cancel_execution("nonexistent")
        assert result is False

    @pytest.mark.asyncio
    async def test_cancel_between_sequential_agents(self) -> None:
        """In sequential mode, agents after cancellation should be skipped."""
        orch, _ = _make_orchestrator(agent_timeout=5.0)
        a1 = StubAgent(delay=0.0)
        a2 = StubAgent(delay=0.0)
        orch.register_agent("a1", a1)
        orch.register_agent("a2", a2)
        orch.register_workflow("wf", [_stage("s1", ["a1", "a2"], mode="sequential")])

        # Monkey-patch _execute_agent to cancel after first agent
        original = orch._execute_agent
        call_count = 0

        async def patched_execute(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                result = await original(*args, **kwargs)
                # Cancel after first agent completes
                exec_id = kwargs.get("wf_context", args[3] if len(args) > 3 else None)
                if exec_id and hasattr(exec_id, "cancelled"):
                    exec_id.cancelled = True
                return result
            return await original(*args, **kwargs)

        orch._execute_agent = patched_execute

        result = await orch.execute_workflow("wf", {"task": "test"})
        stage_res = result["stage_results"]["s1"]["agent_results"]
        # a1 should complete, a2 should be skipped
        assert stage_res["a1"]["status"] == AgentExecutionStatus.COMPLETED.value
        assert stage_res["a2"]["status"] == AgentExecutionStatus.SKIPPED.value


# ---------------------------------------------------------------------------
# Timing & Error History Tests
# ---------------------------------------------------------------------------


class TestTimingAndErrorHistory:
    """WorkflowContext tracks per-agent timing and error history."""

    @pytest.mark.asyncio
    async def test_timing_recorded_on_success(self) -> None:
        """Successful agent execution should produce a timing record."""
        orch, _ = _make_orchestrator()
        agent = StubAgent()
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        assert result["status"] == WorkflowStatus.COMPLETED.value

        exec_id = result["execution_id"]
        ctx = orch._executions[exec_id]
        assert len(ctx.agent_timings) == 1
        timing = ctx.agent_timings[0]
        assert timing.agent_name == "a1"
        assert timing.stage_name == "s1"
        assert timing.status == AgentExecutionStatus.COMPLETED.value
        assert timing.duration_ms >= 0
        assert timing.started_at != ""
        assert timing.completed_at != ""
        assert timing.error is None

    @pytest.mark.asyncio
    async def test_timing_recorded_on_failure(self) -> None:
        """Failed agent execution should record timing with error."""
        orch, _ = _make_orchestrator()
        agent = StubAgent(
            raise_exc=AgentError(message="boom", agent_name="a1")
        )
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        # Agent failure is caught at stage level; workflow completes
        exec_id = result["execution_id"]
        ctx = orch._executions[exec_id]
        assert len(ctx.agent_timings) == 1
        timing = ctx.agent_timings[0]
        assert timing.status == AgentExecutionStatus.FAILED.value
        assert timing.error is not None
        assert "boom" in timing.error

    @pytest.mark.asyncio
    async def test_error_history_populated(self) -> None:
        """Errors should be appended to error_history."""
        orch, _ = _make_orchestrator()
        agent = StubAgent(
            raise_exc=AIServiceError(message="provider down")
        )
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        exec_id = result["execution_id"]
        ctx = orch._executions[exec_id]
        assert len(ctx.error_history) >= 1
        err = ctx.error_history[0]
        assert err["agent_name"] == "a1"
        assert err["error_type"] == "AIServiceError"
        assert "provider down" in err["message"]

    @pytest.mark.asyncio
    async def test_result_dict_includes_duration_ms(self) -> None:
        """Agent result dict should include duration_ms field."""
        orch, _ = _make_orchestrator()
        agent = StubAgent()
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        agent_result = result["stage_results"]["s1"]["agent_results"]["a1"]
        assert "duration_ms" in agent_result
        assert agent_result["duration_ms"] >= 0

    @pytest.mark.asyncio
    async def test_multiple_agents_timing(self) -> None:
        """Each agent in a stage should get its own timing record."""
        orch, _ = _make_orchestrator()
        orch.register_agent("a1", StubAgent())
        orch.register_agent("a2", StubAgent())
        orch.register_workflow(
            "wf", [_stage("s1", ["a1", "a2"], mode="parallel")]
        )

        result = await orch.execute_workflow("wf", {"task": "test"})
        exec_id = result["execution_id"]
        ctx = orch._executions[exec_id]
        assert len(ctx.agent_timings) == 2
        names = {t.agent_name for t in ctx.agent_timings}
        assert names == {"a1", "a2"}


# ---------------------------------------------------------------------------
# Specific Exception Type Tests
# ---------------------------------------------------------------------------


class TestSpecificExceptions:
    """Verify that orchestrator raises/catches specific exception types."""

    @pytest.mark.asyncio
    async def test_unregistered_agent_raises_value_error(self) -> None:
        """Referencing an unregistered agent should raise ValueError."""
        orch, _ = _make_orchestrator()
        orch.register_workflow("wf", [_stage("s1", ["ghost"])])

        with pytest.raises(ValueError, match="not registered"):
            await orch.execute_workflow("wf", {"task": "test"})

    @pytest.mark.asyncio
    async def test_agent_error_recorded_in_stage(self) -> None:
        """AgentError from agent should be recorded in stage agent_results."""
        orch, _ = _make_orchestrator()
        agent = StubAgent(
            raise_exc=AgentError(message="agent failed", agent_name="a1")
        )
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        agent_res = result["stage_results"]["s1"]["agent_results"]["a1"]
        assert agent_res["status"] == AgentExecutionStatus.FAILED.value
        assert "agent failed" in agent_res["error"]

    @pytest.mark.asyncio
    async def test_ai_service_error_recorded_in_stage(self) -> None:
        """AIServiceError from agent should be recorded in stage agent_results."""
        orch, _ = _make_orchestrator()
        agent = StubAgent(raise_exc=AIServiceError(message="API down"))
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        agent_res = result["stage_results"]["s1"]["agent_results"]["a1"]
        assert agent_res["status"] == AgentExecutionStatus.FAILED.value
        assert "API down" in agent_res["error"]

    @pytest.mark.asyncio
    async def test_database_error_recorded_in_stage(self) -> None:
        """DatabaseError should be recorded in stage agent_results."""
        orch, _ = _make_orchestrator()
        agent = StubAgent(raise_exc=DatabaseError(message="db gone"))
        orch.register_agent("a1", agent)
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        agent_res = result["stage_results"]["s1"]["agent_results"]["a1"]
        assert agent_res["status"] == AgentExecutionStatus.FAILED.value
        assert "db gone" in agent_res["error"]


# ---------------------------------------------------------------------------
# WorkflowContext Data Model Tests
# ---------------------------------------------------------------------------


class TestWorkflowContext:
    """WorkflowContext data model enhancements."""

    def test_context_has_timings_field(self) -> None:
        ctx = WorkflowContext(execution_id="ex1", workflow_name="wf")
        assert ctx.agent_timings == []
        assert ctx.error_history == []
        assert ctx.cancelled is False

    def test_timing_record_fields(self) -> None:
        rec = AgentTimingRecord(
            agent_name="a1",
            stage_name="s1",
            started_at="2025-01-01T00:00:00",
            completed_at="2025-01-01T00:00:01",
            duration_ms=1000.0,
            status="completed",
        )
        assert rec.agent_name == "a1"
        assert rec.duration_ms == 1000.0
        assert rec.error is None

    def test_timing_record_with_error(self) -> None:
        rec = AgentTimingRecord(
            agent_name="a1",
            stage_name="s1",
            status="failed",
            error="something broke",
        )
        assert rec.error == "something broke"
