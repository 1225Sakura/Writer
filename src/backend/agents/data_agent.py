"""Data Agent - Extracts structured information from chapter content."""

import logging
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entities import (
    Character,
    CharacterRelationship,
    PlotThread,
    Item,
    Location,
    Faction,
)
from ..services.ai_service import AIService
from .utils import (
    BaseAgent,
    MiniMaxAPIClient,
    extract_json_from_response,
    validate_list_response,
)

logger = logging.getLogger(__name__)


class DataAgent(BaseAgent):
    """Extracts structured information from chapter content.

    Capabilities:
    - 实体识别（角色、地点、物品等）
    - 状态变化追踪
    - 关系提取
    - 场景切片
    - 摘要生成
    """

    def __init__(self, ai_service: AIService):
        super().__init__(ai_service)
        self.api_client = MiniMaxAPIClient(ai_service)

    async def process_chapter(
        self, chapter_id: int, content: str, db: AsyncSession
    ) -> dict[str, Any]:
        """Process chapter content and extract structured data.

        Args:
            chapter_id: The chapter ID being processed
            content: The chapter text content
            db: Async database session

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
            parsed = await self.api_client.call_and_parse_json(
                system_prompt=system_prompt,
                user_content=content,
                temperature=0.3,
                max_content_length=8000,
            )
            return validate_list_response(
                parsed,
                required_keys=["name", "type", "description"],
                container_keys=["entities", "data", "results", "items"],
            )
        except ValueError as e:
            logger.warning(f"Failed to extract entities: {e}")
            return []

    async def _extract_relationships(
        self, content: str, entities: list[dict[str, Any]], db: AsyncSession
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
            parsed = await self.api_client.call_and_parse_json(
                system_prompt=system_prompt,
                user_content=content,
                temperature=0.3,
                max_content_length=6000,
            )
            return validate_list_response(
                parsed,
                required_keys=["source", "target", "type", "description"],
                container_keys=["relationships", "relations", "data", "results"],
            )
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
            parsed = await self.api_client.call_and_parse_json(
                system_prompt=system_prompt,
                user_content=content,
                temperature=0.3,
                max_content_length=6000,
            )
            return validate_list_response(
                parsed,
                required_keys=["entity", "before_state", "after_state", "trigger"],
                container_keys=["state_changes", "changes", "data", "results"],
            )
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
            parsed = await self.api_client.call_and_parse_json(
                system_prompt=system_prompt,
                user_content=content,
                temperature=0.4,
                max_content_length=6000,
            )
            if not isinstance(parsed, list):
                if isinstance(parsed, dict):
                    for key in ["scenes", "data", "results"]:
                        if key in parsed and isinstance(parsed[key], list):
                            parsed = parsed[key]
                            break
                if not isinstance(parsed, list):
                    raise ValueError(f"Expected list response, got {type(parsed).__name__}")

            validated = []
            for item in parsed:
                if not isinstance(item, dict):
                    continue
                validated.append({
                    "scene_number": item.get("scene_number", len(validated) + 1),
                    "location": str(item.get("location", "")),
                    "characters": item.get("characters", []) if isinstance(item.get("characters"), list) else [],
                    "key_events": item.get("key_events", []) if isinstance(item.get("key_events"), list) else [],
                    "mood": str(item.get("mood", "")),
                })
            return validated
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
            summary = await self.api_client.call(
                system_prompt=system_prompt,
                user_content=content,
                temperature=0.4,
                max_content_length=6000,
            )

            # Summary is plain text, just clean it up
            summary = summary.strip()
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
        db: AsyncSession,
    ) -> None:
        """Persist extracted entities and relationships to database."""
        for entity in entities:
            if entity.get("type") == "character":
                result = await db.execute(
                    select(Character).where(Character.name == entity.get("name"))
                )
                existing = result.scalar_one_or_none()
                if not existing:
                    character = Character(
                        name=entity.get("name", ""),
                        description=entity.get("description", ""),
                    )
                    db.add(character)

            elif entity.get("type") == "location":
                result = await db.execute(
                    select(Location).where(Location.name == entity.get("name"))
                )
                existing = result.scalar_one_or_none()
                if not existing:
                    location = Location(
                        name=entity.get("name", ""),
                        description=entity.get("description", ""),
                    )
                    db.add(location)

            elif entity.get("type") == "item":
                result = await db.execute(
                    select(Item).where(Item.name == entity.get("name"))
                )
                existing = result.scalar_one_or_none()
                if not existing:
                    item = Item(
                        name=entity.get("name", ""),
                        description=entity.get("description", ""),
                    )
                    db.add(item)

            elif entity.get("type") == "faction":
                result = await db.execute(
                    select(Faction).where(Faction.name == entity.get("name"))
                )
                existing = result.scalar_one_or_none()
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
                result = await db.execute(
                    select(Character).where(Character.name == source_name)
                )
                source_char = result.scalar_one_or_none()

                result = await db.execute(
                    select(Character).where(Character.name == target_name)
                )
                target_char = result.scalar_one_or_none()

                if source_char and target_char:
                    result = await db.execute(
                        select(CharacterRelationship).where(
                            CharacterRelationship.character_id == source_char.id,
                            CharacterRelationship.target_id == target_char.id,
                        )
                    )
                    existing_rel = result.scalar_one_or_none()
                    if not existing_rel:
                        relationship = CharacterRelationship(
                            character_id=source_char.id,
                            target_id=target_char.id,
                            type=rel.get("type", "related"),
                            description=rel.get("description", ""),
                        )
                        db.add(relationship)

        await db.flush()
