"""Tests for BaseAgent, DatabaseMixin, CheckerFeedback, and lifecycle hooks."""

import pytest
from unittest.mock import MagicMock, AsyncMock
from dataclasses import dataclass

from backend.agents.base import BaseAgent, DatabaseMixin, AgentContext, AgentResult, CheckerFeedback
from backend.agents.checkers.base import BaseChecker, CheckerResult


# =============================================================================
# AgentContext Tests
# =============================================================================

class TestAgentContext:
    """Test AgentContext dataclass."""

    def test_agent_context_with_required_fields(self):
        """AgentContext can be created with only task."""
        context = AgentContext(task="测试任务")
        assert context.task == "测试任务"
        assert context.settings == {}
        assert context.history == []
        assert context.constraints == []

    def test_agent_context_with_all_fields(self):
        """AgentContext can be created with all fields."""
        context = AgentContext(
            task="测试任务",
            settings={"key": "value"},
            history=[{"role": "user", "content": "hello"}],
            constraints=["constraint1"],
        )
        assert context.task == "测试任务"
        assert context.settings == {"key": "value"}
        assert context.history[0]["content"] == "hello"
        assert context.constraints == ["constraint1"]

    def test_agent_context_typed_fields_defaults(self):
        """AgentContext typed fields have correct defaults."""
        context = AgentContext(task="test")
        assert context.chapter_id is None
        assert context.character_ids == []
        assert context.world_context is None
        assert context.checker_results is None

    def test_agent_context_typed_fields_explicit(self):
        """AgentContext typed fields can be set explicitly."""
        context = AgentContext(
            task="test",
            chapter_id=42,
            character_ids=[1, 2, 3],
            world_context="world text",
            checker_results={"score": 85},
        )
        assert context.chapter_id == 42
        assert context.character_ids == [1, 2, 3]
        assert context.world_context == "world text"
        assert context.checker_results == {"score": 85}

    def test_get_chapter_id_from_typed_field(self):
        """get_chapter_id returns typed field when set."""
        context = AgentContext(task="test", chapter_id=42)
        assert context.get_chapter_id() == 42

    def test_get_chapter_id_from_settings_fallback(self):
        """get_chapter_id falls back to settings when typed field is None."""
        context = AgentContext(task="test", settings={"chapter_id": 99})
        assert context.get_chapter_id() == 99

    def test_get_chapter_id_typed_field_takes_precedence(self):
        """get_chapter_id prefers typed field over settings fallback."""
        context = AgentContext(task="test", chapter_id=42, settings={"chapter_id": 99})
        assert context.get_chapter_id() == 42

    def test_get_chapter_id_returns_none_when_unset(self):
        """get_chapter_id returns None when neither source has a value."""
        context = AgentContext(task="test")
        assert context.get_chapter_id() is None

    def test_get_character_ids_from_typed_field(self):
        """get_character_ids returns typed field when set."""
        context = AgentContext(task="test", character_ids=[1, 2])
        assert context.get_character_ids() == [1, 2]

    def test_get_character_ids_from_settings_fallback(self):
        """get_character_ids falls back to settings when typed field is empty."""
        context = AgentContext(task="test", settings={"character_ids": [5, 6]})
        assert context.get_character_ids() == [5, 6]

    def test_get_character_ids_typed_field_takes_precedence(self):
        """get_character_ids prefers typed field over settings fallback."""
        context = AgentContext(task="test", character_ids=[1], settings={"character_ids": [5]})
        assert context.get_character_ids() == [1]

    def test_get_character_ids_returns_empty_when_unset(self):
        """get_character_ids returns empty list when neither source has a value."""
        context = AgentContext(task="test")
        assert context.get_character_ids() == []

    def test_get_world_context_from_typed_field(self):
        """get_world_context returns typed field when set."""
        context = AgentContext(task="test", world_context="world text")
        assert context.get_world_context() == "world text"

    def test_get_world_context_from_settings_fallback(self):
        """get_world_context falls back to settings when typed field is None."""
        context = AgentContext(task="test", settings={"world_context": "from settings"})
        assert context.get_world_context() == "from settings"

    def test_get_world_context_typed_field_takes_precedence(self):
        """get_world_context prefers typed field over settings fallback."""
        context = AgentContext(task="test", world_context="typed", settings={"world_context": "settings"})
        assert context.get_world_context() == "typed"

    def test_get_world_context_returns_none_when_unset(self):
        """get_world_context returns None when neither source has a value."""
        context = AgentContext(task="test")
        assert context.get_world_context() is None

    def test_get_checker_results_from_typed_field(self):
        """get_checker_results returns typed field when set."""
        results = {"consistency": {"score": 90}}
        context = AgentContext(task="test", checker_results=results)
        assert context.get_checker_results() == results

    def test_get_checker_results_from_settings_fallback(self):
        """get_checker_results falls back to settings when typed field is None."""
        results = {"pacing": {"score": 75}}
        context = AgentContext(task="test", settings={"checker_results": results})
        assert context.get_checker_results() == results

    def test_get_checker_results_typed_field_takes_precedence(self):
        """get_checker_results prefers typed field over settings fallback."""
        typed = {"score": 90}
        settings_val = {"score": 75}
        context = AgentContext(task="test", checker_results=typed, settings={"checker_results": settings_val})
        assert context.get_checker_results() == typed

    def test_get_checker_results_returns_none_when_unset(self):
        """get_checker_results returns None when neither source has a value."""
        context = AgentContext(task="test")
        assert context.get_checker_results() is None

    def test_backward_compatibility_settings_unchanged(self):
        """Existing settings-only usage is fully backward compatible."""
        context = AgentContext(
            task="test",
            settings={"collected_settings": {}, "current_category": "genre"},
        )
        # Old-style access still works
        assert context.settings.get("collected_settings") == {}
        assert context.settings.get("current_category") == "genre"
        # Typed fields are defaults
        assert context.chapter_id is None
        assert context.character_ids == []
        assert context.world_context is None
        assert context.checker_results is None


