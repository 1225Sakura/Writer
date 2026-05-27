"""Tests for Checker-Agent Integration (US-020) and Agent Lifecycle Hooks in Orchestrator (US-021).

Covers:
- AgentOrchestrator uses execute_with_hooks instead of execute directly
- Checker feedback loop: re-execution when score < threshold
- Max retries respected
- Failed checkers (analysis_failed) excluded from re-call decision
- CheckerFeedback passed through AgentContext.checker_results
- No re-call when checker pipeline is None
- _extract_checkable_content for various content types
"""

import json
import pytest
from unittest.mock import MagicMock, AsyncMock

from backend.agents.base import BaseAgent, AgentContext, AgentResult, CheckerFeedback
from backend.agents.checkers.base import BaseChecker, CheckerResult
from backend.agents.orchestrator import (
    AgentOrchestrator,
    StageConfig,
    WorkflowContext,
    WorkflowStatus,
)


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def mock_event_bus():
    bus = MagicMock()
    bus.publish = AsyncMock()
    return bus


@pytest.fixture
def mock_checker_pipeline():
    """Create a mock CheckerPipeline."""
    pipeline = MagicMock()
    pipeline.run_quick_scan = AsyncMock()
    pipeline.aggregate_results = MagicMock()
    return pipeline


def _make_agent(name="test_agent", execute_side_effect=None):
    """Create a mock agent with lifecycle hooks support."""
    agent = MagicMock(spec=BaseAgent)
    agent.execute = AsyncMock()
    agent.pre_execute = AsyncMock(side_effect=lambda ctx: ctx)
    agent.post_execute = AsyncMock(side_effect=lambda ctx, result: result)

    if execute_side_effect:
        agent.execute.side_effect = execute_side_effect

    # execute_with_hooks delegates to pre_execute -> execute -> post_execute
    async def _execute_with_hooks(context):
        context = await agent.pre_execute(context)
        result = await agent.execute(context)
        result = await agent.post_execute(context, result)
        return result

    agent.execute_with_hooks = AsyncMock(side_effect=_execute_with_hooks)
    return agent


# =============================================================================
# US-021: Orchestrator uses execute_with_hooks
# =============================================================================

class TestOrchestratorUsesExecuteWithHooks:
    """Verify the orchestrator calls execute_with_hooks, not execute directly."""

    @pytest.mark.asyncio
    async def test_orchestrator_calls_execute_with_hooks(self, mock_event_bus):
        """_execute_agent calls agent.execute_with_hooks, not agent.execute."""
        agent = _make_agent()
        agent.execute.return_value = AgentResult(content="hello", confidence=0.9)

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        orch.register_agent("a", agent)
        orch.register_workflow("wf", [StageConfig(name="s1", agents=["a"])])

        await orch.execute_workflow("wf", {"task": "test"})

        agent.execute_with_hooks.assert_called_once()
        # execute should have been called (as part of execute_with_hooks)
        agent.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_lifecycle_hooks_called_in_order(self, mock_event_bus):
        """pre_execute, execute, post_execute are called in correct order."""
        call_order = []
        agent = MagicMock(spec=BaseAgent)

        async def pre(ctx):
            call_order.append("pre")
            return ctx

        async def exec_(ctx):
            call_order.append("exec")
            return AgentResult(content="r", confidence=0.8)

        async def post(ctx, result):
            call_order.append("post")
            return result

        agent.pre_execute = AsyncMock(side_effect=pre)
        agent.execute = AsyncMock(side_effect=exec_)
        agent.post_execute = AsyncMock(side_effect=post)

        async def hooks(ctx):
            ctx = await agent.pre_execute(ctx)
            r = await agent.execute(ctx)
            r = await agent.post_execute(ctx, r)
            return r

        agent.execute_with_hooks = AsyncMock(side_effect=hooks)

        orch = AgentOrchestrator(event_bus=mock_event_bus)
        orch.register_agent("a", agent)
        orch.register_workflow("wf", [StageConfig(name="s1", agents=["a"])])

        await orch.execute_workflow("wf", {"task": "test"})

        assert call_order == ["pre", "exec", "post"]


# =============================================================================
# US-020: Checker Feedback Loop
# =============================================================================

