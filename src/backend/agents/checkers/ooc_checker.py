"""OOC (Out Of Character) checker for character behavior consistency.

quick_scan: Heuristic check for obvious character behavior inconsistencies.
deep_analyze: AI-powered analysis for subtle OOC violations.

Note: This checker is currently a placeholder. Full implementation requires
access to character personality profiles and behavior patterns.
"""

from __future__ import annotations

from typing import Any

from .base import BaseChecker, CheckerResult
from backend.core.services.ai.ai_service import AIService


class OOCChecker(BaseChecker):
    """Checks if characters act consistently with their personality."""

    def __init__(self, ai_service: AIService | None = None) -> None:
        super().__init__(
            name="ooc",
            description="检查角色行为一致性（Out Of Character违规）",
        )
        self._ai_service = ai_service

    async def quick_scan(self, content: str) -> CheckerResult:
        """Heuristic scan for obvious OOC signals.

        Detects:
        - Character behavior contradictions
        - Speech pattern inconsistencies
        - Reaction patterns that contradict established personality
        """
        # TODO: implement heuristic OOC detection
        raise NotImplementedError(
            "OOChecker.quick_scan() 尚未实现。"
            "需要定义角色行为不一致的启发式检测规则（如行为与性格描述矛盾等）。"
        )

    async def deep_analyze(
        self, content: str, context: dict[str, Any]
    ) -> CheckerResult:
        """Deep AI analysis for subtle OOC violations.

        Args:
            content: Chapter text to analyze.
            context: Must contain 'characters' (list of character profiles with personality).
        """
        # TODO: implement AI-powered OOC analysis
        raise NotImplementedError(
            "OOChecker.deep_analyze() 尚未实现。"
            "需要基于角色性格设定检查行为是否一致，识别任何OOC（Out Of Character）违规。"
        )
