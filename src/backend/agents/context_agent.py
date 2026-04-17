"""Context Agent - Generates writing execution packages for chapters."""

from typing import Any

from ..models.entities import (
    Chapter,
    Outline,
    Character,
    CharacterStoryline,
    PlotThread,
    IFLine,
)
from ..services.ai_service import AIService


class ContextAgent:
    """Generates structured context packages for chapter writing.

    A "创作执行包" (writing execution package) contains:
    - 本章核心任务（目标/阻力/代价）
    - 接住上章（钩子、读者期待）
    - 出场角色（状态、动机、情绪底色）
    - 场景与力量约束
    - 时间约束
    - 风格指导
    - 连续性与伏笔
    - 追读力策略
    """

    def __init__(self, ai_service: AIService):
        self.ai_service = ai_service

    async def generate_chapter_context(
        self, chapter_id: int, db: Any
    ) -> dict[str, Any]:
        """Generate a complete writing execution package for a chapter.

        Args:
            chapter_id: The chapter ID to generate context for
            db: Database session

        Returns:
            Structured context dict containing all writing guidance
        """
        chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
        if not chapter:
            raise ValueError(f"Chapter {chapter_id} not found")

        outline = None
        if chapter.outline_id:
            outline = db.query(Outline).filter(Outline.id == chapter.outline_id).first()

        previous_chapter = None
        if chapter.chapter_order > 0:
            previous_chapter = (
                db.query(Chapter)
                .filter(
                    Chapter.outline_id == chapter.outline_id,
                    Chapter.chapter_order == chapter.chapter_order - 1,
                )
                .first()
            )

        active_plot_threads = (
            db.query(PlotThread)
            .filter(
                PlotThread.created_chapter_id <= chapter_id,
                PlotThread.status == "active",
            )
            .all()
        )

        character_storylines = (
            db.query(CharacterStoryline)
            .join(Character)
            .filter(Character.id == CharacterStoryline.character_id)
            .all()
        )

        if_lines = db.query(IFLine).all()

        context = await self._build_context_prompt(
            chapter=chapter,
            outline=outline,
            previous_chapter=previous_chapter,
            active_plot_threads=active_plot_threads,
            character_storylines=character_storylines,
            if_lines=if_lines,
        )

        return context

    async def _build_context_prompt(
        self,
        chapter: Chapter,
        outline: Outline | None,
        previous_chapter: Chapter | None,
        active_plot_threads: list[PlotThread],
        character_storylines: list[CharacterStoryline],
        if_lines: list[IFLine],
    ) -> dict[str, Any]:
        """Build the structured context prompt for AI generation."""
        system_prompt = """你是一位专业的小说创作策划专家。根据提供的信息，生成一个完整的"创作执行包"，
包含本章写作所需的所有上下文信息。以JSON格式返回，包含以下字段：

{
    "core_task": {
        "goal": "本章主角的核心目标",
        "obstacle": "实现目标的主要阻力",
        "cost": "达成目标需要付出的代价"
    },
    "承接上文": {
        "hooks": ["上章留下的钩子列表"],
        "reader_expectations": "读者期待的发展方向"
    },
    "active_characters": [
        {
            "name": "角色名",
            "current_state": "当前状态",
            "motivation": "本章动机",
            "emotional_base": "情绪底色"
        }
    ],
    "scene_constraints": {
        "locations": ["本章涉及的场景"],
        "power_limits": "力量体系约束描述"
    },
    "time_constraints": "时间线约束描述",
    "style_guidance": "本章风格指导建议",
    "continuity": {
        "foreshadowing": ["需要回收的伏笔"],
        "ongoing_threads": ["持续进行的线索"]
    },
    "engagement_strategy": "追读力提升策略描述"
}"""

        context_data = {
            "chapter_title": chapter.title or f"第{chapter.chapter_order + 1}章",
            "chapter_summary": chapter.summary or "待补充",
            "outline_title": outline.title if outline else "未关联大纲",
            "outline_description": outline.description if outline else "",
            "previous_chapter_summary": previous_chapter.summary if previous_chapter else "无",
            "active_plot_threads": [
                {"title": pt.title, "description": pt.description}
                for pt in active_plot_threads
            ],
            "character_storylines": [
                {
                    "character_name": cs.character.name if cs.character else "未知",
                    "title": cs.title,
                    "arc": cs.arc,
                    "progress": cs.progress,
                }
                for cs in character_storylines
            ],
            "if_lines": [
                {"title": ifl.title, "description": ifl.description}
                for ifl in if_lines
            ],
        }

        import httpx

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
                        {"role": "user", "content": str(context_data)},
                    ],
                    "temperature": 0.6,
                },
            )
            response.raise_for_status()
            result = response.json()

            content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

            import json

            try:
                context = json.loads(content)
            except json.JSONDecodeError:
                context = {
                    "core_task": {
                        "goal": "待确定",
                        "obstacle": "待确定",
                        "cost": "待确定",
                    },
                    "承接上文": {
                        "hooks": [],
                        "reader_expectations": "待确定",
                    },
                    "active_characters": [],
                    "scene_constraints": {
                        "locations": [],
                        "power_limits": "待确定",
                    },
                    "time_constraints": "待确定",
                    "style_guidance": "待确定",
                    "continuity": {
                        "foreshadowing": [],
                        "ongoing_threads": [],
                    },
                    "engagement_strategy": "待确定",
                    "raw_ai_response": content,
                }

            context["chapter_id"] = chapter.id
            context["chapter_title"] = chapter.title
            return context
