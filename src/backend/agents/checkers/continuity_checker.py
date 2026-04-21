"""Continuity checker for scene and narrative continuity."""

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.ai_service import AIService
from ..utils import MiniMaxAPIClient


class ContinuityChecker:
    """Checks scene and narrative continuity."""

    def __init__(self, ai_service: AIService):
        self.api_client = MiniMaxAPIClient(ai_service)

    async def check(self, chapter_id: int, db: AsyncSession) -> dict:
        """Check continuity for a chapter.

        Args:
            chapter_id: The chapter ID to check
            db: Async database session

        Returns:
            Dict with continuity issues and suggestions
        """
        from ...models.entities import Chapter, DraftVersion, PlotThread

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

        prompt = f"""审查以下章节的连续性问题：

当前章节内容：
{content}

前几章摘要：
{previous_contents}

活跃的伏笔/情节线：
{[{"id": t.id, "title": t.title, "description": t.description} for t in plot_threads]}

请检查以下连续性问题：
1. 场景转换是否突兀（时间、地点跳转是否平滑）
2. 前后事件是否矛盾（之前发生的事与之后描述是否一致）
3. 角色状态是否连贯（情绪、服装、伤势等是否延续）
4. 伏笔是否得到呼应（之前埋下的伏笔是否被适当揭示或延续）
5. 细节是否自相矛盾（如前面说A死了，后面又写A活着）

请以JSON格式返回：
{{
    "issues": ["连续性问题列表"],
    "suggestions": ["改进建议"],
    "score": 1-100的评分,
    "plot_thread_status": {{
        "fulfilled": ["已完成的伏笔列表"],
        "continued": ["延续中的伏笔列表"],
        "new_setup": ["本章新埋下的伏笔列表"]
    }}
}}"""

        system_prompt = (
            "你是一位专业的叙事连续性审核专家。仔细检查章节与前后章节之间的连贯性，"
            "识别场景转换突兀、事件矛盾、角色状态不一致、伏笔未呼应等问题。"
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
        except Exception as e:
            return {
                "issues": [f"连续性检查失败: {str(e)}"],
                "suggestions": [],
                "score": 0,
                "plot_thread_status": {},
            }
