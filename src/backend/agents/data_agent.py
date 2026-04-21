"""Data Agent - Extracts structured information from chapter content."""

import asyncio
import json
import logging
from typing import Any

import httpx

from ..models.entities import (
    Character,
    CharacterRelationship,
    PlotThread,
    Item,
    Location,
    Faction,
)
from ..services.ai_service import AIService

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 3
INITIAL_RETRY_DELAY = 1.0
MAX_RETRY_DELAY = 10.0
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
            raise ValueError(f"Invalid JSON response: {e}") from e

    raise last_exception


def extract_json_from_response(content: str) -> Any:
    """Extract JSON from AI response content, handling markdown code blocks.

    Args:
        content: Raw response content string

    Returns:
        Parsed JSON (list or dict)

    Raises:
        ValueError if JSON cannot be extracted or parsed
    """
    content = content.strip()

    # Handle markdown code blocks: ```json ... ``` or ``` ...
    if content.startswith("```"):
        lines = content.split("\n")
        if lines[0].strip().startswith("```"):
            content = "\n".join(lines[1:])
        if content.strip().endswith("```"):
            content = content.strip()[:-3]

    content = content.strip()

    try:
        return json.loads(content)
    except json.JSONDecodeError as e:
        # Try to extract JSON array or object
        json_start = content.find("[")
        if json_start == -1:
            json_start = content.find("{")

        if json_start >= 0:
            # Find the matching closing bracket
            if content[json_start] == "[":
                # Array
                depth = 0
                for i, c in enumerate(content[json_start:], json_start):
                    if c == "[":
                        depth += 1
                    elif c == "]":
                        depth -= 1
                        if depth == 0:
                            try:
                                return json.loads(content[json_start:i+1])
                            except json.JSONDecodeError:
                                pass
                            break
            else:
                # Object
                json_end = content.rfind("}") + 1
                if json_end > json_start:
                    try:
                        return json.loads(content[json_start:json_end])
                    except json.JSONDecodeError:
                        pass

        raise ValueError(f"Cannot parse JSON from response: {e}") from e


def validate_entity_response(data: Any) -> list[dict[str, Any]]:
    """Validate and normalize entity extraction response.

    Args:
        data: Parsed JSON response

    Returns:
        List of valid entity dictionaries

    Raises:
        ValueError if response format is completely invalid
    """
    if not isinstance(data, list):
        # If it's a dict with a container field, try to extract
        if isinstance(data, dict):
            for key in ["entities", "data", "results", "items"]:
                if key in data and isinstance(data[key], list):
                    return validate_entity_response(data[key])
        raise ValueError(f"Expected list response, got {type(data).__name__}")

    validated = []
    for item in data:
        if not isinstance(item, dict):
            continue
        if "name" not in item or "type" not in item:
            continue
        validated.append({
            "name": str(item.get("name", "")),
            "type": str(item.get("type", "")),
            "description": str(item.get("description", "")),
        })

    return validated


def validate_relationship_response(data: Any) -> list[dict[str, Any]]:
    """Validate and normalize relationship extraction response.

    Args:
        data: Parsed JSON response

    Returns:
        List of valid relationship dictionaries

    Raises:
        ValueError if response format is completely invalid
    """
    if not isinstance(data, list):
        if isinstance(data, dict):
            for key in ["relationships", "relations", "data", "results"]:
                if key in data and isinstance(data[key], list):
                    return validate_relationship_response(data[key])
        raise ValueError(f"Expected list response, got {type(data).__name__}")

    validated = []
    for item in data:
        if not isinstance(item, dict):
            continue
        if "source" not in item or "target" not in item:
            continue
        validated.append({
            "source": str(item.get("source", "")),
            "target": str(item.get("target", "")),
            "type": str(item.get("type", "related")),
            "description": str(item.get("description", "")),
        })

    return validated


