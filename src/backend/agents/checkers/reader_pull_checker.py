"""Reader pull checker for hooks and reader engagement.

quick_scan: Heuristic check for obvious hook patterns.
deep_analyze: AI-powered analysis for reader engagement effectiveness.
"""

from __future__ import annotations

import json
import re
from typing import Any

from .base import BaseChecker, CheckerResult
from backend.core.services.ai.ai_service import AIService
from backend.config import settings
from ..utils import MiniMaxAPIClient

import yaml
from pathlib import Path

_PROMPTS_DIR = Path(__file__).parent.parent / "prompts"

def _load_prompts(name: str) -> dict:
    path = _PROMPTS_DIR / f"{name}.yaml"
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

_READER_PULL_PROMPTS = _load_prompts("reader_pull_checker")


class ReaderPullChecker(BaseChecker):
    """Checks hooks and reader engagement."""

    def __init__(self, ai_service: AIService | None = None) -> None:
        super().__init__(
            name="reader_pull",
            description="检查读者吸引力/钩子效果（开篇钩子、结尾悬念、冲突设置等）",
        )
        self._ai_service = ai_service
        self._api_client = MiniMaxAPIClient(ai_service) if ai_service else None

    async def quick_scan(self, content: str) -> CheckerResult:
        """Heuristic scan for obvious hook patterns.

        Detects:
        - Opening hook patterns
        - Ending cliffhanger signals
        - Conflict setup markers
        - Mystery/suspense elements
        """
        issues: list[dict[str, Any]] = []
        suggestions: list[str] = []
        score = 100

        text = content or ""
        if not text:
            return CheckerResult(score=100, issues=[], suggestions=[])

        char_count = len(text)

        # 1. Opening hook check (first 300 chars)
        opening = text[:300] if len(text) > 300 else text
        hook_patterns = [
            r"(?:突然|忽然|骤然|猛然)",  # Sudden event
            r"(?:死|杀|血|危险|恐惧)",  # Danger/thrill
            r"(?:秘密|真相|谎言|隐瞒)",  # Mystery
            r'(?:[“”「」][^“”「」]{5,30}[“”「」])',  # Dialogue opening
            r"(?:一声|一道|一阵|一个)",  # Dramatic entry
            r"(?:如果|假设|倘若|假如)",  # Hypothetical hook
            r"(?:多年后|多年以前|那一天|那一刻)",  # Time jump
        ]
        has_opening_hook = any(re.search(p, opening) for p in hook_patterns)
        if not has_opening_hook and char_count > 500:
            issues.append({
                "type": "weak_opening_hook",
                "severity": "high",
                "message": "开篇缺乏吸引读者的钩子",
            })
            suggestions.append("在章节开头设置悬念、冲突或引人注目的场景")
            score -= 15

        # 2. Ending cliffhanger check (last 300 chars)
        ending = text[-300:] if len(text) > 300 else text
        cliffhanger_patterns = [
            r"(?:突然|忽然|骤然|猛然)",
            r"(?:……|…|\.{3})",  # Ellipsis
            r"(?:难道|莫非|难道说)",  # Suspicion
            r"(?:没想到|始料未及|出乎意料)",  # Surprise
            r"(?:竟然|居然|竟是|竟是)",  # Unexpected
            r"(?:目光一凝|瞳孔一缩|脸色一变|身体一僵)",  # Physical reaction
            r"(?:下一刻|下一秒|就在这时|就在此时)",  # Transition hook
            r"(?:惊恐|震惊|大惊失色|面无人色)",  # Shock
        ]
        has_ending_hook = any(re.search(p, ending) for p in cliffhanger_patterns)
        if not has_ending_hook and char_count > 500:
            issues.append({
                "type": "weak_ending_hook",
                "severity": "high",
                "message": "章节结尾缺乏悬念钩子",
            })
            suggestions.append("在章节结尾设置悬念或认知差，激发读者继续阅读")
            score -= 15

        # 3. Mystery/suspense elements check
        mystery_keywords = [
            "秘密", "真相", "谜", "未知", "隐藏", "隐瞒", "欺骗",
            "假象", "伪装", "幕后", "阴谋", "陷阱", "圈套",
        ]
        mystery_count = sum(1 for kw in mystery_keywords if kw in text)
        if mystery_count == 0 and char_count > 2000:
            issues.append({
                "type": "no_mystery_elements",
                "severity": "medium",
                "message": "章节缺乏悬念或谜团元素",
            })
            suggestions.append("适当设置悬念或认知差，保持读者好奇心")
            score -= 8

        # 4. Conflict presence check
        conflict_keywords = [
            "冲突", "矛盾", "争执", "争论", "对峙", "对抗",
            "威胁", "危险", "危机", "困境", "绝境", "险境",
        ]
        conflict_count = sum(1 for kw in conflict_keywords if kw in text)
        if conflict_count == 0 and char_count > 2000:
            issues.append({
                "type": "no_conflict",
                "severity": "medium",
                "message": "章节缺乏冲突或对抗元素",
            })
            suggestions.append("增加角色冲突或外部威胁，提升读者紧张感")
            score -= 8

        # 5. Cognitive gap / information asymmetry check
        cognitive_gap_patterns = [
            r"(?:只有|唯有|仅仅).{0,10}(?:知道|明白|清楚|了解)",
            r"(?:不知道|不清楚|不明白|不了解).{0,15}(?:其实|实际上|事实上)",
            r"(?:背后|暗中|私下|偷偷)",
            r"(?:瞒着|欺骗|隐瞒|蒙在鼓里)",
        ]
        has_cognitive_gap = any(re.search(p, text) for p in cognitive_gap_patterns)
        if not has_cognitive_gap and char_count > 2000:
            issues.append({
                "type": "no_cognitive_gap",
                "severity": "low",
                "message": "缺乏信息不对称或认知差元素",
            })
            suggestions.append("适当设置角色间的信息差，增加读者的优越感或好奇心")
            score -= 5

        score = max(0, score)
        return CheckerResult(score=score, issues=issues, suggestions=suggestions)

    async def deep_analyze(
        self, content: str, context: dict[str, Any]
    ) -> CheckerResult:
        """Deep AI analysis for reader engagement effectiveness.

        Args:
            content: Chapter text to analyze.
            context: Optional context including genre, target_audience, next_chapter_preview.
        """
        if not self._api_client:
            return CheckerResult(
                score=0,
                issues=[{
                    "type": "configuration_error",
                    "message": "ReaderPullChecker 未配置 AI 服务",
                }],
                suggestions=["请在初始化时传入 ai_service 参数"],
            )

        genre = context.get("genre", "")
        next_chapter_preview = context.get("next_chapter_preview", "")
        previous_chapters = context.get("previous_chapters", [])
        prev_text = (
            previous_chapters if isinstance(previous_chapters, str)
            else json.dumps(previous_chapters, ensure_ascii=False, indent=2)
        )

        prompt = _READER_PULL_PROMPTS["deep_analysis_prompt"].format(
            content=content, genre=genre, prev_text=prev_text,
            next_chapter_preview=next_chapter_preview or "无"
        )

        system_prompt = _READER_PULL_PROMPTS["deep_analysis_system_prompt"]

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
                    "message": f"读者吸引力检查分析失败: {str(e)}",
                }],
                suggestions=["请检查AI服务配置或稍后重试"],
            )