# =============================================================================
# AgentResult Tests
# =============================================================================

class TestAgentResult:
    """Test AgentResult dataclass."""

    def test_agent_result_with_defaults(self):
        """AgentResult has correct defaults."""
        result = AgentResult(content="test")
        assert result.content == "test"
        assert result.confidence == 0.0
        assert result.metadata == {}
        assert result.warnings == []

    def test_agent_result_validation_accepts_valid_confidence(self):
        """AgentResult accepts confidence between 0 and 1."""
        for confidence in [0.0, 0.5, 1.0]:
            result = AgentResult(content="test", confidence=confidence)
            assert result.confidence == confidence

    def test_agent_result_validation_rejects_invalid_confidence(self):
        """AgentResult rejects confidence outside 0-1 range."""
        with pytest.raises(ValueError, match="confidence must be between"):
            AgentResult(content="test", confidence=-0.1)
        with pytest.raises(ValueError, match="confidence must be between"):
            AgentResult(content="test", confidence=1.5)


# =============================================================================
# BaseAgent Tests
# =============================================================================

class TestBaseAgent:
    """Test BaseAgent abstract class."""

    def test_base_agent_requires_execute_implementation(self):
        """BaseAgent subclasses must implement execute."""
        mock_provider = MagicMock()
        mock_event_bus = MagicMock()

        class NonFunctionalAgent(BaseAgent):
            pass  # Missing execute implementation

        with pytest.raises(TypeError, match="abstract.*execute"):
            NonFunctionalAgent(provider=mock_provider, event_bus=mock_event_bus)

    def test_base_agent_properties(self):
        """BaseAgent provides provider and event_bus access."""
        mock_provider = MagicMock()
        mock_event_bus = MagicMock()

        class ConcreteAgent(BaseAgent):
            async def execute(self, context: AgentContext) -> AgentResult:
                return AgentResult(content="done")

        agent = ConcreteAgent(provider=mock_provider, event_bus=mock_event_bus)
        assert agent.provider == mock_provider
        assert agent.event_bus == mock_event_bus

    @pytest.mark.asyncio
    async def test_execute_returns_agent_result(self):
        """execute returns AgentResult."""
        mock_provider = MagicMock()
        mock_event_bus = MagicMock()

        class ConcreteAgent(BaseAgent):
            async def execute(self, context: AgentContext) -> AgentResult:
                return AgentResult(content="test result", confidence=0.9)

        agent = ConcreteAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="do something")

        result = await agent.execute(context)

        assert result.content == "test result"
        assert result.confidence == 0.9