def validate_state_change_response(data: Any) -> list[dict[str, Any]]:
    """Validate and normalize state change extraction response.

    Args:
        data: Parsed JSON response

    Returns:
        List of valid state change dictionaries
    """
    if not isinstance(data, list):
        if isinstance(data, dict):
            for key in ["state_changes", "changes", "data", "results"]:
                if key in data and isinstance(data[key], list):
                    return validate_state_change_response(data[key])
        raise ValueError(f"Expected list response, got {type(data).__name__}")

    validated = []
    for item in data:
        if not isinstance(item, dict):
            continue
        if "entity" not in item:
            continue
        validated.append({
            "entity": str(item.get("entity", "")),
            "before_state": str(item.get("before_state", "")),
            "after_state": str(item.get("after_state", "")),
            "trigger": str(item.get("trigger", "")),
        })

    return validated


def validate_scene_response(data: Any) -> list[dict[str, Any]]:
    """Validate and normalize scene slicing response.

    Args:
        data: Parsed JSON response

    Returns:
        List of valid scene dictionaries
    """
    if not isinstance(data, list):
        if isinstance(data, dict):
            for key in ["scenes", "data", "results"]:
                if key in data and isinstance(data[key], list):
                    return validate_scene_response(data[key])
        raise ValueError(f"Expected list response, got {type(data).__name__}")

    validated = []
    for item in data:
        if not isinstance(item, dict):
            continue
        # Accept either scene_number or index as identifier
        validated.append({
            "scene_number": item.get("scene_number", len(validated) + 1),
            "location": str(item.get("location", "")),
            "characters": item.get("characters", []) if isinstance(item.get("characters"), list) else [],
            "key_events": item.get("key_events", []) if isinstance(item.get("key_events"), list) else [],
            "mood": str(item.get("mood", "")),
        })

    return validated


