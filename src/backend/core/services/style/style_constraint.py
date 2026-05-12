"""Writing Style Constraint Enforcement.

Enforces writing style constraints on generated content:
- Style consistency (匹配选定文笔风格)
- Human-AI ratio compliance (人机协作比例)
- Length constraints (字数控制)
- Forbidden words/phrases (禁用词)
- Required elements (必须包含的元素)

Integrates with the ConstraintEngine as a style-specific plugin.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.domain import WritingSettings, Project
from backend.services.constraints import (
    ConstraintViolation,
    LawType,
    Severity,
)


# Style marker keywords for heuristic detection
STYLE_MARKERS = {
    "江南": ["细腻", "忧伤", "唯美", "诗意", "婉约", "朦胧", "惆怅", "缱绻", "氤氲", "翩跹"],
    "卡夫卡": ["荒诞", "压抑", "变形", "孤独", "官僚", "异化", "恐惧", "不安", "冷漠", "疏离"],
    "加缪": ["荒诞", "存在", "反抗", "阳光", "冷漠", "局外", "荒谬", "虚无", "清醒", "沉默"],
    "热血": ["战斗", "热血", "燃烧", "突破", "逆天", "咆哮", "怒吼", "碾压", "轰杀", "沸腾"],
    "悬疑": ["谜团", "线索", "真相", "隐藏", "秘密", "诡异", "阴森", "冷汗", "毛骨悚然", "蛛丝马迹"],
    "轻松": ["搞笑", "欢乐", "愉快", "温馨", "甜蜜", "逗比", "吐槽", "卖萌", "无厘头", "轻松"],
    "黑暗": ["黑暗", "绝望", "残酷", "血腥", "阴郁", "压抑", "扭曲", "疯狂", "毁灭", "深渊"],
}

# Common overused phrases in AI-generated content (cliches to avoid)
AI_CLICHES = [
    "众所周知", "不言而喻", "显而易见", "毫无疑问", "不可否认",
    "值得一提的是", "令人惊讶的是", "出乎意料的是", "更重要的是",
    "在这个充满", "在这个", "一个", "突然", "然后", "接着",
    "只见", "就在这时", "说时迟那时快", "千钧一发之际",
    "说时迟", "说时迟那时快", "说时迟那时",
]


@dataclass
class StyleConstraint:
    """A single style constraint definition."""

    name: str
    description: str
    enabled: bool = True
    severity: Severity = Severity.MEDIUM
    params: dict[str, Any] = field(default_factory=dict)


class StyleConstraintEnforcer:
    """Enforces writing style constraints on content.

    Checks:
    1. Style consistency against selected writing style
    2. AI cliche detection (anti-slop)
    3. Length constraints (word count)
    4. Forbidden words/phrases
    5. Required structural elements
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def enforce(
        self,
        content: str,
        project_id: Optional[int] = None,
        target_style: Optional[str] = None,
        target_word_count: Optional[int] = None,
        human_ai_ratio: Optional[float] = None,
    ) -> list[ConstraintViolation]:
        """Run all style constraint checks.

        Args:
            content: Text content to check.
            project_id: Project ID to load settings from DB.
            target_style: Override target style (e.g., '江南', '卡夫卡').
            target_word_count: Override target word count.
            human_ai_ratio: Override human-ai ratio (0.0-1.0).

        Returns:
            List of style constraint violations.
        """
        violations: list[ConstraintViolation] = []

        # Load settings from DB if project_id provided
        settings = await self._load_settings(project_id)
        style = target_style or settings.get("writing_style", "default")
        word_count = target_word_count or settings.get("target_word_count", 3000)
        ratio = human_ai_ratio if human_ai_ratio is not None else settings.get("human_ai_ratio", 0.5)

        # Check 1: Style consistency
        style_violations = self._check_style_consistency(content, style)
        violations.extend(style_violations)

        # Check 2: AI cliches (anti-slop)
        cliche_violations = self._check_ai_cliches(content)
        violations.extend(cliche_violations)

        # Check 3: Length constraints
        length_violations = self._check_length(content, word_count)
        violations.extend(length_violations)

        # Check 4: Human-AI ratio indicators
        ratio_violations = self._check_human_ai_ratio(content, ratio)
        violations.extend(ratio_violations)

        return violations

    async def _load_settings(
        self,
        project_id: Optional[int],
    ) -> dict[str, Any]:
        """Load writing settings from database."""
        settings: dict[str, Any] = {}

        if project_id is None:
            return settings

        stmt = select(WritingSettings).where(
            WritingSettings.project_id == project_id
        )
        result = await self._db.execute(stmt)
        ws = result.scalar_one_or_none()

        if ws:
            settings["writing_style"] = ws.writing_style or "default"
            settings["target_word_count"] = ws.target_word_count or 3000
            settings["human_ai_ratio"] = ws.human_ai_ratio or 0.5

        return settings

    def _check_style_consistency(
        self,
        content: str,
        target_style: str,
    ) -> list[ConstraintViolation]:
        """Check if content matches the target writing style."""
        violations: list[ConstraintViolation] = []

        if not content or target_style == "default":
            return violations

        markers = STYLE_MARKERS.get(target_style)
        if not markers:
            return violations

        # Count style marker occurrences
        matches = sum(1 for marker in markers if marker in content)
        total_markers = len(markers)

        if total_markers == 0:
            return violations

        match_ratio = matches / total_markers

        # Style mismatch detection
        if match_ratio < 0.1:
            # Also check for conflicting style markers
            conflicting_styles = []
            for style, style_markers in STYLE_MARKERS.items():
                if style == target_style:
                    continue
                conflict_matches = sum(1 for m in style_markers if m in content)
                if conflict_matches >= 3:
                    conflicting_styles.append(style)

            if conflicting_styles:
                violations.append(ConstraintViolation(
                    rule_id="style_conflict",
                    law_type=LawType.OUTLINE_LAW,
                    severity=Severity.MEDIUM,
                    message=f"文风与目标风格'{target_style}'不符，检测到冲突风格: {', '.join(conflicting_styles)}",
                    evidence=f"目标风格标记词出现{matches}次，冲突风格标记词出现多次",
                    suggestion=f"建议增加'{target_style}'风格特征词汇，减少其他风格标记",
                ))
            else:
                violations.append(ConstraintViolation(
                    rule_id="style_weak",
                    law_type=LawType.OUTLINE_LAW,
                    severity=Severity.LOW,
                    message=f"文风'{target_style}'特征不明显，标记词出现较少",
                    evidence=f"目标风格标记词出现{matches}次",
                    suggestion=f"建议增加'{target_style}'风格特征词汇",
                ))

        return violations

    def _check_ai_cliches(self, content: str) -> list[ConstraintViolation]:
        """Detect overused AI-generated phrases and cliches."""
        violations: list[ConstraintViolation] = []
        if not content:
            return violations

        found_cliches: list[tuple[str, str]] = []
        for cliche in AI_CLICHES:
            for match in re.finditer(re.escape(cliche), content):
                start = max(0, match.start() - 15)
                end = min(len(content), match.end() + 15)
                evidence = content[start:end].replace("\n", " ")
                found_cliches.append((cliche, evidence))

        if found_cliches:
            # Group by cliche phrase
            cliche_counts: dict[str, int] = {}
            for cliche, _ in found_cliches:
                cliche_counts[cliche] = cliche_counts.get(cliche, 0) + 1

            top_cliches = sorted(cliche_counts.items(), key=lambda x: x[1], reverse=True)[:5]
            cliche_list = ", ".join([f"'{c}'({n}次)" for c, n in top_cliches])

            violations.append(ConstraintViolation(
                rule_id="ai_cliches",
                law_type=LawType.OUTLINE_LAW,
                severity=Severity.LOW,
                message=f"检测到{len(found_cliches)}处AI常见套话/陈词",
                evidence=found_cliches[0][1] if found_cliches else "",
                suggestion=f"建议替换以下套话，增强原创性: {cliche_list}",
            ))

        # Detect repetitive sentence patterns (common AI artifact)
        repetitive_patterns = self._detect_repetitive_patterns(content)
        if repetitive_patterns:
            violations.append(ConstraintViolation(
                rule_id="repetitive_patterns",
                law_type=LawType.OUTLINE_LAW,
                severity=Severity.LOW,
                message=f"检测到{len(repetitive_patterns)}种重复句式模式",
                evidence=repetitive_patterns[0][:50] if repetitive_patterns else "",
                suggestion="建议调整句式结构，避免连续使用相同句式开头",
            ))

        return violations

    def _detect_repetitive_patterns(self, content: str) -> list[str]:
        """Detect repetitive sentence-starting patterns."""
        # Split into sentences
        sentences = re.split(r'[。！？\n]+', content)
        patterns: dict[str, int] = {}

        for sentence in sentences:
            sentence = sentence.strip()
            if len(sentence) < 4:
                continue
            # Extract first 2-3 characters as pattern
            start = sentence[:3]
            if len(start) >= 2:
                patterns[start] = patterns.get(start, 0) + 1

        # Find patterns that appear too frequently
        repetitive = []
        for pattern, count in patterns.items():
            if count >= 5:  # Same start pattern 5+ times
                repetitive.append(f"'{pattern}'开头出现{count}次")

        return repetitive[:3]

    def _check_length(
        self,
        content: str,
        target_word_count: int,
    ) -> list[ConstraintViolation]:
        """Check if content length matches target word count."""
        violations: list[ConstraintViolation] = []
        if not content:
            return violations

        # Count Chinese characters + English words
        chinese_chars = len(re.findall(r'[\u4e00-\u9fff]', content))
        english_words = len(re.findall(r'[a-zA-Z]+', content))
        total_words = chinese_chars + english_words

        deviation = abs(total_words - target_word_count)
        deviation_ratio = deviation / target_word_count if target_word_count > 0 else 0

        if deviation_ratio > 0.5:
            severity = Severity.HIGH
            message = f"字数严重偏离目标: 实际{total_words}字，目标{target_word_count}字"
        elif deviation_ratio > 0.2:
            severity = Severity.MEDIUM
            message = f"字数偏离目标: 实际{total_words}字，目标{target_word_count}字"
        elif deviation_ratio > 0.1:
            severity = Severity.LOW
            message = f"字数略有偏离: 实际{total_words}字，目标{target_word_count}字"
        else:
            return violations

        violations.append(ConstraintViolation(
            rule_id="word_count_mismatch",
            law_type=LawType.OUTLINE_LAW,
            severity=severity,
            message=message,
            evidence=f"中文字符: {chinese_chars}, 英文词: {english_words}",
            suggestion=f"调整内容长度至目标{target_word_count}字左右",
        ))

        return violations

    def _check_human_ai_ratio(
        self,
        content: str,
        target_ratio: float,
    ) -> list[ConstraintViolation]:
        """Check content for indicators of AI-generated text vs human-written.

        Note: This is a heuristic check. True ratio tracking requires
        editor-level integration to distinguish human-written vs AI-generated
        paragraphs. Here we check for AI-typical patterns as a proxy.
        """
        violations: list[ConstraintViolation] = []
        if not content or target_ratio >= 1.0:
            return violations

        # AI indicators
        ai_indicators = 0

        # 1. Overuse of transition words
        transition_words = ["然而", "但是", "因此", "于是", "接着", "随后", "然后", "突然"]
        for word in transition_words:
            ai_indicators += content.count(word)

        # 2. Overly descriptive adjective stacks
        adj_stack_pattern = r'[一-龥]{1,2}的[一-龥]{1,2}的[一-龥]{1,2}的'
        adj_stacks = len(re.findall(adj_stack_pattern, content))
        ai_indicators += adj_stacks * 2

        # 3. Excessive use of "的"
        de_count = content.count("的")
        de_ratio = de_count / len(content) if content else 0
        if de_ratio > 0.08:  # More than 8% "的" is suspicious
            ai_indicators += int((de_ratio - 0.08) * 100)

        # 4. Sentence length uniformity (AI tends toward uniform lengths)
        sentences = re.split(r'[。！？]+', content)
        lengths = [len(s.strip()) for s in sentences if len(s.strip()) > 5]
        if len(lengths) > 5:
            avg_len = sum(lengths) / len(lengths)
            variance = sum((l - avg_len) ** 2 for l in lengths) / len(lengths)
            if variance < 50:  # Very uniform sentence lengths
                ai_indicators += 5

        # Score the AI-ness
        content_length = len(content)
        if content_length > 0:
            ai_score = min(100, (ai_indicators / (content_length / 100)) * 10)
        else:
            ai_score = 0

        # If target ratio is high (human-heavy) but content looks very AI
        if target_ratio > 0.7 and ai_score > 60:
            violations.append(ConstraintViolation(
                rule_id="human_ai_ratio",
                law_type=LawType.OUTLINE_LAW,
                severity=Severity.MEDIUM,
                message=f"内容AI特征明显（AI指数: {ai_score:.0f}/100），但目标人机比例为{target_ratio:.0%}人类主导",
                evidence=f"检测到过渡词滥用、句式单一等AI典型特征",
                suggestion="建议增加个人化表达，减少套话和模板化句式",
            ))
        elif target_ratio < 0.3 and ai_score < 30:
            violations.append(ConstraintViolation(
                rule_id="human_ai_ratio",
                law_type=LawType.OUTLINE_LAW,
                severity=Severity.LOW,
                message=f"内容人类特征明显（AI指数: {ai_score:.0f}/100），但目标人机比例为{target_ratio:.0%}AI主导",
                evidence="内容个性化程度高",
                suggestion="如需要更多AI生成内容，可减少个性化表达",
            ))

        return violations

    def get_style_suggestions(self, content: str, target_style: str) -> list[str]:
        """Get style improvement suggestions without flagging violations.

        Returns constructive suggestions for improving style match.
        """
        suggestions: list[str] = []

        if target_style == "default" or not content:
            return suggestions

        markers = STYLE_MARKERS.get(target_style, [])
        if not markers:
            return suggestions

        found = [m for m in markers if m in content]
        missing = [m for m in markers if m not in content]

        if missing:
            suggestions.append(
                f"'{target_style}'风格建议: 可尝试使用以下特征词汇: {', '.join(missing[:5])}"
            )

        if len(found) < 3:
            suggestions.append(
                f"当前'{target_style}'风格标记词较少({len(found)}个)，建议增加风格化描写"
            )

        return suggestions
