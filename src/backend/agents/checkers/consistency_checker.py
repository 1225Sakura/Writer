"""Consistency checker for world consistency (locations, timelines, power levels)."""

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.ai_service import AIService
from ..utils import MiniMaxAPIClient


class ConsistencyChecker:
    """Checks world consistency across the novel."""

    def __init__(self, ai_service: AIService):
        self.api_client = MiniMaxAPIClient(ai_service)

    async def check(self, chapter_id: int, db: AsyncSession) -> dict:
        """Check world consistency for a chapter.

        Args:
            chapter_id: The chapter ID to check
            db: Async database session

        Returns:
            Dict with issues, suggestions, and score
        """
        from ...models.entities import Chapter, DraftVersion, Location, Item, Character, Faction

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

        prompt = f"""审查以下章节内容，检查世界观一致性：

章节内容：
{content}

世界观设定：
{world_context}

请检查以下方面的一致性：
1. 地点描述是否与已设定的地点一致
2. 时间线是否连贯（事件顺序是否合理）
3. 角色实力/修为等级是否与之前描述一致
4. 物品归属和位置是否正确
5. 势力关系和立场是否一致

请以JSON格式返回：
{{
    "issues": ["具体问题描述列表"],
    "suggestions": ["改进建议列表"],
    "score": 1-100的评分
}}"""

        system_prompt = (
            "你是一位专业的小说设定审核专家。仔细审查章节内容与世界观设定之间的一致性，"
            "检查地点、时间线、实力等级、物品归属、势力关系等方面的逻辑矛盾。"
        )

        try:
            content_result = await self.api_client.call(
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
