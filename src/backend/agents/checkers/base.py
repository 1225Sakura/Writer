"""Base checker classes and data models for novel quality assurance.

This module defines the foundational abstractions for all quality checkers:
- CheckerResult: structured result from a checker run
- BaseChecker: abstract base class all checkers must extend
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class CheckerResult:
    """Structured result from a checker analysis.

    Attributes:
        score: Quality score in range 0-100.
        issues: List of detected issues, each as a dict with details.
        suggestions: List of improvement suggestions.
    """

    score: int = 100
    issues: list[dict[str, Any]] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)

    def __post_init__(self) -> None:
        """Validate score is within valid range."""
        if not 0 <= self.score <= 100:
            raise ValueError(
                f"score must be between 0 and 100, got {self.score}"
            )


class BaseChecker(ABC):
    """Abstract base class for all quality checkers.

    Each concrete checker implements quick_scan (low-cost heuristic check)
    and deep_analyze (full AI-powered analysis) for a specific quality
    dimension of novel writing.
    """

    def __init__(self, name: str, description: str) -> None:
        """Initialize the checker.

        Args:
            name: Short identifier for the checker.
            description: Human-readable description of what this checker does.
        """
        self._name = name
        self._description = description

    @property
    def name(self) -> str:
        """Checker name."""
        return self._name

    @property
    def description(self) -> str:
        """Checker description."""
        return self._description

    @abstractmethod
    async def quick_scan(self, content: str) -> CheckerResult:
        """Run a low-cost quick check on content.

        This method should use heuristics, regex, or lightweight rules
        to quickly identify obvious issues without expensive AI calls.

        Args:
            content: The chapter or text content to check.

        Returns:
            CheckerResult with findings from the quick scan.
        """

    @abstractmethod
    async def deep_analyze(
        self, content: str, context: dict[str, Any]
    ) -> CheckerResult:
        """Run a deep AI-powered analysis on content.

        This method may use the AI provider to perform thorough analysis
        with full world context, previous chapters, and character data.

        Args:
            content: The chapter or text content to analyze.
            context: Additional context such as world settings, character
                     profiles, previous chapters, etc.

        Returns:
            CheckerResult with detailed findings and suggestions.
        """
