"""Pacing analyzer service - track strand ratios and detect red line violations.

Red lines:
- Quest continuous <= 5 chapters
- Fire gap <= 10 chapters
- Constellation gap <= 15 chapters

Uses existing tables + JSON fields for storage. No model modifications.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.domain import Chapter, Outline
from backend.services.strand_classifier import StrandClassifier, StrandClassification


@dataclass
class RedLineViolation:
    """A single red line violation."""

    strand: str
    violation_type: str  # "continuous" | "gap"
    chapters_affected: list[int] = field(default_factory=list)
    severity: str = "warning"  # "warning" | "critical"
    message: str = ""
    suggestion: str = ""

    def to_dict(self) -> dict:
        return {
            "strand": self.strand,
            "violation_type": self.violation_type,
            "chapters_affected": self.chapters_affected,
            "severity": self.severity,
            "message": self.message,
            "suggestion": self.suggestion,
        }


@dataclass
class PacingAnalysis:
    """Complete pacing analysis for an outline."""

    outline_id: int
    total_chapters: int = 0
    strand_ratios: dict[str, float] = field(default_factory=dict)
    chapter_classifications: list[dict] = field(default_factory=list)
    red_line_violations: list[RedLineViolation] = field(default_factory=list)
    quest_streak: int = 0
    fire_gap: int = 0
    constellation_gap: int = 0
    health_score: int = 100
    summary: str = ""

    def to_dict(self) -> dict:
        return {
            "outline_id": self.outline_id,
            "total_chapters": self.total_chapters,
            "strand_ratios": self.strand_ratios,
            "chapter_classifications": self.chapter_classifications,
            "red_line_violations": [v.to_dict() for v in self.red_line_violations],
            "quest_streak": self.quest_streak,
            "fire_gap": self.fire_gap,
            "constellation_gap": self.constellation_gap,
            "health_score": self.health_score,
            "summary": self.summary,
        }


class PacingAnalyzer:
    """Analyze pacing and detect red line violations across chapters.

    Strand ideal ratios:
    - Quest: 60%
    - Fire: 20%
    - Constellation: 20%

    Red lines:
    - Quest continuous <= 5 chapters
    - Fire gap <= 10 chapters
    - Constellation gap <= 15 chapters
    """

    IDEAL_RATIOS = {
        "quest": 0.60,
        "fire": 0.20,
        "constellation": 0.20,
    }

    RED_LINES = {
        "quest": {"max_continuous": 5, "max_gap": float("inf")},
        "fire": {"max_continuous": float("inf"), "max_gap": 10},
        "constellation": {"max_continuous": float("inf"), "max_gap": 15},
    }

    def __init__(self, classifier: Optional[StrandClassifier] = None) -> None:
        self.classifier = classifier or StrandClassifier()

    async def analyze_outline(
        self,
        outline_id: int,
        db: AsyncSession,
        use_ai: bool = False,
    ) -> PacingAnalysis:
        """Analyze pacing for all chapters in an outline.

        Args:
            outline_id: The outline ID to analyze.
            db: Async database session.
            use_ai: If True, use AI for classification.

        Returns:
            PacingAnalysis with ratios, violations, and health score.
        """
        result = await db.execute(
            select(Chapter)
            .where(Chapter.outline_id == outline_id)
            .order_by(Chapter.chapter_order.asc())
        )
        chapters = result.scalars().all()

        if not chapters:
            return PacingAnalysis(
                outline_id=outline_id,
                total_chapters=0,
                summary="No chapters found for this outline.",
            )

        # Classify each chapter
        classifications = []
        for chapter in chapters:
            classification = await self.classifier.classify_chapter(
                chapter.id, db, use_ai=use_ai
            )
            classifications.append(classification)

        # Calculate overall ratios
        strand_ratios = self._calculate_overall_ratios(classifications)

        # Detect red line violations
        violations = self._detect_red_lines(chapters, classifications)

        # Calculate current streaks/gaps
        quest_streak = self._calculate_current_streak(classifications, "quest")
        fire_gap = self._calculate_current_gap(classifications, "fire")
        constellation_gap = self._calculate_current_gap(classifications, "constellation")

        # Health score
        health_score = self._calculate_health_score(
            strand_ratios, violations, quest_streak, fire_gap, constellation_gap
        )

        # Generate summary
        summary = self._generate_summary(
            strand_ratios, violations, quest_streak, fire_gap, constellation_gap
        )

        return PacingAnalysis(
            outline_id=outline_id,
            total_chapters=len(chapters),
            strand_ratios=strand_ratios,
            chapter_classifications=[c.to_dict() for c in classifications],
            red_line_violations=violations,
            quest_streak=quest_streak,
            fire_gap=fire_gap,
            constellation_gap=constellation_gap,
            health_score=health_score,
            summary=summary,
        )

    async def analyze_chapter_range(
        self,
        outline_id: int,
        db: AsyncSession,
        start_chapter: int = 1,
        end_chapter: Optional[int] = None,
        use_ai: bool = False,
    ) -> PacingAnalysis:
        """Analyze pacing for a range of chapters.

        Args:
            outline_id: The outline ID.
            db: Async database session.
            start_chapter: Starting chapter order (1-based).
            end_chapter: Ending chapter order (inclusive). None = all.
            use_ai: If True, use AI for classification.

        Returns:
            PacingAnalysis for the specified range.
        """
        query = (
            select(Chapter)
            .where(Chapter.outline_id == outline_id)
            .where(Chapter.chapter_order >= start_chapter)
            .order_by(Chapter.chapter_order.asc())
        )
        if end_chapter is not None:
            query = query.where(Chapter.chapter_order <= end_chapter)

        result = await db.execute(query)
        chapters = result.scalars().all()

        if not chapters:
            return PacingAnalysis(
                outline_id=outline_id,
                total_chapters=0,
                summary=f"No chapters found in range {start_chapter}-{end_chapter or 'end'}.",
            )

        classifications = []
        for chapter in chapters:
            classification = await self.classifier.classify_chapter(
                chapter.id, db, use_ai=use_ai
            )
            classifications.append(classification)

        strand_ratios = self._calculate_overall_ratios(classifications)
        violations = self._detect_red_lines(chapters, classifications)
        quest_streak = self._calculate_current_streak(classifications, "quest")
        fire_gap = self._calculate_current_gap(classifications, "fire")
        constellation_gap = self._calculate_current_gap(classifications, "constellation")
        health_score = self._calculate_health_score(
            strand_ratios, violations, quest_streak, fire_gap, constellation_gap
        )
        summary = self._generate_summary(
            strand_ratios, violations, quest_streak, fire_gap, constellation_gap
        )

        return PacingAnalysis(
            outline_id=outline_id,
            total_chapters=len(chapters),
            strand_ratios=strand_ratios,
            chapter_classifications=[c.to_dict() for c in classifications],
            red_line_violations=violations,
            quest_streak=quest_streak,
            fire_gap=fire_gap,
            constellation_gap=constellation_gap,
            health_score=health_score,
            summary=summary,
        )

    def _calculate_overall_ratios(
        self, classifications: list[StrandClassification]
    ) -> dict[str, float]:
        """Calculate aggregate strand ratios across all chapters."""
        if not classifications:
            return {"quest": 0.0, "fire": 0.0, "constellation": 0.0}

        total_quest = sum(c.quest for c in classifications)
        total_fire = sum(c.fire for c in classifications)
        total_constellation = sum(c.constellation for c in classifications)
        total = total_quest + total_fire + total_constellation

        if total == 0:
            return {"quest": 0.0, "fire": 0.0, "constellation": 0.0}

        return {
            "quest": round(total_quest / total, 3),
            "fire": round(total_fire / total, 3),
            "constellation": round(total_constellation / total, 3),
        }

    def _detect_red_lines(
        self,
        chapters: list[Chapter],
        classifications: list[StrandClassification],
    ) -> list[RedLineViolation]:
        """Detect all red line violations."""
        violations = []

        # Quest continuous streak
        quest_streaks = self._find_streaks(classifications, "quest")
        for streak in quest_streaks:
            if streak["length"] > self.RED_LINES["quest"]["max_continuous"]:
                chapter_ids = [
                    chapters[i].id for i in range(streak["start"], streak["end"] + 1)
                ]
                violations.append(
                    RedLineViolation(
                        strand="quest",
                        violation_type="continuous",
                        chapters_affected=chapter_ids,
                        severity="critical",
                        message=f"Quest连续出现{streak['length']}章，超过红线(5章)",
                        suggestion="建议插入感情线或世界观扩展内容，打破主线单调节奏",
                    )
                )

        # Fire gap detection
        fire_gaps = self._find_gaps(classifications, "fire")
        for gap in fire_gaps:
            if gap["length"] > self.RED_LINES["fire"]["max_gap"]:
                chapter_ids = [
                    chapters[i].id for i in range(gap["start"], gap["end"] + 1)
                ]
                violations.append(
                    RedLineViolation(
                        strand="fire",
                        violation_type="gap",
                        chapters_affected=chapter_ids,
                        severity="warning",
                        message=f"Fire断档{gap['length']}章，超过红线(10章)",
                        suggestion="建议尽快安排角色情感互动或关系发展场景",
                    )
                )

        # Constellation gap detection
        constellation_gaps = self._find_gaps(classifications, "constellation")
        for gap in constellation_gaps:
            if gap["length"] > self.RED_LINES["constellation"]["max_gap"]:
                chapter_ids = [
                    chapters[i].id for i in range(gap["start"], gap["end"] + 1)
                ]
                violations.append(
                    RedLineViolation(
                        strand="constellation",
                        violation_type="gap",
                        chapters_affected=chapter_ids,
                        severity="warning",
                        message=f"Constellation断档{gap['length']}章，超过红线(15章)",
                        suggestion="建议适当插入世界观设定、势力背景或规则体系内容",
                    )
                )

        return violations

    def _find_streaks(
        self, classifications: list[StrandClassification], strand: str
    ) -> list[dict]:
        """Find continuous streaks where strand is dominant."""
        streaks = []
        current_start = 0
        current_length = 0

        for i, c in enumerate(classifications):
            if c.dominant == strand:
                if current_length == 0:
                    current_start = i
                current_length += 1
            else:
                if current_length > 0:
                    streaks.append({
                        "start": current_start,
                        "end": i - 1,
                        "length": current_length,
                    })
                current_length = 0

        if current_length > 0:
            streaks.append({
                "start": current_start,
                "end": len(classifications) - 1,
                "length": current_length,
            })

        return streaks

    def _find_gaps(
        self, classifications: list[StrandClassification], strand: str
    ) -> list[dict]:
        """Find gaps where strand does NOT appear as dominant."""
        gaps = []
        current_start = 0
        current_length = 0

        for i, c in enumerate(classifications):
            if c.dominant != strand:
                if current_length == 0:
                    current_start = i
                current_length += 1
            else:
                if current_length > 0:
                    gaps.append({
                        "start": current_start,
                        "end": i - 1,
                        "length": current_length,
                    })
                current_length = 0

        if current_length > 0:
            gaps.append({
                "start": current_start,
                "end": len(classifications) - 1,
                "length": current_length,
            })

        return gaps

    def _calculate_current_streak(
        self, classifications: list[StrandClassification], strand: str
    ) -> int:
        """Calculate current continuous streak from the end."""
        streak = 0
        for c in reversed(classifications):
            if c.dominant == strand:
                streak += 1
            else:
                break
        return streak

    def _calculate_current_gap(
        self, classifications: list[StrandClassification], strand: str
    ) -> int:
        """Calculate current gap from the end."""
        gap = 0
        for c in reversed(classifications):
            if c.dominant != strand:
                gap += 1
            else:
                break
        return gap

    def _calculate_health_score(
        self,
        strand_ratios: dict[str, float],
        violations: list[RedLineViolation],
        quest_streak: int,
        fire_gap: int,
        constellation_gap: int,
    ) -> int:
        """Calculate overall pacing health score (0-100)."""
        score = 100

        # Deduct for ratio deviation from ideal
        for strand, ideal in self.IDEAL_RATIOS.items():
            actual = strand_ratios.get(strand, 0)
            deviation = abs(actual - ideal)
            score -= int(deviation * 50)

        # Deduct for violations
        for v in violations:
            if v.severity == "critical":
                score -= 15
            else:
                score -= 8

        # Deduct for approaching red lines
        if quest_streak >= 4:
            score -= 5
        if fire_gap >= 8:
            score -= 5
        if constellation_gap >= 12:
            score -= 5

        return max(0, min(100, score))

    def _generate_summary(
        self,
        strand_ratios: dict[str, float],
        violations: list[RedLineViolation],
        quest_streak: int,
        fire_gap: int,
        constellation_gap: int,
    ) -> str:
        """Generate human-readable summary."""
        parts = []

        parts.append(
            f"当前节奏比例: Quest {strand_ratios.get('quest', 0):.1%}, "
            f"Fire {strand_ratios.get('fire', 0):.1%}, "
            f"Constellation {strand_ratios.get('constellation', 0):.1%}"
        )

        if violations:
            parts.append(f"检测到 {len(violations)} 处红线违规")
            for v in violations:
                parts.append(f"  - {v.message}")
        else:
            parts.append("未检测到红线违规")

        status_parts = []
        if quest_streak > 0:
            status_parts.append(f"Quest连续{quest_streak}章")
        if fire_gap > 0:
            status_parts.append(f"Fire断档{fire_gap}章")
        if constellation_gap > 0:
            status_parts.append(f"Constellation断档{constellation_gap}章")

        if status_parts:
            parts.append("当前状态: " + "，".join(status_parts))

        return "\n".join(parts)
