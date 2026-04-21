"""Data Agent - Extracts structured information from chapter content."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.entities import (
    Character,
    CharacterRelationship,
    Faction,
    IFLine,
    Item,
    Location,
    PlotThread,
)
from ..services.ai_service import AIService
from .utils import (
    BaseAgent,
    MiniMaxAPIClient,
    extract_json_from_response,
    validate_list_response,
)

logger = logging.getLogger(__name__)


@dataclass
class EntityAlias:
    """Represents a potential entity alias match."""

    canonical_name: str
    alias: str
    entity_type: str
    confidence: float
    disambiguation_context: str = ""


@dataclass
class EntityDelta:
    """Represents a single field-level change between old and new entity data."""

    entity_name: str
    entity_type: str
    field: str
    old_value: Any
    new_value: Any
    change_type: str  # "added", "modified", "removed"


@dataclass
class RelationGraphNode:
    """Node in the entity relation graph."""

    id: str
    name: str
    type: str
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class RelationGraphEdge:
    """Edge in the entity relation graph."""

    source: str
    target: str
    relation_type: str
    properties: dict[str, Any] = field(default_factory=dict)


@dataclass
class RelationGraph:
    """Entity relation graph for frontend visualization."""

    nodes: list[RelationGraphNode] = field(default_factory=list)
    edges: list[RelationGraphEdge] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize graph to dict for JSON response."""
        return {
            "nodes": [
                {
                    "id": n.id,
                    "name": n.name,
                    "type": n.type,
                    "properties": n.properties,
                }
                for n in self.nodes
            ],
            "edges": [
                {
                    "source": e.source,
                    "target": e.target,
                    "relation_type": e.relation_type,
                    "properties": e.properties,
                }
                for e in self.edges
            ],
        }


