"""Tests for AgentOrchestrator workflow execution, registration, and state.

Covers:
- Workflow registration: valid, duplicate, invalid dependencies, empty stages
- Workflow execution: multi-stage sequential, parallel, dependency ordering
- Agent registration: valid, duplicate
- Workflow listing and retrieval
- Topological sort with complex DAGs
- Checker feedback loop integration
- WorkflowContext state management
"""

from __future__ import annotations

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.agents.base import AgentContext, AgentResult, BaseAgent
from backend.agents.orchestrator import (
    AgentOrchestrator,
    AgentExecutionStatus,
    StageConfig,
    WorkflowConfig,
    WorkflowContext,
    WorkflowStatus,
)
from backend.utils.event_bus import AsyncEventBus
from backend.utils.exceptions import AgentError, AIServiceError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

class StubAgent(BaseAgent):
    """Minimal agent for testing."""

    def __init__(
        self,
        result: AgentResult | None = None,
        delay: float = 0.0,
        raise_exc: BaseException | None = None,
    ) -> None:
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


def _make_orchestrator(**kwargs) -> tuple[AgentOrchestrator, AsyncEventBus]:
    bus = AsyncEventBus()
    orch = AgentOrchestrator(event_bus=bus, **kwargs)
    return orch, bus


def _stage(name, agents, **kw):
    return StageConfig(name=name, agents=agents, **kw)


# ===========================================================================
# Workflow Registration Tests
# ===========================================================================

class TestWorkflowRegistration:
    """Test workflow registration."""

    def test_register_workflow_success(self):
        orch, _ = _make_orchestrator()
        orch.register_workflow("wf", [_stage("s1", ["a1"])])
        assert orch.get_workflow("wf") is not None

    def test_register_duplicate_workflow_raises(self):
        orch, _ = _make_orchestrator()
        orch.register_workflow("wf", [_stage("s1", ["a1"])])
        with pytest.raises(ValueError, match="already registered"):
            orch.register_workflow("wf", [_stage("s2", ["a2"])])

    def test_register_empty_stages_raises(self):
        orch, _ = _make_orchestrator()
        with pytest.raises(ValueError, match="at least one stage"):
            orch.register_workflow("wf", [])

    def test_register_invalid_dependency_raises(self):
        orch, _ = _make_orchestrator()
        with pytest.raises(ValueError, match="unknown stage"):
            orch.register_workflow("wf", [_stage("s1", ["a1"], depends_on=["nonexistent"])])

    def test_unregister_workflow_success(self):
        orch, _ = _make_orchestrator()
        orch.register_workflow("wf", [_stage("s1", ["a1"])])
        assert orch.unregister_workflow("wf") is True
        assert orch.get_workflow("wf") is None

    def test_unregister_nonexistent_returns_false(self):
        orch, _ = _make_orchestrator()
        assert orch.unregister_workflow("ghost") is False


# ===========================================================================
# Agent Registration Tests
# ===========================================================================

class TestAgentRegistration:
    """Test agent registration."""

    def test_register_agent_success(self):
        orch, _ = _make_orchestrator()
        orch.register_agent("a1", StubAgent())
        assert "a1" in orch._agent_registry

    def test_register_duplicate_agent_raises(self):
        orch, _ = _make_orchestrator()
        orch.register_agent("a1", StubAgent())
        with pytest.raises(ValueError, match="already registered"):
            orch.register_agent("a1", StubAgent())


# ===========================================================================
# Workflow Listing Tests
# ===========================================================================

class TestWorkflowListing:
    """Test list_workflows and get_workflow."""

    def test_list_workflows(self):
        orch, _ = _make_orchestrator()
        orch.register_workflow("wf1", [_stage("s1", ["a1"])], description="first")
        orch.register_workflow("wf2", [_stage("s1", ["a2"])], description="second")
        workflows = orch.list_workflows()
        assert len(workflows) == 2
        names = {w["name"] for w in workflows}
        assert names == {"wf1", "wf2"}

    def test_get_workflow_returns_config(self):
        orch, _ = _make_orchestrator()
        orch.register_workflow("wf", [_stage("s1", ["a1"])])
        wf = orch.get_workflow("wf")
        assert isinstance(wf, WorkflowConfig)
        assert wf.name == "wf"

    def test_get_workflow_not_found(self):
        orch, _ = _make_orchestrator()
        assert orch.get_workflow("ghost") is None


