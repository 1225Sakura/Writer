"""Rhythm advisor service - advise next chapter's strand based on current state.

Uses pacing analysis to recommend which strand should dominate the next chapter
to maintain ideal ratios and avoid red line violations.

Strand ideal ratios:
- Quest: 60%
- Fire: 20%
- Constellation: 20%

Red lines:
- Quest continuous <= 5 chapters
- Fire gap <= 10 chapters
- Constellation gap <= 15 chapters
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.services.pacing_analyzer import PacingAnalyzer, PacingAnalysis
from backend.services.strand_classifier import StrandClassification


@dataclass
class StrandAdvice:
    """Advice for the next chapter's strand composition."""

    recommended_strand: str
    confidence: float
    reasoning: str
    urgency: str = "normal"  # "normal" | "high" | "critical"
    alternative_strands: list[str] = field(default_factory=list)
    suggested_elements: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "recommended_strand": self.recommended_strand,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
            "urgency": self.urgency,
            "alternative_strands": self.alternative_strands,
            "suggested_elements": self.suggested_elements,
            "warnings": self.warnings,
        }


class RhythmAdvisor:
    """Advise next chapter's strand based on current pacing state.

    Analyzes the current pacing situation and recommends which strand
    should be emphasized in the next chapter to maintain healthy ratios
    and avoid red line violations.
    """

    IDEAL_RATIOS = {
        "quest": 0.60,
        "fire": 0.20,
        "constellation": 0.20,
    }

    RED_LINE_WARN_THRESHOLD = {
        "quest": {"continuous": 4, "gap": float("inf")},
        "fire": {"continuous": float("inf"), "gap": 8},
        "constellation": {"continuous": float("inf"), "gap": 12},
    }

    RED_LINE_HARD = {
        "quest": {"max_continuous": 5, "max_gap": float("inf")},
        "fire": {"max_continuous": float("inf"), "max_gap": 10},
        "constellation": {"max_continuous": float("inf"), "max_gap": 15},
    }

    def __init__(self, analyzer: Optional[PacingAnalyzer] = None) -> None:
        self.analyzer = analyzer or PacingAnalyzer()

    async def advise_next_chapter(
        self,
        outline_id: int,
        db: AsyncSession,
        use_ai: bool = False,
    ) -> StrandAdvice:
        """Advise which strand the next chapter should focus on.

        Args:
            outline_id: The outline ID to analyze.
            db: Async database session.
            use_ai: If True, use AI for classification.

        Returns:
            StrandAdvice with recommendation and reasoning.
        """
        analysis = await self.analyzer.analyze_outline(outline_id, db, use_ai=use_ai)
        return self._generate_advice(analysis)

    async def advise_for_chapter_position(
        self,
        outline_id: int,
        chapter_order: int,
        db: AsyncSession,
        use_ai: bool = False,
    ) -> StrandAdvice:
        """Advise strand for a specific chapter position.

        Analyzes chapters before the given position to provide advice.

        Args:
            outline_id: The outline ID.
            chapter_order: The chapter order position (1-based).
            db: Async database session.
            use_ai: If True, use AI for classification.

        Returns:
            StrandAdvice for the specified position.
        """
        analysis = await self.analyzer.analyze_chapter_range(
            outline_id, db, start_chapter=1, end_chapter=chapter_order - 1, use_ai=use_ai
        )
        return self._generate_advice(analysis)

    def _generate_advice(self, analysis: PacingAnalysis) -> StrandAdvice:
        """Generate advice based on pacing analysis."""
        warnings = []
        urgency = "normal"

        # Check for critical red line violations
        for v in analysis.red_line_violations:
            if v.severity == "critical":
                urgency = "critical"
                warnings.append(v.message)
            elif v.severity == "warning":
                if urgency != "critical":
                    urgency = "high"
                warnings.append(v.message)

        # Check approaching red lines
        if analysis.quest_streak >= self.RED_LINE_WARN_THRESHOLD["quest"]["continuous"]:
            warnings.append(f"Quest连续{analysis.quest_streak}章，接近红线(5章)")
            if urgency != "critical":
                urgency = "high"

        if analysis.fire_gap >= self.RED_LINE_WARN_THRESHOLD["fire"]["gap"]:
            warnings.append(f"Fire断档{analysis.fire_gap}章，接近红线(10章)")
            if urgency == "normal":
                urgency = "high"

        if analysis.constellation_gap >= self.RED_LINE_WARN_THRESHOLD["constellation"]["gap"]:
            warnings.append(f"Constellation断档{analysis.constellation_gap}章，接近红线(15章)")
            if urgency == "normal":
                urgency = "high"

        # Calculate deviation from ideal for each strand
        deviations = {}
        for strand, ideal in self.IDEAL_RATIOS.items():
            actual = analysis.strand_ratios.get(strand, 0)
            deviations[strand] = actual - ideal

        # Determine recommendation priority
        # Priority 1: Address red line violations
        if analysis.quest_streak >= self.RED_LINE_HARD["quest"]["max_continuous"]:
            return StrandAdvice(
                recommended_strand="fire_or_constellation",
                confidence=0.95,
                reasoning="Quest已连续超过5章，必须立即插入非主线内容打破单调",
                urgency="critical",
                alternative_strands=["fire", "constellation"],
                suggested_elements=self._get_suggested_elements("fire"),
                warnings=warnings,
            )

        if analysis.fire_gap >= self.RED_LINE_HARD["fire"]["max_gap"]:
            return StrandAdvice(
                recommended_strand="fire",
                confidence=0.95,
                reasoning=f"Fire已断档{analysis.fire_gap}章，超过红线，必须安排感情线内容",
                urgency="critical",
                alternative_strands=["constellation"],
                suggested_elements=self._get_suggested_elements("fire"),
                warnings=warnings,
            )

        if analysis.constellation_gap >= self.RED_LINE_HARD["constellation"]["max_gap"]:
            return StrandAdvice(
                recommended_strand="constellation",
                confidence=0.90,
                reasoning=f"Constellation已断档{analysis.constellation_gap}章，超过红线，需要世界观内容",
                urgency="critical",
                alternative_strands=["fire"],
                suggested_elements=self._get_suggested_elements("constellation"),
                warnings=warnings,
            )

        # Priority 2: Address approaching red lines
        if analysis.quest_streak >= self.RED_LINE_WARN_THRESHOLD["quest"]["continuous"]:
            return StrandAdvice(
                recommended_strand="fire",
                confidence=0.80,
                reasoning=f"Quest连续{analysis.quest_streak}章，接近红线，建议插入感情线缓冲",
                urgency="high",
                alternative_strands=["constellation"],
                suggested_elements=self._get_suggested_elements("fire"),
                warnings=warnings,
            )

        if analysis.fire_gap >= self.RED_LINE_WARN_THRESHOLD["fire"]["gap"]:
            return StrandAdvice(
                recommended_strand="fire",
                confidence=0.85,
                reasoning=f"Fire断档{analysis.fire_gap}章，接近红线，建议安排情感互动",
                urgency="high",
                alternative_strands=["constellation"],
                suggested_elements=self._get_suggested_elements("fire"),
                warnings=warnings,
            )

        if analysis.constellation_gap >= self.RED_LINE_WARN_THRESHOLD["constellation"]["gap"]:
            return StrandAdvice(
                recommended_strand="constellation",
                confidence=0.80,
                reasoning=f"Constellation断档{analysis.constellation_gap}章，接近红线，建议插入世界观内容",
                urgency="high",
                alternative_strands=["fire"],
                suggested_elements=self._get_suggested_elements("constellation"),
                warnings=warnings,
            )

        # Priority 3: Balance ratios
        # Find most underrepresented strand
        sorted_deviations = sorted(deviations.items(), key=lambda x: x[1])
        most_under = sorted_deviations[0][0]
        most_over = sorted_deviations[-1][0]

        # If ratios are reasonably balanced, follow natural flow
        if all(abs(d) < 0.05 for d in deviations.values()):
            # Ratios are good - suggest variety based on recent streak
            if analysis.quest_streak >= 3:
                recommended = "fire"
                reasoning = "主线已连续3章，建议插入感情线调节节奏"
            else:
                recommended = "quest"
                reasoning = "节奏比例均衡，继续推进主线剧情"
            confidence = 0.70
        else:
            recommended = most_under
            deviation = deviations[most_under]
            confidence = min(0.90, 0.60 + abs(deviation) * 2)

            if most_under == "quest":
                reasoning = f"Quest占比偏低(偏差{deviation:.1%})，建议推进主线剧情"
            elif most_under == "fire":
                reasoning = f"Fire占比偏低(偏差{deviation:.1%})，建议增加感情线内容"
            else:
                reasoning = f"Constellation占比偏低(偏差{deviation:.1%})，建议扩展世界观内容"

        alternative_strands = [s for s in ["quest", "fire", "constellation"] if s != recommended]

        return StrandAdvice(
            recommended_strand=recommended,
            confidence=round(confidence, 2),
            reasoning=reasoning,
            urgency=urgency,
            alternative_strands=alternative_strands,
            suggested_elements=self._get_suggested_elements(recommended),
            warnings=warnings,
        )

    def _get_suggested_elements(self, strand: str) -> list[str]:
        """Get suggested story elements for a strand."""
        elements = {
            "quest": [
                "主角制定新计划或接受新任务",
                "推进核心冲突，遭遇新阻碍",
                "完成阶段性目标，获得成长",
                "揭示新的剧情线索或反转",
                "与反派势力正面交锋",
            ],
            "fire": [
                "角色间情感对话或内心独白",
                "误会与和解的情节",
                "共同经历危机增进感情",
                "回忆过往加深羁绊",
                "表白或关系确认的关键时刻",
            ],
            "constellation": [
                "介绍新的势力或地域背景",
                "揭示世界观规则或历史秘闻",
                "探索新地图或秘境",
                "展示修炼体系或力量层级",
                "通过对话交代设定信息",
            ],
            "fire_or_constellation": [
                "安排角色情感互动场景",
                "通过角色对话自然带出世界观设定",
                "在冒险中穿插人物关系发展",
                "探索新地点时展现势力格局",
            ],
        }
        return elements.get(strand, elements["quest"])

    def quick_advise(
        self,
        recent_classifications: list[StrandClassification],
    ) -> StrandAdvice:
        """Quick advice based on recent classifications without DB access.

        Args:
            recent_classifications: List of recent chapter classifications
                (most recent last).

        Returns:
            StrandAdvice based on recent history.
        """
        if not recent_classifications:
            return StrandAdvice(
                recommended_strand="quest",
                confidence=0.5,
                reasoning="无历史数据，默认推进主线",
                suggested_elements=self._get_suggested_elements("quest"),
            )

        # Calculate ratios from recent chapters
        total_quest = sum(c.quest for c in recent_classifications)
        total_fire = sum(c.fire for c in recent_classifications)
        total_constellation = sum(c.constellation for c in recent_classifications)
        total = total_quest + total_fire + total_constellation

        if total == 0:
            ratios = {"quest": 0, "fire": 0, "constellation": 0}
        else:
            ratios = {
                "quest": total_quest / total,
                "fire": total_fire / total,
                "constellation": total_constellation / total,
            }

        # Calculate streaks/gaps from end
        quest_streak = 0
        fire_gap = 0
        constellation_gap = 0

        for c in reversed(recent_classifications):
            if c.dominant == "quest":
                quest_streak += 1
            else:
                break

        for c in reversed(recent_classifications):
            if c.dominant != "fire":
                fire_gap += 1
            else:
                break

        for c in reversed(recent_classifications):
            if c.dominant != "constellation":
                constellation_gap += 1
            else:
                break

        # Build a minimal analysis
        analysis = PacingAnalysis(
            outline_id=0,
            total_chapters=len(recent_classifications),
            strand_ratios=ratios,
            quest_streak=quest_streak,
            fire_gap=fire_gap,
            constellation_gap=constellation_gap,
        )

        return self._generate_advice(analysis)
