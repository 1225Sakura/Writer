"""
Tests for BaseAgent, AgentContext, AgentResult, and DatabaseMixin.
Phase 0.5.3: Validates inheritance chain, mixin composition, attribute access.
"""

import pytest
from unittest.mock import MagicMock, AsyncMock

from backend.agents.base import BaseAgent, AgentContext, AgentResult, DatabaseMixin


class TestAgentContext:
    """AgentContext dataclass tests."""

    def test_create_with_defaults(self):
        ctx = AgentContext(task="write chapter")
        assert ctx.task == "write chapter"
        assert ctx.settings == {}
        assert ctx.history == []
        assert ctx.constraints == []

    def test_create_with_all_fields(self):
        ctx = AgentContext(
            task="review",
            settings={"genre": "fantasy"},
            history=["prev chapter"],
            constraints=["no violence"],
        )
        assert ctx.task == "review"
        assert ctx.settings["genre"] == "fantasy"
        assert len(ctx.history) == 1
        assert len(ctx.constraints) == 1


class TestAgentResult:
    """AgentResult dataclass tests."""

    def test_create_with_defaults(self):
        result = AgentResult(content="text")
        assert result.content == "text"
        assert result.confidence == 0.0
        assert result.metadata == {}
        assert result.warnings == []

    def test_confidence_validation(self):
        with pytest.raises(ValueError):
            AgentResult(content="text", confidence=1.5)
        with pytest.raises(ValueError):
            AgentResult(content="text", confidence=-0.1)

    def test_confidence_boundaries(self):
        assert AgentResult(content="text", confidence=0.0).confidence == 0.0
        assert AgentResult(content="text", confidence=1.0).confidence == 1.0


class ConcreteAgent(BaseAgent):
    """Concrete implementation for testing."""

    async def execute(self, context: AgentContext) -> AgentResult:
        return AgentResult(content="done")


class TestBaseAgent:
    """BaseAgent inheritance and attribute access tests."""

    def test_concrete_agent_creation(self):
        provider = MagicMock()
        bus = MagicMock()
        agent = ConcreteAgent(provider=provider, event_bus=bus)
        assert agent.provider is provider
        assert agent.event_bus is bus

    def test_abstract_cannot_instantiate(self):
        with pytest.raises(TypeError):
            BaseAgent(provider=MagicMock(), event_bus=MagicMock())

    @pytest.mark.asyncio
    async def test_concrete_execute(self):
        agent = ConcreteAgent(provider=MagicMock(), event_bus=MagicMock())
        ctx = AgentContext(task="test")
        result = await agent.execute(ctx)
        assert isinstance(result, AgentResult)
        assert result.content == "done"


class TestDatabaseMixin:
    """DatabaseMixin composition tests."""

    class AgentWithDB(DatabaseMixin, BaseAgent):
        async def execute(self, context: AgentContext) -> AgentResult:
            return AgentResult(content="db agent")

    def test_mixin_provides_ai_service(self):
        mock_service = MagicMock()
        agent = self.AgentWithDB(
            ai_service=mock_service,
            provider=MagicMock(),
            event_bus=MagicMock(),
        )
        assert agent.ai_service is mock_service

    def test_mixin_api_client_lazy(self):
        mock_service = MagicMock()
        mock_service.api_key = "test-key"
        mock_service.base_url = "https://api.test"
        agent = self.AgentWithDB(
            ai_service=mock_service,
            provider=MagicMock(),
            event_bus=MagicMock(),
        )
        # api_client should be lazily created
        assert agent.api_client is not None

    @pytest.mark.asyncio
    async def test_mixin_agent_executable(self):
        agent = self.AgentWithDB(
            ai_service=MagicMock(),
            provider=MagicMock(),
            event_bus=MagicMock(),
        )
        result = await agent.execute(AgentContext(task="test"))
        assert result.content == "db agent"
