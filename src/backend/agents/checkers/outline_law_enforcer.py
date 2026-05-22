"""Outline Law Enforcer - checks for violations of outline-critical rules.

quick_scan: Detects obvious outline violations via keyword matching
            (e.g. outline says character X must not die, but text says they died).
deep_analyze: Uses AI to detect implicit violations of outline spirit
              (e.g. outline requires dark tone, but text is too lighthearted).
"""

from __future__ import annotations

import json
import re
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

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

_OUTLINE_LAW_PROMPTS = _load_prompts("outline_law_enforcer")


class OutlineLawEnforcer(BaseChecker):
    """Enforces outline laws: checks that chapter content respects
    outline-critical constraints such as character survival, plot
    direction, and tonal requirements.
    """

    def __init__(self, ai_service: AIService | None = None) -> None:
        super().__init__(
            name="outline_law",
            description="检查正文是否违反大纲关键设定（角色生死、剧情走向、风格基调等）",
        )
        self._ai_service = ai_service
        self._api_client = MiniMaxAPIClient(ai_service) if ai_service else None

    # ------------------------------------------------------------------
    # quick_scan – heuristic / keyword based
    # ------------------------------------------------------------------

    async def quick_scan(self, content: str) -> CheckerResult:
        """Heuristic scan for obvious outline violations.

        Detects:
        - Character death keywords when outline prohibits it
        - Major plot deviation signals
        - Tone mismatch keywords
        """
        issues: list[dict[str, Any]] = []
        suggestions: list[str] = []
        score = 100

        text = content or ""

        # 1. Character death detection
        death_keywords = [
            "死了", "死亡", "陨落", "牺牲", "阵亡", "毙命",
            "离世", "去世", "断气", "身亡", "殒命",
        ]
        death_patterns = [
            r"(.{1,10}?)\s*(?:死了|死亡|陨落|牺牲|阵亡)",
            r"(.{1,10}?)\s*的\s*(?:尸体|遗体|尸身)",
        ]

        found_deaths = []
        for kw in death_keywords:
            if kw in text:
                # Extract surrounding context
                for m in re.finditer(re.escape(kw), text):
                    start = max(0, m.start() - 20)
                    end = min(len(text), m.end() + 20)
                    ctx = text[start:end].replace("\n", " ")
                    found_deaths.append({"keyword": kw, "context": ctx})

        if found_deaths:
            issues.append({
                "type": "potential_death",
                "severity": "high",
                "message": f"检测到 {len(found_deaths)} 处可能的角色死亡描述",
                "details": found_deaths[:5],  # limit details
            })
            suggestions.append("请确认这些死亡描写是否符合大纲设定（大纲中禁止死亡的角色不应出现死亡描写）")
            score -= min(30, len(found_deaths) * 10)

        # 2. Plot deviation signals
        deviation_signals = [
            "突然", "莫名其妙", "毫无征兆", "毫无理由",
            "完全变了", "彻底改", "推翻", "否定",
        ]
        found_deviations = []
        for sig in deviation_signals:
            if sig in text:
                found_deviations.append(sig)

        if found_deviations:
            issues.append({
                "type": "plot_deviation_signal",
                "severity": "medium",
                "message": f"检测到剧情突变信号词: {', '.join(found_deviations)}",
            })
            suggestions.append("剧情突变应有充分铺垫，请确认是否符合大纲规划")
            score -= min(15, len(found_deviations) * 5)

        # 3. Tone mismatch detection (dark vs light)
        dark_tone_markers = ["黑暗", "绝望", "残酷", "血腥", "阴郁", "压抑"]
        light_tone_markers = ["轻松", "搞笑", "欢乐", "愉快", "温馨", "甜蜜"]

        dark_count = sum(1 for m in dark_tone_markers if m in text)
        light_count = sum(1 for m in light_tone_markers if m in text)

        if dark_count > 3 and light_count > 3:
            issues.append({
                "type": "tone_inconsistency",
                "severity": "low",
                "message": "同一段落中同时出现大量黑暗与轻松基调词汇，可能存在风格不统一",
            })
            suggestions.append("建议统一章节基调，避免在同一段落中频繁切换极端风格")
            score -= 10

        # 4. Outline keyword guardrails
        # Check for explicit outline constraint violations mentioned in text
        guardrail_violations = []
        guardrail_patterns = [
            (r"(?:大纲|设定).*?(?:不能|禁止|不得).*?(.{2,20}).*?\n*.*?\1", "违反明确约束"),
            (r"(?:违反|违背).*?(?:大纲|设定)", "明示违反大纲"),
        ]
        for pattern, desc in guardrail_patterns:
            if re.search(pattern, text):
                guardrail_violations.append(desc)

        if guardrail_violations:
            issues.append({
                "type": "explicit_guardrail_violation",
                "severity": "critical",
                "message": f"检测到明确的大纲约束违反信号: {', '.join(guardrail_violations)}",
            })
            score -= 25

        score = max(0, score)
        return CheckerResult(score=score, issues=issues, suggestions=suggestions)

    # ------------------------------------------------------------------
    # deep_analyze – AI powered
    # ------------------------------------------------------------------

    async def deep_analyze(
        self, content: str, context: dict[str, Any]
    ) -> CheckerResult:
        """Deep AI analysis for implicit outline spirit violations.

        Args:
            content: Chapter text to analyze.
            context: Must contain 'outline' (outline description/dict) and
                     optionally 'world_settings', 'characters', 'previous_chapters'.
        """
        if not self._api_client:
            return CheckerResult(
                score=0,
                issues=[{
                    "type": "configuration_error",
                    "message": "OutlineLawEnforcer 未配置 AI 服务",
                }],
                suggestions=["请在初始化时传入 ai_service 参数"],
            )

        outline = context.get("outline", {})
        outline_text = outline if isinstance(outline, str) else json.dumps(outline, ensure_ascii=False, indent=2)

        world_settings = context.get("world_settings", {})
        world_text = (
            world_settings if isinstance(world_settings, str)
            else json.dumps(world_settings, ensure_ascii=False, indent=2)
        )

        characters = context.get("characters", [])
        chars_text = (
            characters if isinstance(characters, str)
            else json.dumps(characters, ensure_ascii=False, indent=2)
        )

        previous_chapters = context.get("previous_chapters", [])
        prev_text = (
            previous_chapters if isinstance(previous_chapters, str)
            else json.dumps(previous_chapters, ensure_ascii=False, indent=2)
        )

        prompt = _OUTLINE_LAW_PROMPTS["deep_analysis_prompt"].format(
            content=content, outline_text=outline_text, world_text=world_text,
            chars_text=chars_text, prev_text=prev_text
        )

        system_prompt = _OUTLINE_LAW_PROMPTS["deep_analysis_system_prompt"]

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
                # Fallback: extract what we can from the raw text
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
                    "message": f"大纲执法分析失败: {str(e)}",
                }],
                suggestions=["请检查AI服务配置或稍后重试"],
            )
