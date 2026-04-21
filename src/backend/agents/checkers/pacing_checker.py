"""Pacing checker for strand ratios (Quest 60%, Fire 20%, Constellation 20%)."""

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.ai_service import AIService
from ..utils import MiniMaxAPIClient


class PacingChecker:
    """Checks narrative pacing and strand ratios."""

    STRAND_RATIOS = {
        "quest": 0.60,
        "fire": 0.20,
        "constellation": 0.20,
    }

    def __init__(self, ai_service: AIService):
        self.api_client = MiniMaxAPIClient(ai_service)

    async def check(self, chapter_id: int, db: AsyncSession) -> dict:
        """Check pacing and strand ratios for a chapter.

        Args:
            chapter_id: The chapter ID to check
            db: Async database session

        Returns:
            Dict with pacing analysis including strand ratios
        """
        from ...models.entities import Chapter, DraftVersion

        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            return {"issues": [], "suggestions": [], "score": 100, "strand_ratios": {}}

        result = await db.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .order_by(DraftVersion.version_number.desc())
        )
        draft = result.scalar_one_or_none()

        content = draft.content if draft else chapter.summary or ""

        prompt = f"""分析以下章节的叙事节奏和故事线比例：

章节内容：
{content}

请识别并统计以下三种故事线的占比：
1. 任务线(Quest)：主角追求目标、完成任务、推进主线剧情的内容
2. 燃情线(Fire)：战斗、激情、热血、冲突对抗的内容
3. 星座线(Constellation)：角色情感、关系发展、人物弧线的内容

理想比例是：任务线60%，燃情线20%，星座线20%

请以JSON格式返回：
{{
    "issues": ["节奏问题列表（如某类内容过多/过少）"],
    "suggestions": ["改进建议"],
    "score": 1-100的评分,
    "strand_ratios": {{
        "quest": 0-1的小数,
        "fire": 0-1的小数,
        "constellation": 0-1的小数
    }},
    "analysis": "简要分析说明"
}}"""

        system_prompt = (
            "你是一位专业的网络小说节奏分析师。分析章节中不同类型内容的比例，"
            "评估叙事节奏是否均衡，给出具体的改进建议。"
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
                    "strand_ratios": parsed.get("strand_ratios", {
                        "quest": 0.6,
                        "fire": 0.2,
                        "constellation": 0.2,
                    }),
                    "analysis": parsed.get("analysis", ""),
                }
            except json.JSONDecodeError:
                return {
                    "issues": ["返回格式错误"],
                    "suggestions": [],
                    "score": 70,
                    "strand_ratios": {"quest": 0.6, "fire": 0.2, "constellation": 0.2},
                    "analysis": "",
                }
        except Exception as e:
            return {
                "issues": [f"节奏检查失败: {str(e)}"],
                "suggestions": [],
                "score": 0,
                "strand_ratios": {},
                "analysis": "",
            }
