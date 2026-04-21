"""High point checker for excitement and excitement density."""

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.ai_service import AIService
from ..utils import MiniMaxAPIClient


class HighPointChecker:
    """Checks excitement/excitement density in chapters."""

    def __init__(self, ai_service: AIService):
        self.api_client = MiniMaxAPIClient(ai_service)

    async def check(self, chapter_id: int, db: AsyncSession) -> dict:
        """Check excitement density for a chapter.

        Args:
            chapter_id: The chapter ID to check
            db: Async database session

        Returns:
            Dict with excitement analysis
        """
        from ...models.entities import Chapter, DraftVersion

        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            return {"issues": [], "suggestions": [], "score": 100, "high_points": []}

        result = await db.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .order_by(DraftVersion.version_number.desc())
        )
        draft = result.scalar_one_or_none()

        content = draft.content if draft else chapter.summary or ""

        prompt = f"""分析以下章节的兴奋点/高潮密度：

章节内容：
{content}

请分析：
1. 本章有哪些高潮点/燃点（战斗、冲突、揭示、逆转等）
2. 高潮点之间的间隔是否合理（不能太密也不能太稀）
3. 是否有足够的情绪起伏（张弛结合）
4. 高潮点的铺垫是否充分
5. 章节结尾的钩子是否足够吸引人

请以JSON格式返回：
{{
    "issues": ["兴奋点问题列表"],
    "suggestions": ["改进建议"],
    "score": 1-100的评分,
    "high_points": [
        {{
            "location": "位置描述",
            "type": "high_point类型（战斗/揭示/逆转等）",
            "intensity": "1-10的强度评分",
            "pacing": "节奏评价"
        }}
    ],
    "excitement_density": "兴奋点密度评价（稀疏/适中/密集）",
    "ending_hook": "章节结尾钩子评价"
}}"""

        system_prompt = (
            "你是一位专业的网络小说节奏分析师。分析章节中的高潮点、兴奋点分布，"
            "评估情绪起伏是否合理，结尾是否留有足够的悬念。"
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
                    "high_points": parsed.get("high_points", []),
                    "excitement_density": parsed.get("excitement_density", "适中"),
                    "ending_hook": parsed.get("ending_hook", ""),
                }
            except json.JSONDecodeError:
                return {
                    "issues": ["返回格式错误"],
                    "suggestions": [],
                    "score": 70,
                    "high_points": [],
                    "excitement_density": "适中",
                    "ending_hook": "",
                }
        except Exception as e:
            return {
                "issues": [f"兴奋点检查失败: {str(e)}"],
                "suggestions": [],
                "score": 0,
                "high_points": [],
                "excitement_density": "",
                "ending_hook": "",
            }
