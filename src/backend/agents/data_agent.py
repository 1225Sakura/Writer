"""Data Agent - Extracts structured information from chapter content."""

from typing import Any

from ..models.entities import (
    Character,
    CharacterRelationship,
    PlotThread,
    Item,
    Location,
    Faction,
)
from ..services.ai_service import AIService


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

    async def _extract_entities(self, content: str) -> list[dict[str, Any]]:
        """Extract named entities from chapter content."""
        system_prompt = """从以下小说章节文本中提取所有实体信息。以JSON数组格式返回，每个实体包含：
- name: 实体名称
- type: 实体类型（character/location/item/faction/concept）
- description: 实体描述或特征

只返回确定的实体，不要臆造信息。"""

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
                        {"role": "user", "content": content[:8000]},
                    ],
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()
            result = response.json()

            content_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")

            import json

            try:
                entities = json.loads(content_text)
            except json.JSONDecodeError:
                entities = []

            return entities if isinstance(entities, list) else []

    async def _extract_relationships(
        self, content: str, entities: list[dict[str, Any]], db: Any
    ) -> list[dict[str, Any]]:
        """Extract relationships between entities."""
        system_prompt = """分析以下小说章节文本，提取实体之间的关系。以JSON数组格式返回，每个关系包含：
- source: 源实体名称
- target: 目标实体名称
- type: 关系类型（enemy/ally/family/love/rival/dominates/owns等）
- description: 关系描述"""

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
                        {"role": "user", "content": content[:6000]},
                    ],
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()
            result = response.json()

            content_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")

            import json

            try:
                relationships = json.loads(content_text)
            except json.JSONDecodeError:
                relationships = []

            return relationships if isinstance(relationships, list) else []

    async def _track_state_changes(
        self, content: str, entities: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Track state changes for characters/items."""
        system_prompt = """分析以下小说章节文本，提取实体状态变化。以JSON数组格式返回，每个变化包含：
- entity: 实体名称
- before_state: 变化前状态
- after_state: 变化后状态
- trigger: 触发原因"""

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
                        {"role": "user", "content": content[:6000]},
                    ],
                    "temperature": 0.3,
                },
            )
            response.raise_for_status()
            result = response.json()

            content_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")

            import json

            try:
                state_changes = json.loads(content_text)
            except json.JSONDecodeError:
                state_changes = []

            return state_changes if isinstance(state_changes, list) else []

    async def _slice_scenes(self, content: str) -> list[dict[str, Any]]:
        """Divide chapter into scenes with key information."""
        system_prompt = """将以下小说章节分割成场景。以JSON数组格式返回，每个场景包含：
- scene_number: 场景序号
- location: 场景地点
- characters: 出场角色列表
- key_events: 关键事件列表
- mood: 场景基调/氛围"""

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
                        {"role": "user", "content": content[:6000]},
                    ],
                    "temperature": 0.4,
                },
            )
            response.raise_for_status()
            result = response.json()

            content_text = result.get("choices", [{}])[0].get("message", {}).get("content", "")

            import json

            try:
                scenes = json.loads(content_text)
            except json.JSONDecodeError:
                scenes = []

            return scenes if isinstance(scenes, list) else []

    async def _generate_summary(self, content: str) -> str:
        """Generate chapter summary."""
        system_prompt = """为以下小说章节生成简洁的摘要（200字以内），包含：
- 本章主要事件
- 关键转折点
- 对后续剧情的铺垫"""

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
                        {"role": "user", "content": content[:6000]},
                    ],
                    "temperature": 0.4,
                },
            )
            response.raise_for_status()
            result = response.json()

            summary = result.get("choices", [{}])[0].get("message", {}).get("content", "")
            return summary.strip()

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
