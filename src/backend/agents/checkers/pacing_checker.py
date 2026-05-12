"""Pacing checker for strand ratios (Quest 60%, Fire 20%, Constellation 20%).

quick_scan: Heuristic check for obvious pacing issues.
deep_analyze: AI-powered analysis for strand ratio balance.
"""

from __future__ import annotations

import json
import re
from typing import Any

from .base import BaseChecker, CheckerResult
from backend.core.services.ai.ai_service import AIService
from backend.config import settings
from ..utils import MiniMaxAPIClient


class PacingChecker(BaseChecker):
    """Checks narrative pacing and strand ratios."""

    STRAND_RATIOS = {
        "quest": 0.60,
        "fire": 0.20,
        "constellation": 0.20,
    }

    # Keywords for each strand type
    QUEST_KEYWORDS = [
        "任务", "目标", "寻找", "探索", "挑战", "战斗", "修炼", "突破",
        "升级", "进阶", "试炼", "冒险", "旅程", "前进", "征服", "战胜",
    ]
    FIRE_KEYWORDS = [
        "感情", "爱情", "心动", "温柔", "拥抱", "亲吻", "思念", "牵挂",
        "情", "爱", "喜欢", "感动", "泪", "心痛", "心跳", "脸红",
    ]
    CONSTELLATION_KEYWORDS = [
        "命运", "宿命", "预言", "天意", "因果", "轮回", "星辰", "天机",
        "缘", "劫", "造化", "天道", "气运", "命数", "注定", "命格",
    ]

    def __init__(self, ai_service: AIService | None = None) -> None:
        super().__init__(
            name="pacing",
            description="检查叙事节奏和故事线比例（任务线60%/燃情线20%/星座线20%）",
        )
        self._ai_service = ai_service
        self._api_client = MiniMaxAPIClient(ai_service) if ai_service else None

    async def quick_scan(self, content: str) -> CheckerResult:
        """Heuristic scan for obvious pacing issues.

        Detects:
        - Strand ratio imbalance via keyword density
        - Chapter length anomalies
        - Tension curve issues
        """
        issues: list[dict[str, Any]] = []
        suggestions: list[str] = []
        score = 100

        text = content or ""
        if not text:
            return CheckerResult(score=100, issues=[], suggestions=[])

        # 1. Strand keyword density analysis
        quest_count = sum(1 for kw in self.QUEST_KEYWORDS if kw in text)
        fire_count = sum(1 for kw in self.FIRE_KEYWORDS if kw in text)
        constellation_count = sum(1 for kw in self.CONSTELLATION_KEYWORDS if kw in text)

        total = quest_count + fire_count + constellation_count
        if total > 0:
            quest_ratio = quest_count / total
            fire_ratio = fire_count / total
            constellation_ratio = constellation_count / total

            # Check for severe imbalance (>30% deviation from target)
            if quest_ratio < 0.30:
                issues.append({
                    "type": "strand_imbalance",
                    "severity": "medium",
                    "message": f"任务线比例偏低: {quest_ratio:.0%}（目标60%）",
                })
                suggestions.append("增加主线任务推进、修炼突破等情节")
                score -= 10

            if fire_ratio > 0.45:
                issues.append({
                    "type": "strand_imbalance",
                    "severity": "medium",
                    "message": f"燃情线比例偏高: {fire_ratio:.0%}（目标20%）",
                })
                suggestions.append("适当减少感情戏份，增加主线推进")
                score -= 8

            if constellation_ratio > 0.45:
                issues.append({
                    "type": "strand_imbalance",
                    "severity": "medium",
                    "message": f"星座线比例偏高: {constellation_ratio:.0%}（目标20%）",
                })
                suggestions.append("减少宿命/天道相关描写，增加实际情节推进")
                score -= 8

        # 2. Chapter length check
        char_count = len(text)
        if char_count < 500:
            issues.append({
                "type": "chapter_too_short",
                "severity": "high",
                "message": f"章节过短: {char_count}字（建议2000字以上）",
            })
            suggestions.append("章节内容过短，建议扩充情节")
            score -= 20
        elif char_count > 15000:
            issues.append({
                "type": "chapter_too_long",
                "severity": "low",
                "message": f"章节过长: {char_count}字（建议10000字以内）",
            })
            suggestions.append("章节内容过长，建议拆分为多章")
            score -= 5

        # 3. Dialogue density check (pacing indicator)
        dialogue_markers = len(re.findall(r'["""]["'']', text))
        if char_count > 1000:
            dialogue_ratio = dialogue_markers * 20 / char_count  # rough estimate
            if dialogue_ratio > 0.6:
                issues.append({
                    "type": "excessive_dialogue",
                    "severity": "medium",
                    "message": "对话比例过高，可能影响叙事节奏",
                })
                suggestions.append("增加叙述和描写，平衡对话与叙事比例")
                score -= 8
            elif dialogue_ratio < 0.05 and char_count > 2000:
                issues.append({
                    "type": "insufficient_dialogue",
                    "severity": "medium",
                    "message": "对话比例过低，可能影响阅读节奏",
                })
                suggestions.append("适当增加角色对话，提升节奏感")
                score -= 5

        # 4. Paragraph length check (monotony indicator)
        paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        if paragraphs:
            avg_len = sum(len(p) for p in paragraphs) / len(paragraphs)
            if avg_len > 500:
                issues.append({
                    "type": "monotonous_paragraphs",
                    "severity": "low",
                    "message": f"段落平均长度过大: {avg_len:.0f}字，可能造成阅读疲劳",
                })
                suggestions.append("适当拆分长段落，增加段落节奏变化")
                score -= 5

        score = max(0, score)
        return CheckerResult(score=score, issues=issues, suggestions=suggestions)

    async def deep_analyze(
        self, content: str, context: dict[str, Any]
    ) -> CheckerResult:
        """Deep AI analysis for strand ratio balance.

        Args:
            content: Chapter text to analyze.
            context: Optional context including genre, target_word_count, previous_chapters.
        """
        if not self._api_client:
            return CheckerResult(
                score=0,
                issues=[{
                    "type": "configuration_error",
                    "message": "PacingChecker 未配置 AI 服务",
                }],
                suggestions=["请在初始化时传入 ai_service 参数"],
            )

        genre = context.get("genre", "")
        previous_chapters = context.get("previous_chapters", [])
        prev_text = (
            previous_chapters if isinstance(previous_chapters, str)
            else json.dumps(previous_chapters, ensure_ascii=False, indent=2)
        )

        prompt = f"""请深度分析以下章节的叙事节奏和故事线比例。

【章节内容】
{content}

【类型/风格】
{genre}

【前文摘要】
{prev_text}

故事线理想比例：
- 任务线（Quest）: 60% — 主线任务推进、修炼突破、冒险挑战
- 燃情线（Fire）: 20% — 感情戏、人际关系、情感发展
- 星座线（Constellation）: 20% — 宿命、伏笔、世界观揭示

请从以下维度分析：
1. **故事线比例**：三种故事线的实际比例是否接近理想值
2. **节奏张弛**：紧张与舒缓交替是否合理，是否有节奏单调的问题
3. **信息密度**：每段落的信息量是否适中，是否有信息过载或过稀
4. **场景转换**：场景切换是否自然流畅
5. **章节结尾**：结尾是否有足够的悬念或钩子引导读者继续阅读
6. **阅读体验**：整体阅读节奏是否流畅，是否有拖沓或仓促感

请以JSON格式返回：
{{
    "score": 0-100的评分,
    "strand_ratios": {{
        "quest": 实际比例,
        "fire": 实际比例,
        "constellation": 实际比例
    }},
    "issues": [
        {{
            "type": "问题类型",
            "severity": "critical|high|medium|low",
            "message": "问题描述",
            "evidence": "正文中的证据片段"
        }}
    ],
    "suggestions": ["改进建议列表"]
}}"""

        system_prompt = (
            "你是一位专业的叙事节奏分析专家。你的任务是评估小说章节的节奏感和故事线比例。"
            "理想的任务线/燃情线/星座线比例为60%/20%/20%。"
            "评分标准：100=节奏完美，80=节奏良好，60=节奏一般，40=节奏较差，20=节奏失衡，0=完全无节奏感。"
        )

        try:
            ai_result = await self._api_client.call(
                system_prompt=system_prompt,
                user_content=prompt,
                temperature=settings.ai_temperature,
            )

            try:
                parsed = json.loads(ai_result)
                return CheckerResult(
                    score=parsed.get("score", 70),
                    issues=parsed.get("issues", []),
                    suggestions=parsed.get("suggestions", []),
                )
            except json.JSONDecodeError:
                return CheckerResult(
                    score=70,
                    issues=[{
                        "type": "parse_error",
                        "severity": "low",
                        "message": f"AI返回格式错误，原始响应: {ai_result[:200]}",
                    }],
                    suggestions=["请重试深度分析"],
                )

        except Exception as e:
            return CheckerResult(
                score=0,
                issues=[{
                    "type": "analysis_error",
                    "severity": "critical",
                    "message": f"节奏检查分析失败: {str(e)}",
                }],
                suggestions=["请检查AI服务配置或稍后重试"],
            )
