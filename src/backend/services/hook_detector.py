# -*- coding: utf-8 -*-
"""
Hook Detector Service

Detects narrative hooks in chapter content:
- Suspense hooks (悬念钩子): cliffhangers, mysteries, unanswered questions
- Emotional hooks (情感钩子): emotional resonance, character attachment
- Conflict hooks (冲突钩子): unresolved conflicts, tensions, confrontations

Uses keyword-based detection as a fast heuristic, with optional LLM deep analysis.
Reference: read/reference-webnovel/webnovel-writer/scripts/golden_three_checker.py
"""

import re
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum


class HookType(str, Enum):
    """Types of narrative hooks."""
    SUSPENSE = "suspense"
    EMOTIONAL = "emotional"
    CONFLICT = "conflict"
    MYSTERY = "mystery"
    FORESHADOWING = "foreshadowing"


class HookPosition(str, Enum):
    """Position of hook within chapter."""
    OPENING = "opening"
    MIDDLE = "middle"
    ENDING = "ending"


@dataclass
class Hook:
    """A detected narrative hook."""
    type: HookType
    position: HookPosition
    text: str
    confidence: float  # 0.0 - 1.0
    keywords: List[str] = field(default_factory=list)
    context: str = ""  # surrounding text
    line_number: Optional[int] = None


@dataclass
class HookAnalysisResult:
    """Result of hook analysis for a chapter."""
    chapter_id: int
    total_hooks: int
    hooks_by_type: Dict[str, int]
    hooks_by_position: Dict[str, int]
    hooks: List[Hook]
    opening_hook_strength: float  # 0.0 - 1.0
    ending_hook_strength: float  # 0.0 - 1.0
    overall_hook_score: float  # 0.0 - 100.0
    suggestions: List[str] = field(default_factory=list)


# ============================================================================
# Keyword dictionaries for hook detection
# ============================================================================

SUSPENSE_KEYWORDS = {
    "high": [
        "生死未卜", "命悬一线", "危机四伏", "杀机", "绝境", "濒死",
        "就在这时", "突然", "异变", "不对劲", "不祥", "预感",
        "背后一凉", "冷汗", "瞳孔收缩", "心中一沉",
    ],
    "medium": [
        "悬念", "谜团", "未知", "秘密", "真相", "幕后",
        "暗流", "阴谋", "布局", "算计", "陷阱", "圈套",
        "若隐若现", "扑朔迷离", "疑云", "蹊跷",
    ],
    "low": [
        "奇怪", "异常", "不同寻常", "出乎意料", "没想到",
        "究竟", "到底", "莫非", "难道", "难道说",
    ],
}

EMOTIONAL_KEYWORDS = {
    "high": [
        "心如刀割", "泪如雨下", "撕心裂肺", "痛不欲生", "肝肠寸断",
        "喜极而泣", "热泪盈眶", "感动", "震撼", "触动",
        "共鸣", "代入感", "心疼", "意难平",
    ],
    "medium": [
        "愤怒", "悲伤", "喜悦", "恐惧", "期待", "焦虑",
        "不甘", "绝望", "希望", "温暖", "孤独", "迷茫",
        "复杂", "五味杂陈", "百感交集",
    ],
    "low": [
        "感觉", "心情", "情绪", "感触", "体会", "感受",
        "莫名", "隐隐", "一丝", "几分",
    ],
}

CONFLICT_KEYWORDS = {
    "high": [
        "对决", "厮杀", "死战", "决战", "碰撞", "交锋",
        "不可调和", "势不两立", "你死我活", "鱼死网破",
        "碾压", "秒杀", "镇压", "碾压", "横扫",
    ],
    "medium": [
        "冲突", "矛盾", "对抗", "争执", "较量", "博弈",
        "针锋相对", "剑拔弩张", "一触即发", "火药味",
        "嘲讽", "挑衅", "羞辱", "打脸", "反击",
    ],
    "low": [
        " disagreement", "分歧", "不同", "摩擦", "隔阂",
        "误会", "误解", "偏见", "成见",
    ],
}

MYSTERY_KEYWORDS = {
    "high": [
        "谜团", "谜题", "谜底", "真相", "隐藏", "隐秘",
        "不为人知的秘密", "惊天秘密", "身世之谜",
    ],
    "medium": [
        "疑问", "好奇", "探寻", "追查", "线索", "蛛丝马迹",
        "端倪", "破绽", "漏洞", "疑点",
    ],
    "low": [
        "为什么", "怎么回事", "发生了什么", "意味着什么",
        "背后", "内幕", "隐情",
    ],
}

