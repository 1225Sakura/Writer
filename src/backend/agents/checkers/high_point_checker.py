"""High point checker for excitement and excitement density.

quick_scan: Heuristic check for obvious high point / excitement patterns.
deep_analyze: AI-powered analysis for high point placement and intensity.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

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

_HIGH_POINT_PROMPTS = _load_prompts("high_point_checker")


class HighPointChecker(BaseChecker):
    """Checks excitement/excitement density in chapters."""

    # Keywords indicating high-point moments
    CLIMAX_KEYWORDS = [
        "爆发", "释放", "突破", "觉醒", "领悟", "顿悟", "逆转", "反转",
        "震惊", "惊骇", "骇然", "大惊", "不敢相信", "难以置信",
    ]
    TENSION_KEYWORDS = [
        "紧张", "危险", "生死", "千钧一发", "命悬一线", "岌岌可危",
        "紧迫", "焦急", "屏息", "窒息", "心跳加速", "汗流浃背",
    ]
    CONFLICT_KEYWORDS = [
        "战斗", "对决", "交锋", "激战", "厮杀", "拼杀", "搏斗",
        "大战", "交手", "过招", "比拼", "较量", "决战",
    ]
    REVEAL_KEYWORDS = [
        "真相", "秘密", "揭露", "揭穿", "揭开", "发现", "原来",
        "竟然", "居然", "没想到", "始料未及", "出乎意料",
    ]

    def __init__(self, ai_service: AIService | None = None, weight: float = 1.0) -> None:
        super().__init__(
            name="high_point",
            description="检查章节兴奋点/高潮密度（战斗、冲突、揭示、逆转等）",
            weight=weight,
        )
        self._ai_service = ai_service
        self._api_client = MiniMaxAPIClient(ai_service) if ai_service else None

    async def quick_scan(self, content: str) -> CheckerResult:
        """Heuristic scan for obvious high point patterns.

        Detects:
        - Excitement keywords clustering
        - Tension building signals
        - Dramatic reveal markers
        """
        issues: list[dict[str, Any]] = []
        suggestions: list[str] = []
        score = 100

        text = content or ""
        if not text:
            return CheckerResult(score=100, issues=[], suggestions=[])

        char_count = len(text)

        # Count keyword hits per category
        climax_hits = sum(1 for kw in self.CLIMAX_KEYWORDS if kw in text)
        tension_hits = sum(1 for kw in self.TENSION_KEYWORDS if kw in text)
        conflict_hits = sum(1 for kw in self.CONFLICT_KEYWORDS if kw in text)
        reveal_hits = sum(1 for kw in self.REVEAL_KEYWORDS if kw in text)

        total_hits = climax_hits + tension_hits + conflict_hits + reveal_hits

        # Density check (hits per 1000 chars)
        if char_count > 500:
            density = total_hits / (char_count / 1000)

            if density < 0.5:
                issues.append({
                    "type": "low_excitement_density",
                    "severity": "medium",
                    "message": f"兴奋点密度过低: {density:.1f}/千字，章节可能缺乏高潮",
                })
                suggestions.append("增加战斗、揭示或逆转等高潮情节")
                score -= 15
            elif density > 8.0:
                issues.append({
                    "type": "high_excitement_density",
                    "severity": "low",
                    "message": f"兴奋点密度过高: {density:.1f}/千字，可能造成审美疲劳",
                })
                suggestions.append("适当增加过渡和铺垫，让高潮更有冲击力")
                score -= 5

        # Check for climax distribution (should not all be in one section)
        if char_count > 2000:
            third = char_count // 3
            first_third = text[:third]
            mid_third = text[third:2*third]
            last_third = text[2*third:]

            sections = [("开头", first_third), ("中段", mid_third), ("结尾", last_third)]
            sections_with_climax = 0
            for _, section in sections:
                section_hits = sum(1 for kw in self.CLIMAX_KEYWORDS + self.TENSION_KEYWORDS if kw in section)
                if section_hits > 0:
                    sections_with_climax += 1

            if sections_with_climax == 0:
                issues.append({
                    "type": "no_high_points",
                    "severity": "high",
                    "message": "章节缺乏明显的高潮或兴奋点",
                })
                suggestions.append("至少在章节结尾设置一个高潮或悬念")
                score -= 20
            elif sections_with_climax == 1:
                issues.append({
                    "type": "concentrated_high_points",
                    "severity": "low",
                    "message": "高潮点集中在单一区域，节奏可能不均衡",
                })
                suggestions.append("考虑在章节不同位置设置小高潮，增加节奏变化")
                score -= 5

        # Ending cliffhanger check
        last_200 = text[-200:] if len(text) > 200 else text
        cliffhanger_patterns = [
            r"(?:突然|忽然|骤然)", r"(?:……|…|\.{3})",
            r"(?:难道|莫非|难道说)", r"(?:没想到|始料未及)",
            r"(?:竟然|居然|竟是)", r"(?:目光一凝|瞳孔一缩|脸色一变)",
        ]
        has_cliffhanger = any(re.search(p, last_200) for p in cliffhanger_patterns)
        if not has_cliffhanger and char_count > 1000:
            issues.append({
                "type": "weak_ending",
                "severity": "medium",
                "message": "章节结尾缺乏悬念钩子",
            })
            suggestions.append("在章节结尾设置悬念，激发读者继续阅读的欲望")
            score -= 10

        score = max(0, score)
        return CheckerResult(score=score, issues=issues, suggestions=suggestions)

    async def deep_analyze(
        self, content: str, context: dict[str, Any]
    ) -> CheckerResult:
        """Deep AI analysis for high point placement and intensity.

        Args:
            content: Chapter text to analyze.
            context: Optional context including genre, target_audience, previous_chapters.
        """
        if not self._api_client:
            return CheckerResult(
                score=0,
                issues=[{
                    "type": "configuration_error",
                    "message": "HighPointChecker 未配置 AI 服务",
                }],
                suggestions=["请在初始化时传入 ai_service 参数"],
            )

        genre = context.get("genre", "")
        previous_chapters = context.get("previous_chapters", [])
        prev_text = (
            previous_chapters if isinstance(previous_chapters, str)
            else json.dumps(previous_chapters, ensure_ascii=False, indent=2)
        )

        prompt = _HIGH_POINT_PROMPTS["deep_analysis_prompt"].format(
            content=content, genre=genre, prev_text=prev_text
        )

        system_prompt = _HIGH_POINT_PROMPTS["deep_analysis_system_prompt"]

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

        except (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException, ValueError) as e:
            return CheckerResult(
                score=0,
                issues=[{
                    "type": "analysis_error",
                    "severity": "critical",
                    "message": f"高潮检查分析失败: {str(e)}",
                }],
                suggestions=["请检查AI服务配置或稍后重试"],
            )
