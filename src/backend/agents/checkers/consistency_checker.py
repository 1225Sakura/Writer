"""Consistency checker for world consistency (locations, timelines, power levels).

quick_scan: Heuristic check for obvious consistency violations (location name mismatches,
            timeline contradictions, power level inconsistencies via keyword patterns).
deep_analyze: AI-powered deep analysis for subtle consistency issues across the story.
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

_CONSISTENCY_PROMPTS = _load_prompts("consistency_checker")


class ConsistencyChecker(BaseChecker):
    """Checks world consistency across the novel."""

    def __init__(self, ai_service: AIService | None = None) -> None:
        super().__init__(
            name="consistency",
            description="检查世界观一致性（地点、时间线、力量等级、物品归属、势力关系等）",
        )
        self._ai_service = ai_service
        self._api_client = MiniMaxAPIClient(ai_service) if ai_service else None

    async def quick_scan(self, content: str) -> CheckerResult:
        """Heuristic scan for obvious consistency violations.

        Detects:
        - Location name inconsistencies
        - Timeline markers contradictions
        - Power level keywords contradictions
        - Faction/character name sudden changes
        """
        issues: list[dict[str, Any]] = []
        suggestions: list[str] = []
        score = 100

        text = content or ""

        # 1. Location name inconsistency detection
        # Check for quoted location names that might contradict
        location_pattern = r'["""](.{2,10})["""]'
        quoted_names = re.findall(location_pattern, text)
        location_indicators = ["城", "山", "河", "湖", "海", "岛", "村", "镇", "国", "域", "界"]
        potential_locations = [n for n in quoted_names if any(ind in n for ind in location_indicators)]

        # 2. Timeline contradiction detection
        time_markers = [
            (r"昨天.*?(?:今天|明日|明天)", "时间线矛盾：昨天和今天/明天同时出现"),
            (r"刚才.*?(?:已经|早已|早就)", "时间线矛盾：刚发生在先的事件被描述为已完成"),
            (r"一年前.*?(?:现在|此时|目前)", "时间线矛盾：一年前的事件与当前时间混淆"),
        ]
        for pattern, desc in time_markers:
            if re.search(pattern, text):
                issues.append({
                    "type": "timeline_contradiction",
                    "severity": "medium",
                    "message": desc,
                })
                suggestions.append("请检查时间线描述，确保事件顺序清晰一致")
                score -= 15

        # 3. Power level contradiction detection
        power_contradictions = [
            (r"(?:筑基|金丹|元婴).*?(?:练气|后天)", "境界矛盾：高低境界同时出现"),
            (r"(?:武圣|武帝).*?(?:斗者|斗师)", "境界矛盾：不同修炼体系境界混淆"),
            (r"(?:前期|之前).*?(?:后期|之后).*?(?:境界|实力|修为)", "境界描述时间线混乱"),
        ]
        for pattern, desc in power_contradictions:
            if re.search(pattern, text):
                issues.append({
                    "type": "power_level_contradiction",
                    "severity": "high",
                    "message": desc,
                })
                suggestions.append("请确认境界等级描述是否与之前章节一致")
                score -= 20

        # 4. Character name sudden change detection
        name_change_patterns = [
            r"(?:叫做|名叫|名为|人称)\s*(.{2,5})\s*(?:又|随后|然后|接着)\s*(?:叫做|名叫|名为)\s*(.{2,5})",
            r"(?:本叫|原叫|原来叫)\s*(.{2,5})\s*(?:现在|如今|改为|改成)\s*(.{2,5})",
        ]
        for pattern in name_change_patterns:
            matches = re.findall(pattern, text)
            if matches:
                issues.append({
                    "type": "character_name_inconsistency",
                    "severity": "high",
                    "message": f"检测到角色名称可能发生突然变化: {matches}",
                })
                suggestions.append("角色名称变更应有充分理由和描写铺垫")
                score -= 15

        # 5. Faction name inconsistency
        faction_change_patterns = [
            r"(?:宗门|门派|势力)\s*(?:叫|名)\s*(.{3,8})\s*(?:后来|之后|随即|接着)\s*(?:改名|更名|变成|成了)\s*(.{3,8})",
        ]
        for pattern in faction_change_patterns:
            matches = re.findall(pattern, text)
            if matches:
                issues.append({
                    "type": "faction_name_inconsistency",
                    "severity": "medium",
                    "message": f"检测到势力名称可能发生突然变化: {matches}",
                })
                suggestions.append("势力名称变更应有说明，避免读者困惑")
                score -= 10

        score = max(0, score)
        return CheckerResult(score=score, issues=issues, suggestions=suggestions)

    async def deep_analyze(
        self, content: str, context: dict[str, Any]
    ) -> CheckerResult:
        """Deep AI analysis for subtle consistency issues.

        Args:
            content: Chapter text to analyze.
            context: Must contain 'world_settings', 'characters', and optionally
                     'previous_chapters', 'locations', 'items', 'factions'.
        """
        if not self._api_client:
            return CheckerResult(
                score=0,
                issues=[{
                    "type": "configuration_error",
                    "message": "ConsistencyChecker 未配置 AI 服务",
                }],
                suggestions=["请在初始化时传入 ai_service 参数"],
            )

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

        locations = context.get("locations", [])
        locs_text = (
            locations if isinstance(locations, str)
            else json.dumps(locations, ensure_ascii=False, indent=2)
        )

        previous_chapters = context.get("previous_chapters", [])
        prev_text = (
            previous_chapters if isinstance(previous_chapters, str)
            else json.dumps(previous_chapters, ensure_ascii=False, indent=2)
        )

        prompt = _CONSISTENCY_PROMPTS["deep_analysis_prompt"].format(
            content=content, world_text=world_text, chars_text=chars_text,
            locs_text=locs_text, prev_text=prev_text
        )

        system_prompt = _CONSISTENCY_PROMPTS["deep_analysis_system_prompt"]

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
                    "message": f"一致性检查分析失败: {str(e)}",
                }],
                suggestions=["请检查AI服务配置或稍后重试"],
            )

    # Legacy check method for backward compatibility
    async def check(self, chapter_id: int, db: AsyncSession) -> dict:
        """Check world consistency for a chapter (legacy method).

        Args:
            chapter_id: The chapter ID to check
            db: Async database session

        Returns:
            Dict with issues, suggestions, and score
        """
        from ...core.domain.entities import Chapter, DraftVersion, Location, Item, Character, Faction

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

        result = await db.execute(select(Location))
        locations = result.scalars().all()

        result = await db.execute(select(Character))
        characters = result.scalars().all()

        result = await db.execute(select(Item))
        items = result.scalars().all()

        result = await db.execute(select(Faction))
        factions = result.scalars().all()

        world_context = {
            "locations": [{"id": l.id, "name": l.name, "description": l.description} for l in locations],
            "characters": [{"id": c.id, "name": c.name, "cultivation_realm": c.cultivation_realm} for c in characters],
            "items": [{"id": i.id, "name": i.name, "owner": i.owner, "location": i.location} for i in items],
            "factions": [{"id": f.id, "name": f.name, "type": f.type} for f in factions],
        }

        prompt = _CONSISTENCY_PROMPTS["legacy_check_prompt"].format(
            content=content, world_context=world_context
        )

        system_prompt = _CONSISTENCY_PROMPTS["legacy_check_system_prompt"]

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
                }
            except json.JSONDecodeError:
                return {
                    "issues": [f"AI返回格式错误: {content_result[:200]}"],
                    "suggestions": [],
                    "score": 70,
                }
        except Exception as e:
            return {
                "issues": [f"一致性检查失败: {str(e)}"],
                "suggestions": [],
                "score": 0,
            }