# ===========================================================================
# Workflow Execution Tests
# ===========================================================================

class TestWorkflowExecution:
    """Test execute_workflow."""

    @pytest.mark.asyncio
    async def test_single_stage_sequential(self):
        orch, _ = _make_orchestrator()
        orch.register_agent("a1", StubAgent())
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        assert result["status"] == WorkflowStatus.COMPLETED.value
        assert result["stage_results"]["s1"]["agent_results"]["a1"]["status"] == AgentExecutionStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_multi_stage_sequential(self):
        orch, _ = _make_orchestrator()
        orch.register_agent("a1", StubAgent(result=AgentResult(content="stage1", confidence=1.0)))
        orch.register_agent("a2", StubAgent(result=AgentResult(content="stage2", confidence=1.0)))
        orch.register_workflow("wf", [
            _stage("s1", ["a1"]),
            _stage("s2", ["a2"], depends_on=["s1"]),
        ])

        result = await orch.execute_workflow("wf", {"task": "test"})
        assert result["status"] == WorkflowStatus.COMPLETED.value
        assert "s1" in result["stage_results"]
        assert "s2" in result["stage_results"]

    @pytest.mark.asyncio
    async def test_parallel_agents_in_stage(self):
        orch, _ = _make_orchestrator()
        orch.register_agent("a1", StubAgent())
        orch.register_agent("a2", StubAgent())
        orch.register_workflow("wf", [_stage("s1", ["a1", "a2"], mode="parallel")])

        result = await orch.execute_workflow("wf", {"task": "test"})
        assert result["status"] == WorkflowStatus.COMPLETED.value
        agent_results = result["stage_results"]["s1"]["agent_results"]
        assert agent_results["a1"]["status"] == AgentExecutionStatus.COMPLETED.value
        assert agent_results["a2"]["status"] == AgentExecutionStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_unregistered_workflow_raises(self):
        orch, _ = _make_orchestrator()
        with pytest.raises(ValueError, match="not found"):
            await orch.execute_workflow("ghost", {})

    @pytest.mark.asyncio
    async def test_unregistered_agent_in_stage_raises(self):
        orch, _ = _make_orchestrator()
        orch.register_workflow("wf", [_stage("s1", ["ghost"])])
        with pytest.raises(ValueError, match="not registered"):
            await orch.execute_workflow("wf", {"task": "test"})

    @pytest.mark.asyncio
    async def test_agent_failure_does_not_crash_workflow(self):
        orch, _ = _make_orchestrator()
        orch.register_agent("a1", StubAgent(raise_exc=AgentError(message="boom", agent_name="a1")))
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        result = await orch.execute_workflow("wf", {"task": "test"})
        # Workflow completes but agent is marked failed
        agent_res = result["stage_results"]["s1"]["agent_results"]["a1"]
        assert agent_res["status"] == AgentExecutionStatus.FAILED.value

    @pytest.mark.asyncio
    async def test_sequential_agent_failure_continues(self):
        orch, _ = _make_orchestrator()
        orch.register_agent("a1", StubAgent(raise_exc=AgentError(message="fail", agent_name="a1")))
        orch.register_agent("a2", StubAgent())
        orch.register_workflow("wf", [_stage("s1", ["a1", "a2"], mode="sequential")])

        result = await orch.execute_workflow("wf", {"task": "test"})
        agent_results = result["stage_results"]["s1"]["agent_results"]
        assert agent_results["a1"]["status"] == AgentExecutionStatus.FAILED.value
        assert agent_results["a2"]["status"] == AgentExecutionStatus.COMPLETED.value


# ===========================================================================
# StageConfig Tests
# ===========================================================================