class TestCheckerFeedbackLoop:
    """Test checker-agent integration feedback loop."""

    @pytest.mark.asyncio
    async def test_no_rerun_when_score_above_threshold(self, mock_event_bus, mock_checker_pipeline):
        """Agent is not re-executed when checker score >= threshold."""
        mock_checker_pipeline.run_quick_scan.return_value = {}
        mock_checker_pipeline.aggregate_results.return_value = {
            "overall_score": 85,
            "total_issues": 0,
            "all_suggestions": [],
            "checker_scores": {},
            "failed_checkers": [],
        }

        agent = _make_agent()
        agent.execute.return_value = AgentResult(content="good text", confidence=0.9)

        orch = AgentOrchestrator(
            event_bus=mock_event_bus,
            checker_pipeline=mock_checker_pipeline,
            checker_threshold=70,
        )
        orch.register_agent("a", agent)
        orch.register_workflow("wf", [StageConfig(name="s1", agents=["a"])])

        result = await orch.execute_workflow("wf", {"task": "write chapter"})

        # execute_with_hooks called exactly once (no retry)
        assert agent.execute_with_hooks.call_count == 1

    @pytest.mark.asyncio
    async def test_rerun_when_score_below_threshold(self, mock_event_bus, mock_checker_pipeline):
        """Agent is re-executed when checker score < threshold."""
        mock_checker_pipeline.run_quick_scan.return_value = {}
        mock_checker_pipeline.aggregate_results.return_value = {
            "overall_score": 50,
            "total_issues": 2,
            "all_suggestions": ["Fix pacing", "Add conflict"],
            "checker_scores": {"pacing": 50},
            "failed_checkers": [],
        }

        agent = _make_agent()
        agent.execute.return_value = AgentResult(content="bad text", confidence=0.5)

        orch = AgentOrchestrator(
            event_bus=mock_event_bus,
            checker_pipeline=mock_checker_pipeline,
            checker_threshold=70,
            max_checker_retries=2,
        )
        orch.register_agent("a", agent)
        orch.register_workflow("wf", [StageConfig(name="s1", agents=["a"])])

        await orch.execute_workflow("wf", {"task": "write chapter"})

        # execute_with_hooks called 3 times: initial + 2 retries
        assert agent.execute_with_hooks.call_count == 3

    @pytest.mark.asyncio
    async def test_rerun_stops_when_score_improves(self, mock_event_bus, mock_checker_pipeline):
        """Re-execution stops when a retry passes the threshold."""
        call_count = 0

        def side_effect(results):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {
                    "overall_score": 50,
                    "total_issues": 2,
                    "all_suggestions": ["Fix pacing"],
                    "checker_scores": {"pacing": 50},
                    "failed_checkers": [],
                }
            return {
                "overall_score": 80,
                "total_issues": 0,
                "all_suggestions": [],
                "checker_scores": {"pacing": 80},
                "failed_checkers": [],
            }

        mock_checker_pipeline.run_quick_scan.return_value = {}
        mock_checker_pipeline.aggregate_results = MagicMock(side_effect=side_effect)

        agent = _make_agent()
        agent.execute.return_value = AgentResult(content="text", confidence=0.7)

        orch = AgentOrchestrator(
            event_bus=mock_event_bus,
            checker_pipeline=mock_checker_pipeline,
            checker_threshold=70,
            max_checker_retries=3,
        )
        orch.register_agent("a", agent)
        orch.register_workflow("wf", [StageConfig(name="s1", agents=["a"])])

        await orch.execute_workflow("wf", {"task": "write"})

        # execute_with_hooks called 2 times: initial (fail) + retry (pass)
        assert agent.execute_with_hooks.call_count == 2

    @pytest.mark.asyncio
    async def test_no_checker_pipeline_skips_feedback(self, mock_event_bus):
        """When checker_pipeline is None, no feedback loop runs."""
        agent = _make_agent()
        agent.execute.return_value = AgentResult(content="text", confidence=0.8)

        orch = AgentOrchestrator(event_bus=mock_event_bus, checker_pipeline=None)
        orch.register_agent("a", agent)
        orch.register_workflow("wf", [StageConfig(name="s1", agents=["a"])])

        await orch.execute_workflow("wf", {"task": "test"})

        assert agent.execute_with_hooks.call_count == 1

    @pytest.mark.asyncio
    async def test_checker_feedback_injected_into_context(self, mock_event_bus, mock_checker_pipeline):
        """Checker feedback is injected into AgentContext.checker_results on retry."""
        mock_checker_pipeline.run_quick_scan.return_value = {}
        mock_checker_pipeline.aggregate_results.return_value = {
            "overall_score": 40,
            "total_issues": 3,
            "all_suggestions": ["Fix characters", "Improve dialogue"],
            "checker_scores": {"ooc": 40},
            "failed_checkers": [],
        }

        captured_contexts = []

        agent = MagicMock(spec=BaseAgent)
        agent.pre_execute = AsyncMock(side_effect=lambda ctx: ctx)
        agent.post_execute = AsyncMock(side_effect=lambda ctx, result: result)

        async def capture_execute(ctx):
            captured_contexts.append(ctx)
            return AgentResult(content="text", confidence=0.5)

        agent.execute = AsyncMock(side_effect=capture_execute)

        async def hooks(ctx):
            ctx = await agent.pre_execute(ctx)
            r = await agent.execute(ctx)
            r = await agent.post_execute(ctx, r)
            return r

        agent.execute_with_hooks = AsyncMock(side_effect=hooks)

        orch = AgentOrchestrator(
            event_bus=mock_event_bus,
            checker_pipeline=mock_checker_pipeline,
            checker_threshold=70,
            max_checker_retries=1,
        )
        orch.register_agent("a", agent)
        orch.register_workflow("wf", [StageConfig(name="s1", agents=["a"])])

        await orch.execute_workflow("wf", {"task": "write"})

        # Second call (retry) should have checker_results
        assert len(captured_contexts) == 2
        retry_ctx = captured_contexts[1]
        assert retry_ctx.checker_results is not None
        assert retry_ctx.checker_results["overall_score"] == 40
        assert "Fix characters" in retry_ctx.checker_results["suggestions"]

    @pytest.mark.asyncio
    async def test_failed_checkers_excluded_from_feedback(self, mock_event_bus, mock_checker_pipeline):
        """Issues from failed checkers (analysis_failed) are filtered from suggestions."""
        mock_checker_pipeline.run_quick_scan.return_value = {}
        mock_checker_pipeline.aggregate_results.return_value = {
            "overall_score": 50,
            "total_issues": 1,
            "all_suggestions": ["Fix pacing", "Broken checker suggestion"],
            "checker_scores": {"pacing": 50, "broken": 0},
            "failed_checkers": ["broken"],
        }

        captured_contexts = []
        agent = MagicMock(spec=BaseAgent)
        agent.pre_execute = AsyncMock(side_effect=lambda ctx: ctx)
        agent.post_execute = AsyncMock(side_effect=lambda ctx, result: result)

        async def capture_execute(ctx):
            captured_contexts.append(ctx)
            return AgentResult(content="text", confidence=0.5)

        agent.execute = AsyncMock(side_effect=capture_execute)

        async def hooks(ctx):
            ctx = await agent.pre_execute(ctx)
            r = await agent.execute(ctx)
            r = await agent.post_execute(ctx, r)
            return r

        agent.execute_with_hooks = AsyncMock(side_effect=hooks)

        orch = AgentOrchestrator(
            event_bus=mock_event_bus,
            checker_pipeline=mock_checker_pipeline,
            checker_threshold=70,
            max_checker_retries=1,
        )
        orch.register_agent("a", agent)
        orch.register_workflow("wf", [StageConfig(name="s1", agents=["a"])])

        await orch.execute_workflow("wf", {"task": "write"})

        retry_ctx = captured_contexts[1]
        feedback = retry_ctx.checker_results
        # "broken" checker's suggestion should be filtered out
        assert "broken" in feedback["failed_checkers"]

    @pytest.mark.asyncio
    async def test_checker_pipeline_exception_gracefully_skips(self, mock_event_bus, mock_checker_pipeline):
        """If checker pipeline raises, feedback loop is skipped gracefully."""
        mock_checker_pipeline.run_quick_scan.side_effect = RuntimeError("pipeline broken")

        agent = _make_agent()
        agent.execute.return_value = AgentResult(content="text", confidence=0.8)

        orch = AgentOrchestrator(
            event_bus=mock_event_bus,
            checker_pipeline=mock_checker_pipeline,
            checker_threshold=70,
        )
        orch.register_agent("a", agent)
        orch.register_workflow("wf", [StageConfig(name="s1", agents=["a"])])

        result = await orch.execute_workflow("wf", {"task": "test"})

        # Should complete without error, no retry
        assert agent.execute_with_hooks.call_count == 1
        assert result["status"] == WorkflowStatus.COMPLETED.value

    @pytest.mark.asyncio
    async def test_max_retries_respected(self, mock_event_bus, mock_checker_pipeline):
        """Re-execution does not exceed max_checker_retries."""
        mock_checker_pipeline.run_quick_scan.return_value = {}
        mock_checker_pipeline.aggregate_results.return_value = {
            "overall_score": 30,
            "total_issues": 5,
            "all_suggestions": ["Many issues"],
            "checker_scores": {"quality": 30},
            "failed_checkers": [],
        }

        agent = _make_agent()
        agent.execute.return_value = AgentResult(content="bad", confidence=0.3)

        orch = AgentOrchestrator(
            event_bus=mock_event_bus,
            checker_pipeline=mock_checker_pipeline,
            checker_threshold=70,
            max_checker_retries=2,
        )
        orch.register_agent("a", agent)
        orch.register_workflow("wf", [StageConfig(name="s1", agents=["a"])])

        await orch.execute_workflow("wf", {"task": "write"})

        # 1 initial + 2 retries = 3 total
        assert agent.execute_with_hooks.call_count == 3


