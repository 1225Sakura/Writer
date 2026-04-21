"""Context Agent - Generates writing execution packages for chapters."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entities import (
    Chapter,
    Outline,
    Character,
    CharacterStoryline,
    PlotThread,
    IFLine,
)
from ..services.ai_service import AIService
from .utils import (
    BaseAgent,
    MiniMaxAPIClient,
    extract_json_from_response,
    validate_context_response,
)

logger = logging.getLogger(__name__)


class ContextAgent(BaseAgent):
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

    # Required top-level fields in response
    REQUIRED_CONTEXT_FIELDS = [
        "core_task",
        "承接上文",
        "active_characters",
        "scene_constraints",
        "time_constraints",
        "style_guidance",
        "continuity",
        "engagement_strategy",
    ]

    def __init__(self, ai_service: AIService):
        super().__init__(ai_service)
        self.api_client = MiniMaxAPIClient(ai_service)

    async def generate_chapter_context(
        self, chapter_id: int, db: AsyncSession
    ) -> dict[str, Any]:
        """Generate a complete writing execution package for a chapter.

        Args:
            chapter_id: The chapter ID to generate context for
            db: Async database session

        Returns:
            Structured context dict containing all writing guidance
        """
        result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
        chapter = result.scalar_one_or_none()
        if not chapter:
            raise ValueError(f"Chapter {chapter_id} not found")

        outline = None
        if chapter.outline_id:
            result = await db.execute(select(Outline).where(Outline.id == chapter.outline_id))
            outline = result.scalar_one_or_none()

        previous_chapter = None
        if chapter.chapter_order > 0:
            result = await db.execute(
                select(Chapter).where(
                    Chapter.outline_id == chapter.outline_id,
                    Chapter.chapter_order == chapter.chapter_order - 1,
                )
            )
            previous_chapter = result.scalar_one_or_none()

        result = await db.execute(
            select(PlotThread).where(
                PlotThread.created_chapter_id <= chapter_id,
                PlotThread.status == "active",
            )
        )
        active_plot_threads = result.scalars().all()

        result = await db.execute(
            select(CharacterStoryline).join(Character)
            .where(Character.id == CharacterStoryline.character_id)
        )
        character_storylines = result.scalars().all()

        result = await db.execute(select(IFLine))
        if_lines = result.scalars().all()

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
包含本章写作所需的所有上下文信息。

【重要】你必须而且只能返回一个有效的JSON对象，不要包含任何其他文字说明。
JSON格式要求：
- 使用双引号包裹所有字符串
- 字段名必须使用双引号
- 不要使用单引号或无引号的字段名
- 确保JSON语法完全正确，可以被标准JSON解析器解析

返回格式如下：
{
    "core_task": {
        "goal": "本章主角的核心目标（简洁描述，20字以内）",
        "obstacle": "实现目标的主要阻力（简洁描述，30字以内）",
        "cost": "达成目标需要付出的代价（简洁描述，30字以内）"
    },
    "承接上文": {
        "hooks": ["上章留下的钩子列表，每个钩子简洁描述"],
        "reader_expectations": "读者期待的发展方向（简洁描述，30字以内）"
    },
    "active_characters": [
        {
            "name": "角色名",
            "current_state": "当前状态（20字以内）",
            "motivation": "本章动机（20字以内）",
            "emotional_base": "情绪底色（如：紧张、期待、犹豫）"
        }
    ],
    "scene_constraints": {
        "locations": ["本章涉及的场景列表"],
        "power_limits": "力量体系约束描述（50字以内）"
    },
    "time_constraints": "时间线约束描述（30字以内）",
    "style_guidance": "本章风格指导建议（30字以内）",
    "continuity": {
        "foreshadowing": ["需要回收的伏笔列表"],
        "ongoing_threads": ["持续进行的线索列表"]
    },
    "engagement_strategy": "追读力提升策略描述（50字以内）"
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

        try:
            content = await self.api_client.call(
                system_prompt=system_prompt,
                user_content=str(context_data),
                temperature=0.6,
            )

            parsed = extract_json_from_response(content)
            validate_context_response(parsed, self.REQUIRED_CONTEXT_FIELDS)

            # Validate nested structure
            if not isinstance(parsed.get("core_task"), dict):
                raise ValueError("core_task must be an object")
            if "goal" not in parsed["core_task"] or "obstacle" not in parsed["core_task"] or "cost" not in parsed["core_task"]:
                raise ValueError("core_task must have goal, obstacle, and cost fields")

            if not isinstance(parsed.get("承接上文"), dict):
                raise ValueError("承接上文 must be an object")

            if not isinstance(parsed.get("active_characters"), list):
                raise ValueError("active_characters must be an array")

            if not isinstance(parsed.get("scene_constraints"), dict):
                raise ValueError("scene_constraints must be an object")

            if not isinstance(parsed.get("continuity"), dict):
                raise ValueError("continuity must be an object")

            context = parsed

        except ValueError as e:
            logger.warning(f"Failed to parse context response: {e}, using fallback")
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
                "parse_error": str(e),
                "raw_ai_response": content if 'content' in dir() else None,
            }

        context["chapter_id"] = chapter.id
        context["chapter_title"] = chapter.title
        return context