class DataAgent(BaseAgent):
    """Extracts structured information from chapter content.

    Capabilities:
    - 实体识别（角色、地点、物品等）
    - 状态变化追踪
    - 关系提取
    - 场景切片
    - 摘要生成

    Enhanced capabilities:
    - 实体别名消歧（同名/相似名实体上下文消歧）
    - 增量式数据更新（对比新旧，只生成差异）
    - 实体关系图谱构建（供前端可视化）
    """

    # Similarity threshold for alias detection
    ALIAS_SIMILARITY_THRESHOLD = 0.75

    def __init__(self, ai_service: AIService):
        super().__init__(ai_service)
        self.api_client = MiniMaxAPIClient(ai_service)

    # ------------------------------------------------------------------
    # Existing public API (backward compatible)
    # ------------------------------------------------------------------

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

    # ------------------------------------------------------------------
    # Enhanced: Entity alias disambiguation
    # ------------------------------------------------------------------

    async def disambiguate_aliases(
        self,
        extracted_entities: list[dict[str, Any]],
        db: AsyncSession,
        chapter_context: str = "",
    ) -> list[dict[str, Any]]:
        """Disambiguate entity aliases using database context.

        When same/similar names appear, uses stored entities + chapter context
        to resolve which canonical entity is being referenced.

        Args:
            extracted_entities: Raw extracted entities from AI
            db: Database session for canonical lookup
            chapter_context: Surrounding text for contextual disambiguation

        Returns:
            Entities with ``canonical_name`` and ``disambiguation`` fields
        """
        # Load all canonical entities from DB
        canonical: list[dict[str, Any]] = []
        for model, etype in [
            (Character, "character"),
            (Location, "location"),
            (Item, "item"),
            (Faction, "faction"),
        ]:
            result = await db.execute(select(model))
            for row in result.scalars().all():
                canonical.append({
                    "name": row.name,
                    "type": etype,
                    "description": getattr(row, "description", ""),
                    "id": row.id,
                })

        # Build alias map
        alias_matches = self._find_alias_matches(extracted_entities, canonical)

        resolved = []
        for entity in extracted_entities:
            name = entity.get("name", "")
            etype = entity.get("type", "")

            # Find best matching canonical entity
            best_match: EntityAlias | None = None
            for alias in alias_matches:
                if alias.alias == name and alias.entity_type == etype:
                    if best_match is None or alias.confidence > best_match.confidence:
                        best_match = alias

            enriched = dict(entity)
            if best_match and best_match.confidence >= self.ALIAS_SIMILARITY_THRESHOLD:
                enriched["canonical_name"] = best_match.canonical_name
                enriched["disambiguation_confidence"] = round(best_match.confidence, 3)
                enriched["disambiguation_context"] = best_match.disambiguation_context
            else:
                enriched["canonical_name"] = name
                enriched["disambiguation_confidence"] = 1.0
                enriched["disambiguation_context"] = "无歧义或新实体"

            resolved.append(enriched)

        return resolved

    def _find_alias_matches(
        self,
        extracted: list[dict[str, Any]],
        canonical: list[dict[str, Any]],
    ) -> list[EntityAlias]:
        """Find potential alias matches between extracted and canonical entities."""
        matches: list[EntityAlias] = []

        for ext in extracted:
            ext_name = ext.get("name", "")
            ext_type = ext.get("type", "")
            ext_desc = ext.get("description", "")

            for can in canonical:
                can_name = can["name"]
                can_type = can["type"]

                if ext_type != can_type:
                    continue

                # Exact match
                if ext_name == can_name:
                    matches.append(EntityAlias(
                        canonical_name=can_name,
                        alias=ext_name,
                        entity_type=ext_type,
                        confidence=1.0,
                        disambiguation_context=f"精确匹配: {can_name}",
                    ))
                    continue

                # Similarity match
                sim = SequenceMatcher(None, ext_name, can_name).ratio()
                if sim >= self.ALIAS_SIMILARITY_THRESHOLD:
                    # Boost confidence if descriptions overlap
                    desc_boost = 0.0
                    if ext_desc and can["description"]:
                        desc_sim = SequenceMatcher(None, ext_desc, can["description"]).ratio()
                        desc_boost = desc_sim * 0.1

                    matches.append(EntityAlias(
                        canonical_name=can_name,
                        alias=ext_name,
                        entity_type=ext_type,
                        confidence=min(sim + desc_boost, 1.0),
                        disambiguation_context=f"相似度匹配: {sim:.2f}",
                    ))

        return matches

    async def process_chapter_with_disambiguation(
        self, chapter_id: int, content: str, db: AsyncSession
    ) -> dict[str, Any]:
        """Process chapter with alias disambiguation enabled.

        Returns:
            Standard process_chapter output with ``entities`` enriched
            with canonical_name / disambiguation fields.
        """
        result = await self.process_chapter(chapter_id, content, db)
        result["entities"] = await self.disambiguate_aliases(
            result["entities"], db, content
        )
        result["disambiguation_enabled"] = True
        return result

    # ------------------------------------------------------------------
    # Enhanced: Incremental data updates
    # ------------------------------------------------------------------

    def compute_entity_delta(
        self,
        old_entities: list[dict[str, Any]],
        new_entities: list[dict[str, Any]],
    ) -> list[EntityDelta]:
        """Compute field-level deltas between old and new entity snapshots.

        Args:
            old_entities: Previous extraction result
            new_entities: Current extraction result

        Returns:
            List of EntityDelta representing only the changes
        """
        deltas: list[EntityDelta] = []

        old_map = {
            (e.get("name", ""), e.get("type", "")): e
            for e in old_entities
        }
        new_map = {
            (e.get("name", ""), e.get("type", "")): e
            for e in new_entities
        }

        all_keys = set(old_map.keys()) | set(new_map.keys())

        for key in all_keys:
            name, etype = key
            old_e = old_map.get(key, {})
            new_e = new_map.get(key, {})

            if not old_e:
                # Added
                for field_name, value in new_e.items():
                    deltas.append(EntityDelta(
                        entity_name=name,
                        entity_type=etype,
                        field=field_name,
                        old_value=None,
                        new_value=value,
                        change_type="added",
                    ))
            elif not new_e:
                # Removed
                for field_name, value in old_e.items():
                    deltas.append(EntityDelta(
                        entity_name=name,
                        entity_type=etype,
                        field=field_name,
                        old_value=value,
                        new_value=None,
                        change_type="removed",
                    ))
            else:
                # Compare fields
                all_fields = set(old_e.keys()) | set(new_e.keys())
                for field_name in all_fields:
                    old_val = old_e.get(field_name)
                    new_val = new_e.get(field_name)
                    if old_val != new_val:
                        deltas.append(EntityDelta(
                            entity_name=name,
                            entity_type=etype,
                            field=field_name,
                            old_value=old_val,
                            new_value=new_val,
                            change_type="modified",
                        ))

        return deltas

    async def process_chapter_incremental(
        self,
        chapter_id: int,
        content: str,
        db: AsyncSession,
        previous_entities: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Process chapter incrementally, only returning deltas vs previous.

        Args:
            chapter_id: Chapter ID
            content: Chapter text
            db: Database session
            previous_entities: Previous extraction snapshot (optional)

        Returns:
            Result dict with ``deltas`` and ``full_entities`` keys
        """
        full_result = await self.process_chapter(chapter_id, content, db)

        if previous_entities is None:
            full_result["deltas"] = []
            full_result["delta_count"] = 0
            full_result["incremental"] = True
            return full_result

        deltas = self.compute_entity_delta(
            previous_entities, full_result["entities"]
        )

        full_result["deltas"] = [
            {
                "entity_name": d.entity_name,
                "entity_type": d.entity_type,
                "field": d.field,
                "old_value": d.old_value,
                "new_value": d.new_value,
                "change_type": d.change_type,
            }
            for d in deltas
        ]
        full_result["delta_count"] = len(deltas)
        full_result["incremental"] = True
        return full_result

    # ------------------------------------------------------------------
    # Enhanced: Entity relation graph construction
    # ------------------------------------------------------------------

    async def build_relation_graph(
        self, db: AsyncSession, project_id: int | None = None
    ) -> RelationGraph:
        """Build entity relation graph from database for frontend visualization.

        Args:
            db: Database session
            project_id: Optional project filter

        Returns:
            RelationGraph with nodes and edges
        """
        graph = RelationGraph()
        node_map: dict[str, str] = {}  # (type:name) -> node_id

        def _add_node(name: str, node_type: str, props: dict[str, Any]) -> str:
            key = f"{node_type}:{name}"
            if key in node_map:
                return node_map[key]
            node_id = f"{node_type}_{len(graph.nodes)}"
            graph.nodes.append(RelationGraphNode(
                id=node_id,
                name=name,
                type=node_type,
                properties=props,
            ))
            node_map[key] = node_id
            return node_id

        # Characters
        char_stmt = select(Character)
        if project_id is not None:
            char_stmt = char_stmt.where(Character.project_id == project_id)
        result = await db.execute(char_stmt)
        for char in result.scalars().all():
            _add_node(char.name, "character", {
                "gender": char.gender,
                "cultivation_realm": char.cultivation_realm,
                "description": char.description,
            })

        # Locations
        loc_stmt = select(Location)
        if project_id is not None:
            loc_stmt = loc_stmt.where(Location.project_id == project_id)
        result = await db.execute(loc_stmt)
        for loc in result.scalars().all():
            _add_node(loc.name, "location", {
                "description": loc.description,
                "importance": loc.importance,
            })

        # Items
        item_stmt = select(Item)
        if project_id is not None:
            item_stmt = item_stmt.where(Item.project_id == project_id)
        result = await db.execute(item_stmt)
        for item in result.scalars().all():
            _add_node(item.name, "item", {
                "description": item.description,
                "owner": item.owner,
            })

        # Factions
        faction_stmt = select(Faction)
        if project_id is not None:
            faction_stmt = faction_stmt.where(Faction.project_id == project_id)
        result = await db.execute(faction_stmt)
        for faction in result.scalars().all():
            _add_node(faction.name, "faction", {
                "description": faction.description,
                "type": faction.type,
            })

        # Character relationships -> edges
        rel_stmt = select(CharacterRelationship)
        if project_id is not None:
            rel_stmt = rel_stmt.where(CharacterRelationship.project_id == project_id)
        result = await db.execute(rel_stmt)
        for rel in result.scalars().all():
            source_char = await db.execute(
                select(Character).where(Character.id == rel.character_id)
            )
            target_char = await db.execute(
                select(Character).where(Character.id == rel.target_id)
            )
            source = source_char.scalar_one_or_none()
            target = target_char.scalar_one_or_none()

            if source and target:
                source_id = node_map.get(f"character:{source.name}")
                target_id = node_map.get(f"character:{target.name}")
                if source_id and target_id:
                    graph.edges.append(RelationGraphEdge(
                        source=source_id,
                        target=target_id,
                        relation_type=rel.type,
                        properties={"description": rel.description},
                    ))

        # Item ownership edges
        item_stmt2 = select(Item)
        if project_id is not None:
            item_stmt2 = item_stmt2.where(Item.project_id == project_id)
        result = await db.execute(item_stmt2)
        for item in result.scalars().all():
            if item.owner:
                item_id = node_map.get(f"item:{item.name}")
                owner_id = node_map.get(f"character:{item.owner}")
                if item_id and owner_id:
                    graph.edges.append(RelationGraphEdge(
                        source=owner_id,
                        target=item_id,
                        relation_type="owns",
                        properties={},
                    ))

        return graph

    async def get_relation_graph_dict(
        self, db: AsyncSession, project_id: int | None = None
    ) -> dict[str, Any]:
        """Get relation graph as plain dict for JSON serialization."""
        graph = await self.build_relation_graph(db, project_id)
        return graph.to_dict()

    # ------------------------------------------------------------------
    # Convenience: all enhancements combined
    # ------------------------------------------------------------------

    async def process_chapter_enhanced(
        self,
        chapter_id: int,
        content: str,
        db: AsyncSession,
        previous_entities: list[dict[str, Any]] | None = None,
        project_id: int | None = None,
    ) -> dict[str, Any]:
        """Process chapter with all enhancements enabled.

        Args:
            chapter_id: Chapter ID
            content: Chapter text
            db: Database session
            previous_entities: Optional previous snapshot for incremental diff
            project_id: Optional project filter for relation graph

        Returns:
            Enhanced result with disambiguation, deltas, and relation graph
        """
        # Base extraction
        result = await self.process_chapter(chapter_id, content, db)

        # 1. Alias disambiguation
        result["entities"] = await self.disambiguate_aliases(
            result["entities"], db, content
        )
        result["disambiguation_enabled"] = True

        # 2. Incremental delta
        if previous_entities is not None:
            deltas = self.compute_entity_delta(
                previous_entities, result["entities"]
            )
            result["deltas"] = [
                {
                    "entity_name": d.entity_name,
                    "entity_type": d.entity_type,
                    "field": d.field,
                    "old_value": d.old_value,
                    "new_value": d.new_value,
                    "change_type": d.change_type,
                }
                for d in deltas
            ]
            result["delta_count"] = len(deltas)
        else:
            result["deltas"] = []
            result["delta_count"] = 0
        result["incremental"] = True

        # 3. Relation graph
        graph = await self.build_relation_graph(db, project_id)
        result["relation_graph"] = graph.to_dict()
        result["relation_graph_enabled"] = True

        result["enhanced"] = True
        return result