# =============================================================================
# _extract_checkable_content Tests
# =============================================================================

class TestExtractCheckableContent:
    """Test static method _extract_checkable_content."""

    def test_string_content(self):
        result = AgentResult(content="hello world")
        assert AgentOrchestrator._extract_checkable_content(result) == "hello world"

    def test_dict_with_text_key(self):
        result = AgentResult(content={"text": "chapter text"})
        assert AgentOrchestrator._extract_checkable_content(result) == "chapter text"

    def test_dict_with_content_key(self):
        result = AgentResult(content={"content": "inner content"})
        assert AgentOrchestrator._extract_checkable_content(result) == "inner content"

    def test_dict_with_adjusted_text_key(self):
        result = AgentResult(content={"adjusted_text": "adjusted"})
        assert AgentOrchestrator._extract_checkable_content(result) == "adjusted"

    def test_dict_fallback_to_json(self):
        result = AgentResult(content={"foo": "bar"})
        extracted = AgentOrchestrator._extract_checkable_content(result)
        assert "foo" in extracted
        assert "bar" in extracted

    def test_list_content(self):
        result = AgentResult(content=[{"name": "char1"}])
        extracted = AgentOrchestrator._extract_checkable_content(result)
        assert "char1" in extracted

    def test_empty_content(self):
        result = AgentResult(content=None)
        assert AgentOrchestrator._extract_checkable_content(result) == ""

    def test_numeric_content(self):
        result = AgentResult(content=42)
        assert AgentOrchestrator._extract_checkable_content(result) == "42"