# =============================================================================
# DatabaseMixin Tests
# =============================================================================

class TestDatabaseMixin:
    """Test DatabaseMixin for agents needing AIService."""

    def test_database_mixin_stores_ai_service(self):
        """DatabaseMixin stores ai_service reference."""
        mock_ai_service = MagicMock()

        class MockMixin(DatabaseMixin):
            pass

        mixin = MockMixin(ai_service=mock_ai_service)
        assert mixin.ai_service == mock_ai_service

    def test_database_mixin_passes_kwargs(self):
        """DatabaseMixin passes remaining kwargs to other initializers."""
        mock_ai_service = MagicMock()
        mock_provider = MagicMock()

        class MockMixin(DatabaseMixin):
            pass

        mixin = MockMixin(ai_service=mock_ai_service, provider=mock_provider)
        assert mixin.ai_service == mock_ai_service
        assert mixin._mixin_kwargs.get("provider") == mock_provider


# =============================================================================
# CheckerFeedback Tests (US-020)
# =============================================================================

class TestCheckerFeedback:
    """Test CheckerFeedback dataclass."""

    def test_checker_feedback_defaults(self):
        """CheckerFeedback has correct defaults."""
        feedback = CheckerFeedback(overall_score=85.0)
        assert feedback.overall_score == 85.0
        assert feedback.issues == []
        assert feedback.suggestions == []
        assert feedback.failed_checkers == []

    def test_checker_feedback_all_fields(self):
        """CheckerFeedback stores all fields correctly."""
        feedback = CheckerFeedback(
            overall_score=55.0,
            issues=[{"checker": "pacing", "score": 40}],
            suggestions=["加快节奏", "增加冲突"],
            failed_checkers=["bad_checker"],
        )
        assert feedback.overall_score == 55.0
        assert len(feedback.issues) == 1
        assert len(feedback.suggestions) == 2
        assert feedback.failed_checkers == ["bad_checker"]

    def test_checker_feedback_to_dict(self):
        """CheckerFeedback.to_dict() serializes correctly."""
        feedback = CheckerFeedback(
            overall_score=72.5,
            issues=[{"checker": "consistency", "score": 72}],
            suggestions=["修复时间线矛盾"],
            failed_checkers=[],
        )
        d = feedback.to_dict()
        assert d["overall_score"] == 72.5
        assert d["issues"] == [{"checker": "consistency", "score": 72}]
        assert d["suggestions"] == ["修复时间线矛盾"]
        assert d["failed_checkers"] == []

    def test_checker_feedback_to_dict_roundtrip(self):
        """CheckerFeedback can be reconstructed from to_dict() output."""
        original = CheckerFeedback(
            overall_score=60.0,
            issues=[{"checker": "ooc", "score": 50}],
            suggestions=["修复角色性格"],
            failed_checkers=["broken"],
        )
        d = original.to_dict()
        restored = CheckerFeedback(**d)
        assert restored.overall_score == original.overall_score
        assert restored.issues == original.issues
        assert restored.suggestions == original.suggestions
        assert restored.failed_checkers == original.failed_checkers


# =============================================================================
# Lifecycle Hooks Tests (US-021)
# =============================================================================

