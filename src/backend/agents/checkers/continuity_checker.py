"""Continuity checker for scene and narrative continuity.

quick_scan: Heuristic check for obvious continuity breaks (scene transitions,
            timeline markers, character state inconsistencies).
deep_analyze: AI-powered analysis for subtle continuity issues across chapters.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx
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

_CONTINUITY_PROMPTS = _load_prompts("continuity_checker")


class ContinuityChecker(BaseChecker):
    """Checks scene and narrative continuity."""

    def __init__(self, ai_service: AIService | None = None, weight: float = 1.0) -> None:
        super().__init__(
            name="continuity",
            description="检查叙事连续性（场景转换、角色状态、伏笔呼应、时间线等）",
            weight=weight,
        )
        self._ai_service = ai_service
        self._api_client = MiniMaxAPIClient(ai_service) if ai_service else None

    async def quick_scan(self, content: str) -> CheckerResult:
        """Heuristic scan for obvious continuity breaks.

        Detects:
        - Scene transition issues (abrupt jumps without markers)
        - Timeline contradiction markers
        - Character state inconsistencies
        -重复描述/矛盾描述
        """
        issues: list[dict[str, Any]] = []
        suggestions: list[str] = []
        score = 100

        text = content or ""

        # 1. Detect scene transition issues (abrupt location/time changes)
        abrupt_transition_patterns = [
            (r"(?:突然|忽然).*(?:到了|来到|出现在).{0,20}$", "场景突然跳转缺少过渡"),
            (r"^(?:他|她|它|他们).{0,20}然后.{0,20}$", "场景转换缺少时间/过渡标记"),
        ]
        for pattern, desc in abrupt_transition_patterns:
            if re.search(pattern, text, re.MULTILINE):
                issues.append({
                    "type": "abrupt_scene_transition",
                    "severity": "medium",
                    "message": desc,
                })
                suggestions.append("场景转换应有合理的过渡描写（时间标记、地点标记、过渡句等）")
                score -= 10

        # 2. Timeline markers contradiction
        timeline_issues = [
            (r"一会儿.{0,20}几天后", "时间跨度描述矛盾：一会儿与几天后"),
            (r"刚才.{0,20}后来", "时间顺序矛盾：刚才之后又后来"),
            (r"当时.{0,20}现在", "时间状态矛盾：当时与现在混淆"),
        ]
        for pattern, desc in timeline_issues:
            if re.search(pattern, text):
                issues.append({
                    "type": "timeline_marker_contradiction",
                    "severity": "high",
                    "message": desc,
                })
                suggestions.append("请检查时间描述的先后顺序，确保时间线清晰")
                score -= 15

        # 3. Character state inconsistency detection
        state_contradictions = [
            (r"(?:伤[势病]|受[伤损]).*?(?:完好无损|完全恢复|好了)", "角色状态矛盾：受伤与痊愈同时描述"),
            (r"(?:愤怒|生气|暴怒).*?(?:平静|冷静|微笑)", "情绪状态矛盾：愤怒与平静同时出现"),
            (r"(?:穿着|身披).*?脱下", "装备状态矛盾：穿着与脱下同时描述"),
        ]
        for pattern, desc in state_contradictions:
            if re.search(pattern, text):
                issues.append({
                    "type": "character_state_inconsistency",
                    "severity": "high",
                    "message": desc,
                })
                suggestions.append("请确保角色状态描述前后一致，避免矛盾")
                score -= 20

        # 4. Duplicate description detection (same thing described twice differently)
        duplicate_patterns = [
            r"(.{5,15})\s*又\s*\1",
            r"(.{5,15})\s*再次\s*\1",
        ]
        for pattern in duplicate_patterns:
            matches = re.findall(pattern, text)
            if matches:
                issues.append({
                    "type": "duplicate_description",
                    "severity": "low",
                    "message": f"检测到可能的重复描述: {matches[:3]}",
                })
                suggestions.append("避免对同一事物进行重复描述")
                score -= 5

        # 5. Referenced undefined items/characters
        referenced_but_not_defined = [
            (r'(?:那个|此|这).{2,6}(?:人|物|事|地方)', "引用了未明确定义的指代"),
        ]
        for pattern, desc in referenced_but_not_defined:
            if re.search(pattern, text):
                # Check if preceding context defines it
                matches = re.finditer(pattern, text)
                for m in matches:
                    start = max(0, m.start() - 200)
                    preceding = text[start:m.start()]
                    if not any(defined in preceding for defined in ["名为", "叫", "是", "这个人", "这个东西"]):
                        issues.append({
                            "type": "undefined_reference",
                            "severity": "low",
                            "message": f"检测到可能未定义的指代: {m.group(0)}",
                        })
                        score -= 5
                        break

        score = max(0, score)
        return CheckerResult(score=score, issues=issues, suggestions=suggestions)

    async def deep_analyze(
        self, content: str, context: dict[str, Any]
    ) -> CheckerResult:
        """Deep AI analysis for subtle continuity issues.

        Args:
            content: Chapter text to analyze.
            context: Must contain 'previous_chapters' and optionally
                     'plot_threads', 'characters', 'world_settings'.
        """
        if not self._api_client:
            return CheckerResult(
                score=0,
                issues=[{
                    "type": "configuration_error",
                    "message": "ContinuityChecker 未配置 AI 服务",
                }],
                suggestions=["请在初始化时传入 ai_service 参数"],
            )

        previous_chapters = context.get("previous_chapters", [])
        prev_text = (
            previous_chapters if isinstance(previous_chapters, str)
            else json.dumps(previous_chapters, ensure_ascii=False, indent=2)
        )

        plot_threads = context.get("plot_threads", [])
        threads_text = (
            plot_threads if isinstance(plot_threads, str)
            else json.dumps(plot_threads, ensure_ascii=False, indent=2)
        )

        characters = context.get("characters", [])
        chars_text = (
            characters if isinstance(characters, str)
            else json.dumps(characters, ensure_ascii=False, indent=2)
        )

        world_settings = context.get("world_settings", {})
        world_text = (
            world_settings if isinstance(world_settings, str)
            else json.dumps(world_settings, ensure_ascii=False, indent=2)
        )

        prompt = _CONTINUITY_PROMPTS["deep_analysis_prompt"].format(
            content=content, prev_text=prev_text, threads_text=threads_text,
            chars_text=chars_text, world_text=world_text
        )

        system_prompt = _CONTINUITY_PROMPTS["deep_analysis_system_prompt"]

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
                    "message": f"连续性检查分析失败: {str(e)}",
                }],
                suggestions=["请检查AI服务配置或稍后重试"],
            )

    # Legacy check method for backward compatibility
    async def check(self, chapter_id: int, db: AsyncSession) -> dict:
        """Check continuity for a chapter (legacy method).

        Args:
            chapter_id: The chapter ID to check
            db: Async database session

        Returns:
            Dict with continuity issues and suggestions
        """
        from ...core.domain.entities import Chapter, DraftVersion, PlotThread

        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            return {"issues": [], "suggestions": [], "score": 100}

        result = await db.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .order_by(DraftVersion.version_number.desc())
        )
        draft = result.scalar_one_or_none()

        content = draft.content if draft else chapter.summary or ""

        result = await db.execute(
            select(Chapter)
            .where(
                Chapter.outline_id == chapter.outline_id,
                Chapter.chapter_order < chapter.chapter_order
            )
            .order_by(Chapter.chapter_order.desc())
            .limit(3)
        )
        previous_chapters = result.scalars().all()

        previous_contents = []
        for prev in previous_chapters:
            result = await db.execute(
                select(DraftVersion)
                .where(DraftVersion.chapter_id == prev.id)
                .order_by(DraftVersion.version_number.desc())
            )
            prev_draft = result.scalar_one_or_none()
            if prev_draft:
                previous_contents.append({
                    "chapter_id": prev.id,
                    "title": prev.title,
                    "content": prev_draft.content[:500] if prev_draft.content else ""
                })

        result = await db.execute(select(PlotThread).where(PlotThread.status == "active"))
        plot_threads = result.scalars().all()

        plot_threads_json = json.dumps(
            [{"id": t.id, "title": t.title, "description": t.description} for t in plot_threads],
            ensure_ascii=False, indent=2
        )
        prompt = _CONTINUITY_PROMPTS["legacy_check_prompt"].format(
            content=content, previous_contents=previous_contents,
            plot_threads_json=plot_threads_json
        )

        system_prompt = _CONTINUITY_PROMPTS["legacy_check_system_prompt"]

        try:
            content_result = await self._api_client.call(
                system_prompt=system_prompt,
                user_content=prompt,
                temperature=0.5,
            )

            try:
                parsed = json.loads(content_result)
                return {
                    "issues": parsed.get("issues", []),
                    "suggestions": parsed.get("suggestions", []),
                    "score": parsed.get("score", 80),
                    "plot_thread_status": parsed.get("plot_thread_status", {
                        "fulfilled": [],
                        "continued": [],
                        "new_setup": [],
                    }),
                }
            except json.JSONDecodeError:
                return {
                    "issues": ["返回格式错误"],
                    "suggestions": [],
                    "score": 70,
                    "plot_thread_status": {},
                }
        except (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException, ValueError) as e:
            return {
                "issues": [f"连续性检查失败: {str(e)}"],
                "suggestions": [],
                "score": 0,
                "plot_thread_status": {},
            }