FORESHADOWING_KEYWORDS = {
    "high": [
        "伏笔", "铺垫", "暗示", "预示", "征兆", "迹象",
        "日后", "将来", "未来", "命运",
    ],
    "medium": [
        "隐约", "仿佛", "似乎", "好像", "不知为何",
        "日后方知", "没想到", "不曾想",
    ],
    "low": [
        "也许", "可能", "或许", "说不定", "万一",
    ],
}

# Punctuation patterns that indicate suspense
SUSPENSE_PUNCTUATION = ["？", "！", "……", "——"]

# Ending hook patterns (last 300 chars)
ENDING_HOOK_PATTERNS = [
    r".{0,30}[竟|竟然|竟敢|竟会].{0,50}[?？!！]",
    r".{0,30}[原来|没想到|不曾想].{0,50}",
    r".{0,30}[杀机|危机|危险|绝境].{0,50}",
    r".{0,30}[是谁|是什么|为什么|怎么回事].{0,30}[?？]",
    r".{0,50}[就在这时|突然|猛然|骤然].{0,50}",
]


class HookDetector:
    """Detects narrative hooks in Chinese web novel chapter content."""

    def __init__(self, use_llm: bool = False):
        """
        Initialize hook detector.

        Args:
            use_llm: Whether to use LLM for deep analysis (fallback to keywords if False)
        """
        self.use_llm = use_llm
        self._keyword_map = {
            HookType.SUSPENSE: SUSPENSE_KEYWORDS,
            HookType.EMOTIONAL: EMOTIONAL_KEYWORDS,
            HookType.CONFLICT: CONFLICT_KEYWORDS,
            HookType.MYSTERY: MYSTERY_KEYWORDS,
            HookType.FORESHADOWING: FORESHADOWING_KEYWORDS,
        }

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def detect(self, chapter_id: int, content: str) -> HookAnalysisResult:
        """
        Detect all hooks in chapter content.

        Args:
            chapter_id: Chapter ID
            content: Chapter text content

        Returns:
            HookAnalysisResult with all detected hooks and scores
        """
        if not content or not content.strip():
            return self._empty_result(chapter_id)

        # Clean content
        clean_content = self._clean_content(content)
        lines = clean_content.split('\n')
        total_chars = len(clean_content)

        # Define position boundaries
        opening_end = min(500, total_chars // 5)
        ending_start = max(total_chars - 500, total_chars * 4 // 5)

        all_hooks: List[Hook] = []

        # Detect hooks by type
        for hook_type in HookType:
            hooks = self._detect_by_keywords(
                clean_content, lines, hook_type, opening_end, ending_start
            )
            all_hooks.extend(hooks)

        # Detect ending-specific hooks
        ending_hooks = self._detect_ending_hooks(clean_content, ending_start)
        all_hooks.extend(ending_hooks)

        # Detect punctuation-based suspense
        punct_hooks = self._detect_punctuation_hooks(
            clean_content, lines, opening_end, ending_start
        )
        all_hooks.extend(punct_hooks)

        # Calculate scores
        hooks_by_type = self._count_by_type(all_hooks)
        hooks_by_position = self._count_by_position(all_hooks)

        opening_hook_strength = self._calculate_position_strength(
            all_hooks, HookPosition.OPENING
        )
        ending_hook_strength = self._calculate_position_strength(
            all_hooks, HookPosition.ENDING
        )
        overall_score = self._calculate_overall_score(
            all_hooks, opening_hook_strength, ending_hook_strength, total_chars
        )

        suggestions = self._generate_suggestions(
            all_hooks, opening_hook_strength, ending_hook_strength, overall_score
        )

        return HookAnalysisResult(
            chapter_id=chapter_id,
            total_hooks=len(all_hooks),
            hooks_by_type=hooks_by_type,
            hooks_by_position=hooks_by_position,
            hooks=all_hooks,
            opening_hook_strength=opening_hook_strength,
            ending_hook_strength=ending_hook_strength,
            overall_hook_score=overall_score,
            suggestions=suggestions,
        )

    def detect_quick(self, chapter_id: int, content: str) -> Dict[str, Any]:
        """Quick detection returning a simplified JSON-serializable result."""
        result = self.detect(chapter_id, content)
        return self._serialize_result(result)

    # ------------------------------------------------------------------
    # Detection methods
    # ------------------------------------------------------------------

    def _detect_by_keywords(
        self,
        content: str,
        lines: List[str],
        hook_type: HookType,
        opening_end: int,
        ending_start: int,
    ) -> List[Hook]:
        """Detect hooks using keyword matching."""
        keywords = self._keyword_map.get(hook_type, {})
        hooks = []
        char_pos = 0

        for line_idx, line in enumerate(lines):
            for level, word_list in keywords.items():
                for keyword in word_list:
                    for match in re.finditer(re.escape(keyword), line):
                        confidence = self._keyword_confidence(level)
                        position = self._determine_position(
                            char_pos + match.start(), opening_end, ending_start
                        )
                        context = self._extract_context(content, char_pos + match.start())

                        hooks.append(Hook(
                            type=hook_type,
                            position=position,
                            text=keyword,
                            confidence=confidence,
                            keywords=[keyword],
                            context=context,
                            line_number=line_idx + 1,
                        ))
            char_pos += len(line) + 1  # +1 for newline

        return hooks

    def _detect_ending_hooks(
        self, content: str, ending_start: int
    ) -> List[Hook]:
        """Detect hooks specifically in the ending section."""
        ending = content[ending_start:]
        hooks = []

        for pattern in ENDING_HOOK_PATTERNS:
            for match in re.finditer(pattern, ending):
                confidence = 0.7 + min(len(match.group()) / 100, 0.3)
                hooks.append(Hook(
                    type=HookType.SUSPENSE,
                    position=HookPosition.ENDING,
                    text=match.group()[:50],
                    confidence=confidence,
                    keywords=["ending_pattern"],
                    context=match.group()[:100],
                ))

        # Check for unanswered questions at ending
        question_count = ending.count('？') + ending.count('?')
        if question_count >= 2:
            hooks.append(Hook(
                type=HookType.SUSPENSE,
                position=HookPosition.ENDING,
                text=f"{question_count} unanswered questions",
                confidence=min(0.5 + question_count * 0.1, 0.9),
                keywords=["unanswered_questions"],
                context=ending[-100:],
            ))

        return hooks

    def _detect_punctuation_hooks(
        self,
        content: str,
        lines: List[str],
        opening_end: int,
        ending_start: int,
    ) -> List[Hook]:
        """Detect suspense based on punctuation patterns."""
        hooks = []
        char_pos = 0

        for line_idx, line in enumerate(lines):
            # Count suspense punctuation
            suspense_count = sum(line.count(p) for p in SUSPENSE_PUNCTUATION)
            if suspense_count >= 3:
                position = self._determine_position(
                    char_pos, opening_end, ending_start
                )
                confidence = min(0.4 + suspense_count * 0.05, 0.7)
                hooks.append(Hook(
                    type=HookType.SUSPENSE,
                    position=position,
                    text="intense punctuation pattern",
                    confidence=confidence,
                    keywords=["punctuation"],
                    context=line[:80],
                    line_number=line_idx + 1,
                ))
            char_pos += len(line) + 1

        return hooks

    # ------------------------------------------------------------------
    # Scoring
    # ------------------------------------------------------------------

    def _calculate_position_strength(
        self, hooks: List[Hook], position: HookPosition
    ) -> float:
        """Calculate hook strength for a specific position (0.0 - 1.0)."""
        position_hooks = [h for h in hooks if h.position == position]
        if not position_hooks:
            return 0.0

        # Weight by confidence and diversity of types
        total_confidence = sum(h.confidence for h in position_hooks)
        unique_types = len(set(h.type for h in position_hooks))

        base_score = min(total_confidence / 3, 0.7)  # cap at 0.7 for quantity
        diversity_bonus = unique_types * 0.1  # up to 0.5 for 5 types

        return min(base_score + diversity_bonus, 1.0)

    def _calculate_overall_score(
        self,
        hooks: List[Hook],
        opening_strength: float,
        ending_strength: float,
        total_chars: int,
    ) -> float:
        """Calculate overall hook score (0.0 - 100.0)."""
        if total_chars == 0:
            return 0.0

        # Base score from hook density
        density = len(hooks) / (total_chars / 1000)  # hooks per 1000 chars
        density_score = min(density * 15, 40)  # up to 40 points

        # Position scores
        opening_score = opening_strength * 25  # up to 25 points
        ending_score = ending_strength * 25  # up to 25 points

        # Diversity bonus
        unique_types = len(set(h.type for h in hooks))
        diversity_score = unique_types * 2.5  # up to 12.5 points

        total = density_score + opening_score + ending_score + diversity_score
        return min(total, 100.0)

    # ------------------------------------------------------------------
    # Suggestions
    # ------------------------------------------------------------------

    def _generate_suggestions(
        self,
        hooks: List[Hook],
        opening_strength: float,
        ending_strength: float,
        overall_score: float,
    ) -> List[str]:
        """Generate improvement suggestions based on hook analysis."""
        suggestions = []

        if opening_strength < 0.3:
            suggestions.append(
                "开篇钩子较弱：建议在开头300字内设置悬念、冲突或情感冲击，"
                "快速抓住读者注意力。"
            )

        if ending_strength < 0.4:
            suggestions.append(
                "结尾钩子不足：章节结尾应留下悬念或未解之谜，驱动读者继续阅读下一章。"
            )

        hooks_by_type = self._count_by_type(hooks)
        if hooks_by_type.get(HookType.SUSPENSE.value, 0) == 0:
            suggestions.append(
                "缺少悬念钩子：适当增加谜团、危机或未知元素，提升追读欲望。"
            )

        if hooks_by_type.get(HookType.CONFLICT.value, 0) == 0:
            suggestions.append(
                "缺少冲突钩子：建议增加人物对抗、矛盾或博弈情节。"
            )

        if overall_score < 40:
            suggestions.append(
                "整体钩子密度偏低：本章吸引力不足，建议增加各类钩子提升追读力。"
            )
        elif overall_score > 80:
            suggestions.append("钩子布局优秀，保持了良好的追读吸引力。")

        return suggestions

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    def _clean_content(self, content: str) -> str:
        """Clean content for analysis."""
        # Remove excessive whitespace
        content = re.sub(r'\s+', ' ', content)
        # Remove markdown formatting
        content = re.sub(r'[#*`_\[\]]', '', content)
        return content.strip()

    def _determine_position(
        self, char_pos: int, opening_end: int, ending_start: int
    ) -> HookPosition:
        """Determine if position is opening, middle, or ending."""
        if char_pos < opening_end:
            return HookPosition.OPENING
        elif char_pos > ending_start:
            return HookPosition.ENDING
        return HookPosition.MIDDLE

    def _extract_context(self, content: str, pos: int, radius: int = 40) -> str:
        """Extract surrounding context text."""
        start = max(0, pos - radius)
        end = min(len(content), pos + radius)
        return content[start:end]

    def _keyword_confidence(self, level: str) -> float:
        """Map keyword level to confidence score."""
        return {"high": 0.9, "medium": 0.6, "low": 0.3}.get(level, 0.3)

    def _count_by_type(self, hooks: List[Hook]) -> Dict[str, int]:
        """Count hooks by type."""
        counts = {t.value: 0 for t in HookType}
        for hook in hooks:
            counts[hook.type.value] = counts.get(hook.type.value, 0) + 1
        return counts

    def _count_by_position(self, hooks: List[Hook]) -> Dict[str, int]:
        """Count hooks by position."""
        counts = {p.value: 0 for p in HookPosition}
        for hook in hooks:
            counts[hook.position.value] = counts.get(hook.position.value, 0) + 1
        return counts

    def _empty_result(self, chapter_id: int) -> HookAnalysisResult:
        """Return empty result for empty content."""
        return HookAnalysisResult(
            chapter_id=chapter_id,
            total_hooks=0,
            hooks_by_type={t.value: 0 for t in HookType},
            hooks_by_position={p.value: 0 for p in HookPosition},
            hooks=[],
            opening_hook_strength=0.0,
            ending_hook_strength=0.0,
            overall_hook_score=0.0,
            suggestions=["章节内容为空，无法分析钩子。"],
        )

    def _serialize_result(self, result: HookAnalysisResult) -> Dict[str, Any]:
        """Serialize result to JSON-compatible dict."""
        return {
            "chapter_id": result.chapter_id,
            "total_hooks": result.total_hooks,
            "hooks_by_type": result.hooks_by_type,
            "hooks_by_position": result.hooks_by_position,
            "hooks": [
                {
                    "type": h.type.value,
                    "position": h.position.value,
                    "text": h.text,
                    "confidence": round(h.confidence, 2),
                    "keywords": h.keywords,
                    "context": h.context,
                    "line_number": h.line_number,
                }
                for h in result.hooks
            ],
            "opening_hook_strength": round(result.opening_hook_strength, 2),
            "ending_hook_strength": round(result.ending_hook_strength, 2),
            "overall_hook_score": round(result.overall_hook_score, 1),
            "suggestions": result.suggestions,
        }


# Module-level singleton
hook_detector = HookDetector()
