"""Consistency checker for world consistency (locations, timelines, power levels)."""

from typing import Any

from ...services.ai_service import AIService


class ConsistencyChecker:
    """Checks world consistency across the novel."""

    def __init__(self, ai_service: AIService):
        self.ai_service = ai_service

    async def check(self, chapter_id: int, db: Any) -> dict:
        """Check world consistency for a chapter.

        Args:
            chapter_id: The chapter ID to check
            db: Database session

        Returns:
            Dict with issues, suggestions, and score
        """
        # Fetch chapter content
        from ...models.entities import Chapter, DraftVersion

        chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            return {"issues": [], "suggestions": [], "score": 100}

        # Get latest draft
        draft = db.query(DraftVersion).filter(
            DraftVersion.chapter_id == chapter_id
        ).order_by(DraftVersion.version_number.desc()).first()

        content = draft.content if draft else chapter.summary or ""

        # Fetch related world data
        from ...models.entities import Location, Item, Character, Faction

        locations = db.query(Location).all()
        characters = db.query(Character).all()
        items = db.query(Item).all()
        factions = db.query(Faction).all()

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

        import httpx
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.ai_service.base_url}/text/chatcompletion_v2",
                    headers={
                        "Authorization": f"Bearer {self.ai_service.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "MiniMax-Text-01",
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": prompt},
                        ],
                        "temperature": 0.5,
                    },
                )
                response.raise_for_status()
                result = response.json()
                content_result = result.get("choices", [{}])[0].get("message", {}).get("content", "")

                import json
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
