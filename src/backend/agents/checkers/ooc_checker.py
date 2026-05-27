"""OOC (Out Of Character) checker for character behavior consistency.

quick_scan: Heuristic check for obvious character behavior inconsistencies.
deep_analyze: AI-powered analysis for subtle OOC violations.
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

_OOC_PROMPTS = _load_prompts("ooc_checker")


class OOCChecker(BaseChecker):
    """Checks if characters act consistently with their personality."""

    def __init__(self, ai_service: AIService | None = None, weight: float = 1.0) -> None:
        super().__init__(
            name="ooc",
            description="检查角色行为一致性（Out Of Character违规）",
            weight=weight,
        )
        self._ai_service = ai_service
        self._api_client = MiniMaxAPIClient(ai_service) if ai_service else None

    async def quick_scan(self, content: str) -> CheckerResult:
        """Heuristic scan for obvious OOC signals.

        Detects:
        - Personality shift markers
        - Emotional contradictions
        - Speech pattern breaks
        """
        issues: list[dict[str, Any]] = []
        suggestions: list[str] = []
        score = 100

        text = content or ""

        # 1. Personality shift markers
        personality_shift_patterns = [
            (r"突然变得.{2,10}(?:起来|了)", "personality_shift", "检测到突然性格转变"),
            (r"竟然.{2,15}(?:笑了|哭了|怒了|沉默了)", "behavior_surprise", "检测到意外情绪反应"),
            (r"不像(?:他|她|其).{0,6}(?:作风|风格|性格|为人)", "ooc_explicit", "文中明确提到角色行为反常"),
            (r"(?:一反常态|出人意料|反常地|不像平时)", "ooc_marker", "检测到反常行为标记"),
        ]
        for pattern, issue_type, desc in personality_shift_patterns:
            matches = re.findall(pattern, text)
            if matches:
                issues.append({
                    "type": issue_type,
                    "severity": "medium",
                    "message": f"{desc}: {matches[:3]}",
                })
                score -= 10

        # 2. Emotional contradiction patterns
        emotion_contradictions = [
            (r"(?:刚|刚才).{0,10}(?:开心|高兴|大笑).{0,10}(?:立刻|马上|随即).{0,10}(?:悲伤|痛哭|落泪)", "emotion_flip", "短时间内情绪剧烈反转"),
            (r"(?:刚|刚才).{0,10}(?:愤怒|暴怒).{0,10}(?:立刻|马上|随即).{0,10}(?:平静|冷静|淡然)", "emotion_flip", "短时间内情绪剧烈反转"),
        ]
        for pattern, issue_type, desc in emotion_contradictions:
            if re.search(pattern, text):
                issues.append({
                    "type": issue_type,
                    "severity": "medium",
                    "message": desc,
                })
                suggestions.append("情绪转变应有过渡描写，避免突兀")
                score -= 12

        # 3. Speech pattern inconsistency indicators
        speech_issues = [
            (r"(?:平时|一向|素来).{0,10}(?:沉默寡言|少言|不善言辞).{0,15}(?:滔滔不绝|说个不停|絮絮叨叨)", "speech_break", "角色说话模式与设定矛盾"),
            (r"(?:平时|一向|素来).{0,10}(?:健谈|话多|能说会道).{0,15}(?:一言不发|沉默不语|闭口不言)", "speech_break", "角色说话模式与设定矛盾"),
        ]
        for pattern, issue_type, desc in speech_issues:
            if re.search(pattern, text):
                issues.append({
                    "type": issue_type,
                    "severity": "high",
                    "message": desc,
                })
                suggestions.append("角色语言风格应与人物设定保持一致")
                score -= 15

        score = max(0, score)
        return CheckerResult(score=score, issues=issues, suggestions=suggestions)

    async def deep_analyze(
        self, content: str, context: dict[str, Any]
    ) -> CheckerResult:
        """Deep AI analysis for subtle OOC violations.

        Args:
            content: Chapter text to analyze.
            context: Must contain 'characters' (list of character profiles with personality).
        """
        if not self._api_client:
            return CheckerResult(
                score=0,
                issues=[{
                    "type": "configuration_error",
                    "message": "OOCChecker 未配置 AI 服务",
                }],
                suggestions=["请在初始化时传入 ai_service 参数"],
            )

        characters = context.get("characters", [])
        chars_text = (
            characters if isinstance(characters, str)
            else json.dumps(characters, ensure_ascii=False, indent=2)
        )

        prompt = _OOC_PROMPTS["deep_analysis_prompt"].format(
            content=content, chars_text=chars_text
        )

        system_prompt = _OOC_PROMPTS["deep_analysis_system_prompt"]

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
                    "message": f"OOC检查分析失败: {str(e)}",
                }],
                suggestions=["请检查AI服务配置或稍后重试"],
            )
