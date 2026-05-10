"""Conflict Detector - Detects conflicts between rules and generated content.

Performs both pattern-based and semantic conflict detection.
"""

from __future__ import annotations

import re
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.domain import Outline
from backend.services.constraints.core import (
    ConstraintRule,
    ConstraintViolation,
    LawType,
    RuleStatus,
    Severity,
)


class ConflictDetector:
    """Detects conflicts between rules and generated content.

    Performs both pattern-based and semantic conflict detection.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def detect_conflicts(
        self,
        content: str,
        rules: list[ConstraintRule],
    ) -> list[ConstraintViolation]:
        """Check content against a list of constraint rules.

        Returns violations for any rules that are broken.
        """
        violations: list[ConstraintViolation] = []
        if not content:
            return violations

        for rule in rules:
            if rule.status != RuleStatus.ACTIVE:
                continue

            # Pattern-based detection
            if rule.pattern:
                matches = list(re.finditer(rule.pattern, content))
                if matches:
                    for match in matches[:3]:  # Limit to first 3 matches
                        violations.append(ConstraintViolation(
                            rule_id=rule.id,
                            law_type=rule.law_type,
                            severity=rule.severity,
                            message=rule.description,
                            evidence=match.group(0),
                            location=f"position {match.start()}",
                            suggestion=f"违反规则: {rule.name}",
                        ))

        return violations

    async def detect_outline_conflicts(
        self,
        content: str,
        outline_id: Optional[int] = None,
    ) -> list[ConstraintViolation]:
        """Detect conflicts between content and outline constraints.

        Extracts implicit constraints from the outline and checks them.
        """
        violations: list[ConstraintViolation] = []
        if not outline_id:
            return violations

        result = await self._db.execute(
            select(Outline).where(Outline.id == outline_id)
        )
        outline = result.scalar_one_or_none()
        if not outline or not outline.description:
            return violations

        # Extract character death prohibitions from outline
        death_prohibitions = self._extract_death_prohibitions(outline.description)
        for char_name in death_prohibitions:
            if self._character_dies_in_content(char_name, content):
                violations.append(ConstraintViolation(
                    rule_id=f"outline_no_death_{char_name}",
                    law_type=LawType.OUTLINE_LAW,
                    severity=Severity.CRITICAL,
                    message=f"大纲禁止角色'{char_name}'死亡，但正文中出现了死亡描写",
                    evidence=self._extract_death_evidence(char_name, content),
                    suggestion="请修改剧情，确保该角色存活，或先修改大纲",
                ))

        # Extract plot point requirements
        required_plot_points = self._extract_required_plot_points(outline.description)
        for point in required_plot_points:
            if not self._plot_point_present(point, content):
                violations.append(ConstraintViolation(
                    rule_id=f"outline_required_plot_{point}",
                    law_type=LawType.OUTLINE_LAW,
                    severity=Severity.HIGH,
                    message=f"大纲要求本章包含剧情点'{point}'，但未在正文中检测到",
                    suggestion="请补充该剧情点，或调整大纲要求",
                ))

        return violations

    def _extract_death_prohibitions(self, outline_text: str) -> list[str]:
        """Extract character names that must not die from outline text."""
        prohibitions: list[str] = []
        patterns = [
            r"([^，。！？\n]{2,6})(?:不能死|不可死|不得死|禁止死亡|不会死|不应死)",
            r"(?:保证|确保|维持)([^，。！？\n]{2,6})(?:存活|活着|不死)",
        ]
        for pattern in patterns:
            for match in re.finditer(pattern, outline_text):
                name = match.group(1).strip()
                if len(name) >= 2:
                    prohibitions.append(name)
        return prohibitions

    def _character_dies_in_content(self, char_name: str, content: str) -> bool:
        """Check if a character dies in the content."""
        death_patterns = [
            rf"{re.escape(char_name)}[^。！？]{{0,15}}(?:死了|死亡|陨落|牺牲|阵亡|毙命|断气|身亡|殒命)",
            rf"(?:死了|死亡|陨落|牺牲)的[^。！？]{{0,10}}{re.escape(char_name)}",
        ]
        for pattern in death_patterns:
            if re.search(pattern, content):
                return True
        return False

    def _extract_death_evidence(self, char_name: str, content: str) -> str:
        """Extract evidence of character death."""
        death_patterns = [
            rf"{re.escape(char_name)}[^。！？]{{0,15}}(?:死了|死亡|陨落|牺牲|阵亡|毙命|断气|身亡|殒命)",
        ]
        for pattern in death_patterns:
            match = re.search(pattern, content)
            if match:
                return match.group(0)
        return ""

    def _extract_required_plot_points(self, outline_text: str) -> list[str]:
        """Extract plot points that must appear from outline text."""
        points: list[str] = []
        patterns = [
            r"(?:本章|本回|此章).*?(?:需要|必须|应当|要).*?(?:写|描写|展现|出现)([^，。！？\n]{3,20})",
            r"(?:剧情点|关键节点|高潮|转折)(?:：|:)([^，。！？\n]{3,20})",
        ]
        for pattern in patterns:
            for match in re.finditer(pattern, outline_text):
                point = match.group(1).strip()
                if len(point) >= 3:
                    points.append(point)
        return points

    def _plot_point_present(self, point: str, content: str) -> bool:
        """Check if a plot point is present in content (fuzzy match)."""
        # Direct substring match
        if point in content:
            return True
        # Keyword match: at least 2 keywords from the point appear
        keywords = [w for w in point if len(w) >= 2]
        if len(keywords) >= 2:
            matches = sum(1 for kw in keywords if kw in content)
            return matches >= max(2, len(keywords) // 2)
        return False
