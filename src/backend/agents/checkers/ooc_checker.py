"""OOC (Out Of Character) checker for character behavior consistency."""

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.ai_service import AIService
from ..utils import MiniMaxAPIClient


class OOCChecker:
    """Checks if characters act consistently with their personality."""

    def __init__(self, ai_service: AIService):
        self.api_client = MiniMaxAPIClient(ai_service)

    async def check(self, chapter_id: int, character_id: int, db: AsyncSession) -> dict:
        """Check if a character acts consistently with their personality.

        Args:
            chapter_id: The chapter ID to check
            character_id: The character ID to verify
            db: Async database session

        Returns:
            Dict with OOC violations and suggestions
        """
        from ...models.entities import Chapter, DraftVersion, Character

        result = await db.execute(select(Character).where(Character.id == character_id))
        character = result.scalar_one_or_none()
        if not character:
            return {"issues": [], "suggestions": [], "score": 100, "violations": []}

        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            return {"issues": [], "suggestions": [], "score": 100, "violations": []}

        result = await db.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .order_by(DraftVersion.version_number.desc())
        )
        draft = result.scalar_one_or_none()

        content = draft.content if draft else chapter.summary or ""

        prompt = f"""审查以下章节中角色的行为是否符合其性格设定：

章节内容：
{content}

角色信息：
- 姓名：{character.name}
- 性别：{character.gender or "未设定"}
- 性格：{character.personality or "未设定"}
- 欲望：{character.desires or "未设定"}
- 缺陷：{character.flaws or "未设定"}
- 描述：{character.description or "未设定"}
- 修为等级：{character.cultivation_realm or "未设定"}

请检查该角色在章节中的行为是否与其性格、欲望、缺陷等设定一致。
如果角色做出了违背其性格设定的事情，则为OOC（Out Of Character）违规。

请以JSON格式返回：
{{
    "issues": ["OOC问题描述列表"],
    "suggestions": ["保持角色一致性的建议"],
    "score": 1-100的评分,
    "violations": [
        {{
            "location": "违规位置（章节中的位置描述）",
            "expected_behavior": "根据角色设定应该的行为",
            "actual_behavior": "角色实际做出的行为",
            "reason": "违反的原因"
        }}
    ]
}}"""

        system_prompt = (
            "你是一位专业的角色行为分析专家。仔细分析角色在特定场景中的行为是否与其"
            "既定的性格、欲望、缺陷等设定相符，识别任何OOC（Out Of Character）违规。"
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
                    "violations": parsed.get("violations", []),
                }
            except json.JSONDecodeError:
                return {
                    "issues": ["返回格式错误"],
                    "suggestions": [],
                    "score": 70,
                    "violations": [],
                }
        except Exception as e:
            return {
                "issues": [f"角色一致性检查失败: {str(e)}"],
                "suggestions": [],
                "score": 0,
                "violations": [],
            }
