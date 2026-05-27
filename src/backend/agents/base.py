"""Base agent classes and data models for the AI agent system.

This module defines the foundational abstractions for all AI agents:
- AgentContext: input context for agent execution
- AgentResult: structured output from agent execution
- CheckerFeedback: aggregated checker feedback for re-execution loops
- BaseAgent: abstract base class all agents must extend
- DatabaseMixin: optional mixin for agents needing AIService/MiniMaxAPIClient
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Optional

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
        chapter_id: Optional chapter ID for the current operation.
        character_ids: List of character IDs relevant to the current operation.
        world_context: Optional world-building context text.
        checker_results: Optional checker feedback results dict.
    """

    task: str
    settings: dict[str, Any] = field(default_factory=dict)
    history: list[dict[str, Any]] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    chapter_id: Optional[int] = None
    character_ids: list[int] = field(default_factory=list)
    world_context: Optional[str] = None
    checker_results: Optional[dict[str, Any]] = None

    # ------------------------------------------------------------------
    # Typed field helpers with settings fallback
    # ------------------------------------------------------------------

    def get_chapter_id(self) -> Optional[int]:
        """Return chapter_id, falling back to settings['chapter_id']."""
        return self.chapter_id or self.settings.get("chapter_id")

    def get_character_ids(self) -> list[int]:
        """Return character_ids, falling back to settings['character_ids']."""
        if self.character_ids:
            return self.character_ids
        return self.settings.get("character_ids", [])

    def get_world_context(self) -> Optional[str]:
        """Return world_context, falling back to settings['world_context']."""
        return self.world_context or self.settings.get("world_context")

    def get_checker_results(self) -> Optional[dict[str, Any]]:
        """Return checker_results, falling back to settings['checker_results']."""
        return self.checker_results or self.settings.get("checker_results")


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


@dataclass
class CheckerFeedback:
    """Aggregated checker feedback passed to agents for re-execution.

    Attributes:
        overall_score: Weighted overall quality score (0-100).
        issues: Flattened list of issue dicts from all checkers.
        suggestions: All improvement suggestions from checkers.
        failed_checkers: Names of checkers that failed (excluded from scoring).
    """

    overall_score: float
    issues: list[dict[str, Any]] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    failed_checkers: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize to dict for AgentContext.checker_results."""
        return {
            "overall_score": self.overall_score,
            "issues": self.issues,
            "suggestions": self.suggestions,
            "failed_checkers": self.failed_checkers,
        }


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

    async def pre_execute(self, context: AgentContext) -> AgentContext:
        """Hook called before execute. Override to modify context.

        Args:
            context: The incoming execution context.

        Returns:
            Possibly modified context to pass to execute().
        """
        return context

    async def post_execute(self, context: AgentContext, result: AgentResult) -> AgentResult:
        """Hook called after execute. Override to modify result.

        Args:
            context: The execution context that was used.
            result: The result produced by execute().

        Returns:
            Possibly modified result.
        """
        return result

    async def execute_with_hooks(self, context: AgentContext) -> AgentResult:
        """Template method: pre_execute -> execute -> post_execute.

        Orchestrators should call this instead of execute() directly
        to ensure lifecycle hooks are invoked.

        Args:
            context: The execution context.

        Returns:
            AgentResult after all hooks have been applied.
        """
        context = await self.pre_execute(context)
        result = await self.execute(context)
        result = await self.post_execute(context, result)
        return result


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
