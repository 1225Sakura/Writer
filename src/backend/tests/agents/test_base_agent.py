"""Tests for BaseAgent and DatabaseMixin."""

import pytest
from unittest.mock import MagicMock, AsyncMock
from dataclasses import dataclass

from agents.base import BaseAgent, DatabaseMixin, AgentContext, AgentResult
from agents.checkers.base import BaseChecker, CheckerResult


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