class TestLifecycleHooks:
    """Test BaseAgent lifecycle hooks."""

    @pytest.mark.asyncio
    async def test_default_pre_execute_returns_context_unchanged(self):
        """Default pre_execute returns context as-is."""
        mock_provider = MagicMock()
        mock_event_bus = MagicMock()

        class ConcreteAgent(BaseAgent):
            async def execute(self, context: AgentContext) -> AgentResult:
                return AgentResult(content="done")

        agent = ConcreteAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="test")
        result = await agent.pre_execute(context)
        assert result is context

    @pytest.mark.asyncio
    async def test_default_post_execute_returns_result_unchanged(self):
        """Default post_execute returns result as-is."""
        mock_provider = MagicMock()
        mock_event_bus = MagicMock()

        class ConcreteAgent(BaseAgent):
            async def execute(self, context: AgentContext) -> AgentResult:
                return AgentResult(content="done")

        agent = ConcreteAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="test")
        result = AgentResult(content="done")
        returned = await agent.post_execute(context, result)
        assert returned is result

    @pytest.mark.asyncio
    async def test_execute_with_hooks_calls_all_three_methods(self):
        """execute_with_hooks calls pre_execute, execute, post_execute in order."""
        call_order: list[str] = []
        mock_provider = MagicMock()
        mock_event_bus = MagicMock()

        class TrackingAgent(BaseAgent):
            async def pre_execute(self, context: AgentContext) -> AgentContext:
                call_order.append("pre_execute")
                return context

            async def execute(self, context: AgentContext) -> AgentResult:
                call_order.append("execute")
                return AgentResult(content="result")

            async def post_execute(self, context: AgentContext, result: AgentResult) -> AgentResult:
                call_order.append("post_execute")
                return result

        agent = TrackingAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="test")
        result = await agent.execute_with_hooks(context)

        assert call_order == ["pre_execute", "execute", "post_execute"]
        assert result.content == "result"

    @pytest.mark.asyncio
    async def test_pre_execute_can_modify_context(self):
        """pre_execute can modify context before execute receives it."""
        mock_provider = MagicMock()
        mock_event_bus = MagicMock()

        class ContextModifyingAgent(BaseAgent):
            async def pre_execute(self, context: AgentContext) -> AgentContext:
                context.settings["injected"] = True
                return context

            async def execute(self, context: AgentContext) -> AgentResult:
                return AgentResult(content=context.settings.get("injected"))

        agent = ContextModifyingAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="test")
        result = await agent.execute_with_hooks(context)
        assert result.content is True

    @pytest.mark.asyncio
    async def test_post_execute_can_modify_result(self):
        """post_execute can modify the result after execute."""
        mock_provider = MagicMock()
        mock_event_bus = MagicMock()

        class ResultModifyingAgent(BaseAgent):
            async def execute(self, context: AgentContext) -> AgentResult:
                return AgentResult(content="original", confidence=0.5)

            async def post_execute(self, context: AgentContext, result: AgentResult) -> AgentResult:
                return AgentResult(
                    content=result.content + "_modified",
                    confidence=min(result.confidence + 0.2, 1.0),
                    metadata=result.metadata,
                    warnings=result.warnings,
                )

        agent = ResultModifyingAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="test")
        result = await agent.execute_with_hooks(context)
        assert result.content == "original_modified"
        assert result.confidence == pytest.approx(0.7)

    @pytest.mark.asyncio
    async def test_execute_with_hooks_without_override_uses_defaults(self):
        """execute_with_hooks works correctly when hooks are not overridden."""
        mock_provider = MagicMock()
        mock_event_bus = MagicMock()

        class SimpleAgent(BaseAgent):
            async def execute(self, context: AgentContext) -> AgentResult:
                return AgentResult(content="simple", confidence=0.8)

        agent = SimpleAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(task="test")
        result = await agent.execute_with_hooks(context)
        assert result.content == "simple"
        assert result.confidence == 0.8

    @pytest.mark.asyncio
    async def test_pre_execute_receives_checker_results(self):
        """pre_execute can access checker_results from context."""
        mock_provider = MagicMock()
        mock_event_bus = MagicMock()

        class CheckerAwareAgent(BaseAgent):
            async def pre_execute(self, context: AgentContext) -> AgentContext:
                if context.checker_results:
                    context.settings["had_feedback"] = True
                return context

            async def execute(self, context: AgentContext) -> AgentResult:
                return AgentResult(content=context.settings.get("had_feedback", False))

        agent = CheckerAwareAgent(provider=mock_provider, event_bus=mock_event_bus)
        context = AgentContext(
            task="test",
            checker_results={"overall_score": 50, "suggestions": ["fix pacing"]},
        )
        result = await agent.execute_with_hooks(context)
        assert result.content is True
