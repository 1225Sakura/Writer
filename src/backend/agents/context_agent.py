"""Context Agent - Generates writing execution packages for chapters."""

import asyncio
import json
import logging
from typing import Any

import httpx

from ..models.entities import (
    Chapter,
    Outline,
    Character,
    CharacterStoryline,
    PlotThread,
    IFLine,
)
from ..services.ai_service import AIService

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1.0  # seconds
MAX_RETRY_DELAY = 10.0  # seconds
RETRY_MULTIPLIER = 2.0


async def retry_with_exponential_backoff(
    func,
    *args,
    max_retries: int = MAX_RETRIES,
    initial_delay: float = INITIAL_RETRY_DELAY,
    max_delay: float = MAX_RETRY_DELAY,
    multiplier: float = RETRY_MULTIPLIER,
    **kwargs
):
    """Execute async function with exponential backoff retry logic.

    Args:
        func: Async function to retry
        *args: Positional arguments for func
        max_retries: Maximum number of retry attempts
        initial_delay: Initial delay in seconds
        max_delay: Maximum delay cap in seconds
        multiplier: Exponential multiplier for delay growth
        **kwargs: Keyword arguments for func

    Returns:
        Result from successful function execution

    Raises:
        Last exception if all retries fail
    """
    last_exception = None
    delay = initial_delay

    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException) as e:
            last_exception = e
            if attempt < max_retries:
                logger.warning(
                    f"Attempt {attempt + 1}/{max_retries + 1} failed: {e}. "
                    f"Retrying in {delay}s..."
                )
                await asyncio.sleep(delay)
                delay = min(delay * multiplier, max_delay)
            else:
                logger.error(f"All {max_retries + 1} attempts failed for {func.__name__}")
        except json.JSONDecodeError as e:
            # Don't retry JSON parsing errors
            raise ValueError(f"Invalid JSON response: {e}") from e

    raise last_exception


def validate_context_response(data: Any, required_fields: list[str]) -> bool:
    """Validate that response data contains required fields.

    Args:
        data: Parsed JSON response data
        required_fields: List of required field names

    Returns:
        True if all required fields present

    Raises:
        ValueError if validation fails
    """
    if not isinstance(data, dict):
        raise ValueError(f"Expected dict response, got {type(data).__name__}")

    missing = [f for f in required_fields if f not in data]
    if missing:
        raise ValueError(f"Missing required fields: {', '.join(missing)}")

    return True


def extract_json_from_response(content: str) -> dict[str, Any]:
    """Extract JSON from AI response content, handling markdown code blocks.

    Args:
        content: Raw response content string

    Returns:
        Parsed JSON dictionary

    Raises:
        ValueError if JSON cannot be extracted or parsed
    """
    content = content.strip()

    # Handle markdown code blocks: ```json ... ``` or ``` ...
    if content.startswith("```"):
        # Remove first line (```json or ```)
        lines = content.split("\n")
        if lines[0].strip().startswith("```"):
            content = "\n".join(lines[1:])
        # Remove closing ```
        if content.strip().endswith("```"):
            content = content.strip()[:-3]

    content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        # Try to extract just the JSON portion
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            try:
                return json.loads(content[json_start:json_end])
            except json.JSONDecodeError:
                pass
        raise ValueError(f"Cannot parse JSON from response: {e}") from e


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

    async def _call_minimax_api(
        self,
        system_prompt: str,
        user_content: str,
        temperature: float = 0.6,
    ) -> str:
        """Call MiniMax API with retry logic.

        Args:
            system_prompt: System prompt for the AI
            user_content: User message content
            temperature: Sampling temperature

        Returns:
            Raw response content string

        Raises:
            ValueError if response cannot be parsed after retries
        """
        async def _make_request():
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
                            {"role": "user", "content": user_content},
                        ],
                        "temperature": temperature,
                    },
                )
                response.raise_for_status()
                result = response.json()

                content = result.get("choices", [{}])[0].get("message", {}).get("content", "")
                if not content:
                    raise ValueError("Empty response content from API")
                return content

        return await retry_with_exponential_backoff(_make_request)

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
            content = await self._call_minimax_api(
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