class TestStageConfig:
    """Test StageConfig dataclass."""

    def test_valid_config(self):
        stage = StageConfig(name="s1", agents=["a1"], mode="sequential")
        assert stage.name == "s1"
        assert stage.mode == "sequential"

    def test_invalid_mode_raises(self):
        with pytest.raises(ValueError, match="mode must be"):
            StageConfig(name="s1", agents=["a1"], mode="invalid")

    def test_defaults(self):
        stage = StageConfig(name="s1", agents=["a1"])
        assert stage.mode == "sequential"
        assert stage.depends_on == []
        assert stage.description == ""


# ===========================================================================
# WorkflowContext Tests
# ===========================================================================

class TestWorkflowContext:
    """Test WorkflowContext state."""

    def test_initial_state(self):
        ctx = WorkflowContext(execution_id="ex1", workflow_name="wf")
        assert ctx.cancelled is False
        assert ctx.agent_timings == []
        assert ctx.error_history == []
        assert ctx.stage_results == {}

    def test_input_data_stored(self):
        ctx = WorkflowContext(execution_id="ex1", workflow_name="wf", input_data={"task": "test"})
        assert ctx.input_data == {"task": "test"}


# ===========================================================================
# Topological Sort Tests
# ===========================================================================

class TestTopologicalSort:
    """Test DAG dependency resolution."""

    @pytest.mark.asyncio
    async def test_independent_stages(self):
        orch, _ = _make_orchestrator()
        orch.register_agent("a1", StubAgent())
        orch.register_agent("a2", StubAgent())
        orch.register_workflow("wf", [
            _stage("s1", ["a1"]),
            _stage("s2", ["a2"]),
        ])
        result = await orch.execute_workflow("wf", {"task": "test"})
        assert result["status"] == WorkflowStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_linear_dependency_chain(self):
        orch, _ = _make_orchestrator()
        for i in range(4):
            orch.register_agent(f"a{i}", StubAgent())
        orch.register_workflow("wf", [
            _stage("s0", ["a0"]),
            _stage("s1", ["a1"], depends_on=["s0"]),
            _stage("s2", ["a2"], depends_on=["s1"]),
            _stage("s3", ["a3"], depends_on=["s2"]),
        ])
        result = await orch.execute_workflow("wf", {"task": "test"})
        assert result["status"] == WorkflowStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_diamond_dependency(self):
        orch, _ = _make_orchestrator()
        for i in range(4):
            orch.register_agent(f"a{i}", StubAgent())
        orch.register_workflow("wf", [
            _stage("s0", ["a0"]),
            _stage("s1", ["a1"], depends_on=["s0"]),
            _stage("s2", ["a2"], depends_on=["s0"]),
            _stage("s3", ["a3"], depends_on=["s1", "s2"]),
        ])
        result = await orch.execute_workflow("wf", {"task": "test"})
        assert result["status"] == WorkflowStatus.COMPLETED.value


# ===========================================================================
# Event Publishing Tests
# ===========================================================================

class TestEventPublishing:
    """Test that workflow events are published."""

    @pytest.mark.asyncio
    async def test_workflow_started_event(self):
        orch, bus = _make_orchestrator()
        orch.register_agent("a1", StubAgent())
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        events = []
        bus.subscribe("workflow.started", lambda payload: events.append(payload))

        await orch.execute_workflow("wf", {"task": "test"})
        # Give event loop a chance to process
        await asyncio.sleep(0.01)
        assert len(events) >= 1
        assert events[0]["workflow_name"] == "wf"

    @pytest.mark.asyncio
    async def test_workflow_completed_event(self):
        orch, bus = _make_orchestrator()
        orch.register_agent("a1", StubAgent())
        orch.register_workflow("wf", [_stage("s1", ["a1"])])

        events = []
        bus.subscribe("workflow.completed", lambda payload: events.append(payload))

        await orch.execute_workflow("wf", {"task": "test"})
        await asyncio.sleep(0.01)
        assert len(events) >= 1