class DataAgent:
    """Extracts structured information from chapter content.

    Capabilities:
    - 实体识别（角色、地点、物品等）
    - 状态变化追踪
    - 关系提取
    - 场景切片
    - 摘要生成
    """

    def __init__(self, ai_service: AIService):
        self.ai_service = ai_service

    async def process_chapter(
        self, chapter_id: int, content: str, db: Any
    ) -> dict[str, Any]:
        """Process chapter content and extract structured data.

        Args:
            chapter_id: The chapter ID being processed
            content: The chapter text content
            db: Database session

        Returns:
            Extraction results dict with entities, relationships, etc.
        """
        entities = await self._extract_entities(content)

        relationships = await self._extract_relationships(content, entities, db)

        state_changes = await self._track_state_changes(content, entities)

        scenes = await self._slice_scenes(content)

        summary = await self._generate_summary(content)

        await self._persist_extracted_data(
            chapter_id=chapter_id,
            entities=entities,
            relationships=relationships,
            db=db,
        )

        return {
            "chapter_id": chapter_id,
            "entities": entities,
            "relationships": relationships,
            "state_changes": state_changes,
            "scenes": scenes,
            "summary": summary,
        }

    async def _call_minimax_api(
        self,
        system_prompt: str,
        user_content: str,
        temperature: float = 0.3,
        max_content_length: int = 8000,
    ) -> str:
        """Call MiniMax API with retry logic.

        Args:
            system_prompt: System prompt for the AI
            user_content: User message content (will be truncated if too long)
            temperature: Sampling temperature

        Returns:
            Raw response content string

        Raises:
            ValueError if response cannot be parsed after retries
        """
        # Truncate content to avoid token limits
        truncated_content = user_content[:max_content_length] if len(user_content) > max_content_length else user_content

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
                            {"role": "user", "content": truncated_content},
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

    async def _extract_entities(self, content: str) -> list[dict[str, Any]]:
        """Extract named entities from chapter content."""
        system_prompt = """你是一位专业的小说文本分析专家。从以下小说章节文本中提取所有实体信息。

【重要】你必须返回一个有效的JSON数组，不要包含任何其他文字说明。
JSON格式要求：
- 使用双引号包裹所有字符串
- 字段名必须使用双引号
- 不要使用单引号或无引号的字段名
- 数组格式：[]

每个实体对象必须包含以下字段：
- name: 实体名称（字符串，必填）
- type: 实体类型（字符串，必填），可选值：character/location/item/faction/concept
- description: 实体描述或特征（字符串，可为空）

示例返回格式：
[
    {"name": "张三", "type": "character", "description": "主角，剑客"},
    {"name": "青云山", "type": "location", "description": "修仙门派所在地"},
    {"name": "玄天剑", "type": "item", "description": "上古神兵"}
]

只返回确定的实体，不要臆造信息。"""

        try:
            content_response = await self._call_minimax_api(
                system_prompt=system_prompt,
                user_content=content,
                temperature=0.3,
                max_content_length=8000,
            )

            parsed = extract_json_from_response(content_response)
            return validate_entity_response(parsed)

        except ValueError as e:
            logger.warning(f"Failed to extract entities: {e}")
            return []

    async def _extract_relationships(
        self, content: str, entities: list[dict[str, Any]], db: Any
    ) -> list[dict[str, Any]]:
        """Extract relationships between entities."""
        system_prompt = """你是一位专业的小说文本分析专家。分析以下小说章节文本，提取实体之间的关系。

【重要】你必须返回一个有效的JSON数组，不要包含任何其他文字说明。
JSON格式要求：
- 使用双引号包裹所有字符串
- 字段名必须使用双引号

每个关系对象必须包含以下字段：
- source: 源实体名称（字符串，必填）
- target: 目标实体名称（字符串，必填）
- type: 关系类型（字符串，必填），可选值：enemy/ally/family/love/rival/dominates/owns/related等
- description: 关系描述（字符串，可为空）

示例返回格式：
[
    {"source": "张三", "target": "李四", "type": "enemy", "description": "世仇"},
    {"source": "张三", "target": "王五", "type": "ally", "description": "结拜兄弟"}
]"""

        try:
            content_response = await self._call_minimax_api(
                system_prompt=system_prompt,
                user_content=content,
                temperature=0.3,
                max_content_length=6000,
            )

            parsed = extract_json_from_response(content_response)
            return validate_relationship_response(parsed)

        except ValueError as e:
            logger.warning(f"Failed to extract relationships: {e}")
            return []

    async def _track_state_changes(
        self, content: str, entities: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Track state changes for characters/items."""
        system_prompt = """你是一位专业的小说文本分析专家。分析以下小说章节文本，提取实体状态变化。

【重要】你必须返回一个有效的JSON数组，不要包含任何其他文字说明。
JSON格式要求：
- 使用双引号包裹所有字符串
- 字段名必须使用双引号

每个状态变化对象必须包含以下字段：
- entity: 实体名称（字符串，必填）
- before_state: 变化前状态（字符串，必填）
- after_state: 变化后状态（字符串，必填）
- trigger: 触发原因（字符串，必填）

示例返回格式：
[
    {"entity": "张三", "before_state": "重伤", "after_state": "痊愈", "trigger": "服用九转还魂丹"},
    {"entity": "玄天剑", "before_state": "封印中", "after_state": "已解封", "trigger": "主人滴血认主"}
]"""

        try:
            content_response = await self._call_minimax_api(
                system_prompt=system_prompt,
                user_content=content,
                temperature=0.3,
                max_content_length=6000,
            )

            parsed = extract_json_from_response(content_response)
            return validate_state_change_response(parsed)

        except ValueError as e:
            logger.warning(f"Failed to track state changes: {e}")
            return []

    async def _slice_scenes(self, content: str) -> list[dict[str, Any]]:
        """Divide chapter into scenes with key information."""
        system_prompt = """你是一位专业的小说文本分析专家。将以下小说章节分割成场景。

【重要】你必须返回一个有效的JSON数组，不要包含任何其他文字说明。
JSON格式要求：
- 使用双引号包裹所有字符串
- 字段名必须使用双引号

每个场景对象必须包含以下字段：
- scene_number: 场景序号（数字，必填）
- location: 场景地点（字符串，必填）
- characters: 出场角色列表（字符串数组，必填）
- key_events: 关键事件列表（字符串数组，必填）
- mood: 场景基调/氛围（字符串，可为空）

示例返回格式：
[
    {"scene_number": 1, "location": "青云山巅", "characters": ["张三", "师父"], "key_events": ["张三拜师", "传授剑法"], "mood": "肃穆"},
    {"scene_number": 2, "location": "山脚小镇", "characters": ["张三", "小贩"], "key_events": ["购买药材", "遇到埋伏"], "mood": "紧张"}
]"""

        try:
            content_response = await self._call_minimax_api(
                system_prompt=system_prompt,
                user_content=content,
                temperature=0.4,
                max_content_length=6000,
            )

            parsed = extract_json_from_response(content_response)
            return validate_scene_response(parsed)

        except ValueError as e:
            logger.warning(f"Failed to slice scenes: {e}")
            return []

    async def _generate_summary(self, content: str) -> str:
        """Generate chapter summary."""
        system_prompt = """你是一位专业的小说文本分析专家。为以下小说章节生成简洁的摘要。

【重要】直接返回摘要文本，不要包含任何JSON格式或其他格式标记。
摘要要求：
- 200字以内
- 包含本章主要事件
- 包含关键转折点
- 包含对后续剧情的铺垫

直接输出摘要文本，不要用引号包裹，不要用JSON格式。"""

        try:
            content_response = await self._call_minimax_api(
                system_prompt=system_prompt,
                user_content=content,
                temperature=0.4,
                max_content_length=6000,
            )

            # Summary is plain text, just clean it up
            summary = content_response.strip()
            # Remove any markdown code blocks if present
            if summary.startswith("```"):
                lines = summary.split("\n")
                if lines[0].strip().startswith("```"):
                    summary = "\n".join(lines[1:])
                if summary.strip().endswith("```"):
                    summary = summary.strip()[:-3]

            return summary.strip()

        except ValueError as e:
            logger.warning(f"Failed to generate summary: {e}")
            return ""

    async def _persist_extracted_data(
        self,
        chapter_id: int,
        entities: list[dict[str, Any]],
        relationships: list[dict[str, Any]],
        db: Any,
    ) -> None:
        """Persist extracted entities and relationships to database."""
        for entity in entities:
            if entity.get("type") == "character":
                existing = (
                    db.query(Character)
                    .filter(Character.name == entity.get("name"))
                    .first()
                )
                if not existing:
                    character = Character(
                        name=entity.get("name", ""),
                        description=entity.get("description", ""),
                    )
                    db.add(character)

            elif entity.get("type") == "location":
                existing = (
                    db.query(Location)
                    .filter(Location.name == entity.get("name"))
                    .first()
                )
                if not existing:
                    location = Location(
                        name=entity.get("name", ""),
                        description=entity.get("description", ""),
                    )
                    db.add(location)

            elif entity.get("type") == "item":
                existing = (
                    db.query(Item).filter(Item.name == entity.get("name")).first()
                )
                if not existing:
                    item = Item(
                        name=entity.get("name", ""),
                        description=entity.get("description", ""),
                    )
                    db.add(item)

            elif entity.get("type") == "faction":
                existing = (
                    db.query(Faction)
                    .filter(Faction.name == entity.get("name"))
                    .first()
                )
                if not existing:
                    faction = Faction(
                        name=entity.get("name", ""),
                        description=entity.get("description", ""),
                    )
                    db.add(faction)

        for rel in relationships:
            source_name = rel.get("source")
            target_name = rel.get("target")
            if source_name and target_name:
                source_char = (
                    db.query(Character)
                    .filter(Character.name == source_name)
                    .first()
                )
                target_char = (
                    db.query(Character)
                    .filter(Character.name == target_name)
                    .first()
                )
                if source_char and target_char:
                    existing_rel = (
                        db.query(CharacterRelationship)
                        .filter(
                            CharacterRelationship.character_id == source_char.id,
                            CharacterRelationship.target_id == target_char.id,
                        )
                        .first()
                    )
                    if not existing_rel:
                        relationship = CharacterRelationship(
                            character_id=source_char.id,
                            target_id=target_char.id,
                            type=rel.get("type", "related"),
                            description=rel.get("description", ""),
                        )
                        db.add(relationship)

        db.commit()
