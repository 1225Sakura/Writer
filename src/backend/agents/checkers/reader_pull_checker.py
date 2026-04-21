"""Reader pull checker for hooks and reader engagement."""

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.ai_service import AIService
from ..utils import MiniMaxAPIClient


class ReaderPullChecker:
    """Checks hooks and reader engagement."""

    def __init__(self, ai_service: AIService):
        self.api_client = MiniMaxAPIClient(ai_service)

    async def check(self, chapter_id: int, db: AsyncSession) -> dict:
        """Check reader engagement for a chapter.

        Args:
            chapter_id: The chapter ID to check
            db: Async database session

        Returns:
            Dict with engagement analysis
        """
        from ...models.entities import Chapter, DraftVersion

        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            return {"issues": [], "suggestions": [], "score": 100, "hooks": []}

        result = await db.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .order_by(DraftVersion.version_number.desc())
        )
        draft = result.scalar_one_or_none()

        content = draft.content if draft else chapter.summary or ""

        result = await db.execute(
            select(Chapter).where(
                Chapter.outline_id == chapter.outline_id,
                Chapter.chapter_order == chapter.chapter_order + 1
            )
        )
        next_chapter = result.scalar_one_or_none()

        prompt = f"""分析以下章节的读者吸引力/钩子效果：

章节内容：
{content}

下一章预告（如果有）：{next_chapter.title if next_chapter else "无"}

请分析以下方面：
1. 章节开头是否有足够的吸引力（开篇钩子）
2. 章节结尾的悬念设置是否足够（结尾钩子）
3. 是否有足够的矛盾冲突推动读者继续阅读
4. 是否有信息差/认知差让读者好奇
5. 章节中的"为什么"是否足够多（为什么他会这样做？为什么她要离开？）
6. 是否有情感共鸣点

请以JSON格式返回：
{{
    "issues": ["吸引力问题列表"],
    "suggestions": ["改进建议"],
    "score": 1-100的评分,
    "hooks": [
        {{
            "location": "位置（开头/中间/结尾）",
            "type": "hook类型（悬念/冲突/好奇/情感等）",
            "description": "具体描述",
            "effectiveness": "1-10的有效性评分"
        }}
    ],
    "opening_hook": "开篇钩子评价",
    "ending_hook": "结尾钩子评价",
    "curiosity_gaps": ["产生的认知差/好奇点列表"]
}}"""

        system_prompt = (
            "你是一位专业的网络小说读者心理分析师。分析章节中的钩子设置、悬念营造、"
            "读者好奇心激发等方面，评估读者是否愿意继续阅读下一章。"
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
                    "hooks": parsed.get("hooks", []),
                    "opening_hook": parsed.get("opening_hook", ""),
                    "ending_hook": parsed.get("ending_hook", ""),
                    "curiosity_gaps": parsed.get("curiosity_gaps", []),
                }
            except json.JSONDecodeError:
                return {
                    "issues": ["返回格式错误"],
                    "suggestions": [],
                    "score": 70,
                    "hooks": [],
                    "opening_hook": "",
                    "ending_hook": "",
                    "curiosity_gaps": [],
                }
        except Exception as e:
            return {
                "issues": [f"读者吸引力检查失败: {str(e)}"],
                "suggestions": [],
                "score": 0,
                "hooks": [],
                "opening_hook": "",
                "ending_hook": "",
                "curiosity_gaps": [],
            }