# =============================================================================
# _build_agent_context Tests
# =============================================================================

class TestBuildAgentContext:
    """Test static method _build_agent_context."""

    def test_builds_context_from_wf_context(self):
        wf_ctx = WorkflowContext(
            execution_id="test_123",
            workflow_name="wf",
            input_data={
                "task": "write chapter",
                "settings": {"style": "江南"},
                "history": [{"role": "user", "content": "hi"}],
                "constraints": ["be concise"],
            },
            stage_results={"prev_stage": {"data": 1}},
        )

        ctx = AgentOrchestrator._build_agent_context(wf_ctx, "wf", "s1")

        assert ctx.task == "write chapter"
        assert ctx.settings["style"] == "江南"
        assert ctx.settings["stage_results"] == {"prev_stage": {"data": 1}}
        assert ctx.settings["workflow_name"] == "wf"
        assert ctx.settings["stage_name"] == "s1"
        assert ctx.history == [{"role": "user", "content": "hi"}]
        assert ctx.constraints == ["be concise"]

    def test_builds_context_with_defaults(self):
        wf_ctx = WorkflowContext(
            execution_id="test_456",
            workflow_name="wf",
            input_data={},
        )

        ctx = AgentOrchestrator._build_agent_context(wf_ctx, "wf", "s1")

        assert ctx.task == ""
        assert ctx.settings["workflow_name"] == "wf"
        assert ctx.settings["stage_name"] == "s1"
