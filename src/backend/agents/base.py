"""Base agent classes and data models for the AI agent system.

This module defines the foundational abstractions for all AI agents:
- AgentContext: input context for agent execution
- AgentResult: structured output from agent execution
- BaseAgent: abstract base class all agents must extend
- DatabaseMixin: optional mixin for agents needing AIService/MiniMaxAPIClient
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

from backend.services.ai.provider import AIProvider
from backend.utils.event_bus import AsyncEventBus

if TYPE_CHECKING:
    from backend.core.services.ai.ai_service import AIService
    from .utils import MiniMaxAPIClient


@dataclass
class AgentContext:
    """Input context for agent execution.

    Attributes:
        task: The primary task description or instruction.
        settings: Optional configuration/settings dict.
        history: Previous interactions or context history.
        constraints: Optional constraints or rules to follow.
    """

    task: str
    settings: dict[str, Any] = field(default_factory=dict)
    history: list[dict[str, Any]] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)


@dataclass
class AgentResult:
    """Structured result from agent execution.

    Attributes:
        content: The primary output content (text, dict, etc.).
        confidence: Confidence score in range 0.0-1.0.
        metadata: Additional metadata about the result.
        warnings: List of warning messages.
    """

    content: Any
    confidence: float = 0.0
    metadata: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        """Validate confidence is within valid range."""
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError(
                f"confidence must be between 0.0 and 1.0, got {self.confidence}"
            )


class BaseAgent(ABC):
    """Abstract base class for all AI agents.

    All concrete agents must inherit from this class and implement
    the `execute` method. The base class provides common infrastructure
    including AI provider access and event bus integration.
    """

    def __init__(self, provider: AIProvider, event_bus: AsyncEventBus) -> None:
        """Initialize the agent.

        Args:
            provider: The AI provider for generation tasks.
            event_bus: Async event bus for publishing agent events.
        """
        self._provider = provider
        self._event_bus = event_bus

    @property
    def provider(self) -> AIProvider:
        """Access the AI provider."""
        return self._provider

    @property
    def event_bus(self) -> AsyncEventBus:
        """Access the event bus."""
        return self._event_bus

    @abstractmethod
    async def execute(self, context: AgentContext) -> AgentResult:
        """Execute the agent's primary task.

        Args:
            context: The execution context containing task, settings,
                     history, and constraints.

        Returns:
            Structured AgentResult with content, confidence, metadata,
            and any warnings.
        """


class DatabaseMixin:
    """Optional mixin for agents that need AIService/MiniMaxAPIClient.

    Agents like DataAgent and ContextAgent need direct API access via
    MiniMaxAPIClient while also supporting event-driven execution via BaseAgent.
    Use multiple inheritance: class MyAgent(BaseAgent, DatabaseMixin).
    """

    def __init__(self, ai_service: AIService, **kwargs: Any) -> None:
        """Initialize with AIService.

        Args:
            ai_service: The AI service for API calls
            **kwargs: Additional arguments for other mixins/base classes
        """
        self._ai_service = ai_service
        # Store remaining kwargs for other mixins
        self._mixin_kwargs = kwargs

    @property
    def ai_service(self) -> AIService:
        """Access the AI service."""
        return self._ai_service

    @property
    def api_client(self) -> MiniMaxAPIClient:
        """Get or create MiniMaxAPIClient instance."""
        # Lazily create API client
        if not hasattr(self, "_api_client"):
            from .utils import MiniMaxAPIClient
            self._api_client = MiniMaxAPIClient(self._ai_service)
        return self._api_client
