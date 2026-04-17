"""Reader pull checker for hooks and reader engagement."""

from typing import Any

import httpx


class ReaderPullChecker:
    """Checks hooks and reader engagement."""

    def __init__(self, ai_service):
        self.ai_service = ai_service

    async def check(self, chapter_id: int, db: Any) -> dict:
        """Check reader engagement for a chapter.

        Args:
            chapter_id: The chapter ID to check
            db: Database session

        Returns:
            Dict with engagement analysis
        """
        from ...models.entities import Chapter, DraftVersion

        chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            return {"issues": [], "suggestions": [], "score": 100, "hooks": []}

        draft = db.query(DraftVersion).filter(
            DraftVersion.chapter_id == chapter_id
        ).order_by(DraftVersion.version_number.desc()).first()

        content = draft.content if draft else chapter.summary or ""

        # Get next chapter title for context
        from ...models.entities import Chapter as ChapterModel
        next_chapter = db.query(ChapterModel).filter(
            ChapterModel.outline_id == chapter.outline_id,
            ChapterModel.chapter_order == chapter.chapter_order + 1
        ).first()

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
