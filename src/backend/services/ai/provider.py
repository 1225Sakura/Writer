"""AIProvider Protocol / abstract base class."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import AsyncIterator


class AIProvider(ABC):
    """Abstract base class for AI providers.

    All AI backends must implement these methods to integrate with the
    novel-writing assistant.
    """

    # ------------------------------------------------------------------
    # Provider metadata
    # ------------------------------------------------------------------

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider name."""

    @property
    @abstractmethod
    def supports_streaming(self) -> bool:
        """Whether the provider supports streaming responses."""

    @property
    @abstractmethod
    def max_tokens(self) -> int:
        """Maximum tokens the provider can generate in a single request."""

    # ------------------------------------------------------------------
    # Core generation
    # ------------------------------------------------------------------

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        style: str = "default",
        operation: str = "continue",
    ) -> str:
        """Generate a complete (non-streaming) text response.

        Args:
            prompt: The user's text / prompt to process.
            style: Writing style (e.g. "江南", "卡夫卡", "加缪", "default").
            operation: One of continue, expand, condense, rewrite, polish, optimize.

        Returns:
            The full generated text.
        """

    @abstractmethod
    async def generate_stream(
        self,
        prompt: str,
        style: str = "default",
        operation: str = "continue",
    ) -> AsyncIterator[str]:
        """Stream the AI response as an async iterator of text chunks.

        Args:
            prompt: The user's text / prompt to process.
            style: Writing style.
            operation: One of continue, expand, condense, rewrite, polish, optimize.

        Yields:
            String chunks of the AI response.
        """

    # ------------------------------------------------------------------
    # Review & extraction
    # ------------------------------------------------------------------

    @abstractmethod
    async def review(self, content: dict, settings: dict | None = None) -> dict:
        """Review content (e.g. novel settings) for consistency and quality.

        Args:
            content: Dictionary containing the data to review.
            settings: Optional extra settings / context.

        Returns:
            Dictionary with review results, including consistency issues
            and optimisation suggestions.
        """

    @abstractmethod
    async def extract_entities(self, content: str | list) -> list:
        """Extract entities (characters, locations, items, factions, etc.).

        Args:
            content: Text or list of messages to analyse.

        Returns:
            List of extracted entities.
        """
