"""Tests for agents.data_agent — DataAgent and related dataclasses."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, MagicMock, patch, PropertyMock

import pytest

from backend.agents.data_agent import (
    DataAgent,
    EntityAlias,
    EntityDelta,
    RelationGraph,
    RelationGraphEdge,
    RelationGraphNode,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_mock_db():
    """Create a mock AsyncSession with chainable query support."""
    db = AsyncMock()
    # Default: no existing entities found
    result_mock = MagicMock()
    result_mock.scalar_one_or_none.return_value = None
    result_mock.scalars.return_value.all.return_value = []
    db.execute.return_value = result_mock
    return db


def _make_data_agent() -> DataAgent:
    """Create a DataAgent with mocked dependencies.

    DataAgent inherits from BaseAgent (abstract) which requires an `execute`
    method. We patch ABC.__init_subclass__ / __abstractmethods__ so we can
    instantiate it without implementing execute, then mock api_client.
    """
    # Temporarily make DataAgent concrete by clearing abstract methods
    original = DataAgent.__abstractmethods__
    DataAgent.__abstractmethods__ = frozenset()
    try:
        provider = MagicMock()
        provider.name = "test_provider"
        event_bus = AsyncMock()
        ai_service = MagicMock()
        agent = DataAgent(provider=provider, event_bus=event_bus, ai_service=ai_service)
    finally:
        DataAgent.__abstractmethods__ = original
    # Mock the api_client (MiniMaxAPIClient) via DatabaseMixin
    agent._api_client = AsyncMock()
    return agent


def _sample_entities():
    return [
        {"name": "Alice", "type": "character", "description": "protagonist"},
        {"name": "Sword", "type": "item", "description": "magic blade"},
        {"name": "Castle", "type": "location", "description": "ancient fortress"},
    ]


def _sample_relationships():
    return [
        {"source": "Alice", "target": "Bob", "type": "friend", "description": "best friends"},
    ]


# ===========================================================================
# Dataclass tests
# ===========================================================================

class TestEntityAlias:
    def test_creation(self):
        alias = EntityAlias(
            canonical_name="Alice",
            alias="Alicia",
            entity_type="character",
            confidence=0.85,
        )
        assert alias.canonical_name == "Alice"
        assert alias.confidence == 0.85
        assert alias.disambiguation_context == ""


class TestEntityDelta:
    def test_creation(self):
        delta = EntityDelta(
            entity_name="Alice",
            entity_type="character",
            field="description",
            old_value="old",
            new_value="new",
            change_type="modified",
        )
        assert delta.change_type == "modified"


class TestRelationGraphNode:
    def test_defaults(self):
        node = RelationGraphNode(id="c_0", name="Alice", type="character")
        assert node.properties == {}

    def test_with_properties(self):
        node = RelationGraphNode(id="c_0", name="Alice", type="character", properties={"gender": "F"})
        assert node.properties["gender"] == "F"


class TestRelationGraphEdge:
    def test_defaults(self):
        edge = RelationGraphEdge(source="c_0", target="c_1", relation_type="friend")
        assert edge.properties == {}


class TestRelationGraph:
    def test_empty_graph_to_dict(self):
        graph = RelationGraph()
        d = graph.to_dict()
        assert d == {"nodes": [], "edges": []}

    def test_to_dict_with_data(self):
        graph = RelationGraph(
            nodes=[RelationGraphNode(id="c_0", name="Alice", type="character", properties={})],
            edges=[RelationGraphEdge(source="c_0", target="c_1", relation_type="friend", properties={})],
        )
        d = graph.to_dict()
        assert len(d["nodes"]) == 1
        assert d["nodes"][0]["name"] == "Alice"
        assert len(d["edges"]) == 1
        assert d["edges"][0]["relation_type"] == "friend"


# ===========================================================================
# DataAgent — _extract_entities
# ===========================================================================

class TestExtractEntities:
    @pytest.mark.asyncio
    async def test_success(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = [
            {"name": "Alice", "type": "character", "description": "hero"}
        ]
        result = await agent._extract_entities("chapter text")
        assert len(result) == 1
        assert result[0]["name"] == "Alice"

    @pytest.mark.asyncio
    async def test_returns_empty_on_value_error(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.side_effect = ValueError("bad json")
        result = await agent._extract_entities("text")
        assert result == []


# ===========================================================================
# DataAgent — _extract_relationships
# ===========================================================================

class TestExtractRelationships:
    @pytest.mark.asyncio
    async def test_success(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = [
            {"source": "A", "target": "B", "type": "ally", "description": "friends"}
        ]
        db = _make_mock_db()
        result = await agent._extract_relationships("text", [], db)
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_returns_empty_on_error(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.side_effect = ValueError("fail")
        db = _make_mock_db()
        result = await agent._extract_relationships("text", [], db)
        assert result == []


# ===========================================================================
# DataAgent — _track_state_changes
# ===========================================================================

class TestTrackStateChanges:
    @pytest.mark.asyncio
    async def test_success(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = [
            {"entity": "Alice", "before_state": "alive", "after_state": "wounded", "trigger": "battle"}
        ]
        result = await agent._track_state_changes("text", [])
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_returns_empty_on_error(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.side_effect = ValueError("fail")
        result = await agent._track_state_changes("text", [])
        assert result == []


# ===========================================================================
# DataAgent — _slice_scenes
# ===========================================================================

class TestSliceScenes:
    @pytest.mark.asyncio
    async def test_success_list_response(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = [
            {"scene_number": 1, "location": "forest", "characters": ["Alice"], "key_events": ["fight"], "mood": "tense"}
        ]
        result = await agent._slice_scenes("text")
        assert len(result) == 1
        assert result[0]["location"] == "forest"

    @pytest.mark.asyncio
    async def test_success_dict_with_scenes_key(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = {
            "scenes": [{"scene_number": 1, "location": "castle", "characters": [], "key_events": [], "mood": "calm"}]
        }
        result = await agent._slice_scenes("text")
        assert len(result) == 1

    @pytest.mark.asyncio
    async def test_returns_empty_on_error(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.side_effect = ValueError("fail")
        result = await agent._slice_scenes("text")
        assert result == []

    @pytest.mark.asyncio
    async def test_filters_non_dict_items(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = [
            "not a dict",
            {"scene_number": 1, "location": "x", "characters": [], "key_events": [], "mood": ""},
        ]
        result = await agent._slice_scenes("text")
        assert len(result) == 1


# ===========================================================================
# DataAgent — _generate_summary
# ===========================================================================

class TestGenerateSummary:
    @pytest.mark.asyncio
    async def test_success(self):
        agent = _make_data_agent()
        agent._api_client.call.return_value = "A brave hero fights a dragon."
        result = await agent._generate_summary("chapter text")
        assert result == "A brave hero fights a dragon."

    @pytest.mark.asyncio
    async def test_strips_markdown_code_blocks(self):
        agent = _make_data_agent()
        agent._api_client.call.return_value = "```json\nsummary text\n```"
        result = await agent._generate_summary("text")
        assert "summary text" in result

    @pytest.mark.asyncio
    async def test_returns_empty_on_error(self):
        agent = _make_data_agent()
        agent._api_client.call.side_effect = ValueError("fail")
        result = await agent._generate_summary("text")
        assert result == ""


# ===========================================================================
# DataAgent — process_chapter
# ===========================================================================

class TestProcessChapter:
    @pytest.mark.asyncio
    async def test_full_pipeline(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = [
            {"name": "Alice", "type": "character", "description": "hero"}
        ]
        agent._api_client.call.return_value = "Summary text"
        db = _make_mock_db()

        result = await agent.process_chapter(1, "chapter content", db)
        assert result["chapter_id"] == 1
        assert "entities" in result
        assert "relationships" in result
        assert "state_changes" in result
        assert "scenes" in result
        assert "summary" in result


# ===========================================================================
# DataAgent — _persist_extracted_data
# ===========================================================================

class TestPersistExtractedData:
    @pytest.mark.asyncio
    async def test_persist_character_new(self):
        agent = _make_data_agent()
        db = _make_mock_db()
        # No existing character
        db.execute.return_value.scalar_one_or_none.return_value = None

        entities = [{"name": "Alice", "type": "character", "description": "hero"}]
        await agent._persist_extracted_data(1, entities, [], db)
        db.add.assert_called()
        db.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_persist_location_new(self):
        agent = _make_data_agent()
        db = _make_mock_db()
        db.execute.return_value.scalar_one_or_none.return_value = None

        entities = [{"name": "Castle", "type": "location", "description": "fortress"}]
        await agent._persist_extracted_data(1, entities, [], db)
        db.add.assert_called()

    @pytest.mark.asyncio
    async def test_persist_item_new(self):
        agent = _make_data_agent()
        db = _make_mock_db()
        db.execute.return_value.scalar_one_or_none.return_value = None

        entities = [{"name": "Sword", "type": "item", "description": "blade"}]
        await agent._persist_extracted_data(1, entities, [], db)
        db.add.assert_called()

    @pytest.mark.asyncio
    async def test_persist_faction_new(self):
        agent = _make_data_agent()
        db = _make_mock_db()
        db.execute.return_value.scalar_one_or_none.return_value = None

        entities = [{"name": "Guild", "type": "faction", "description": "merchants"}]
        await agent._persist_extracted_data(1, entities, [], db)
        db.add.assert_called()

    @pytest.mark.asyncio
    async def test_persist_skips_existing_entity(self):
        agent = _make_data_agent()
        db = _make_mock_db()
        # Simulate existing entity
        db.execute.return_value.scalar_one_or_none.return_value = MagicMock()

        entities = [{"name": "Alice", "type": "character", "description": "hero"}]
        await agent._persist_extracted_data(1, entities, [], db)
        db.add.assert_not_called()

    @pytest.mark.asyncio
    async def test_persist_relationship(self):
        agent = _make_data_agent()
        db = _make_mock_db()

        # First call: source character lookup -> found
        # Second call: target character lookup -> found
        # Third call: existing relationship check -> not found
        source_char = MagicMock()
        source_char.id = 1
        target_char = MagicMock()
        target_char.id = 2

        call_count = 0

        def side_effect(stmt):
            nonlocal call_count
            result_mock = MagicMock()
            call_count += 1
            if call_count <= 2:
                # Character lookups
                result_mock.scalar_one_or_none.return_value = source_char if call_count == 1 else target_char
            else:
                # Relationship check
                result_mock.scalar_one_or_none.return_value = None
            return result_mock

        db.execute.side_effect = side_effect

        relationships = [{"source": "Alice", "target": "Bob", "type": "friend", "description": "pals"}]
        await agent._persist_extracted_data(1, [], relationships, db)
        db.add.assert_called()
        db.flush.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_persist_relationship_skip_when_char_missing(self):
        agent = _make_data_agent()
        db = _make_mock_db()
        db.execute.return_value.scalar_one_or_none.return_value = None

        relationships = [{"source": "Ghost", "target": "Nobody", "type": "enemy"}]
        await agent._persist_extracted_data(1, [], relationships, db)
        db.add.assert_not_called()


# ===========================================================================
# DataAgent — _find_alias_matches
# ===========================================================================

class TestFindAliasMatches:
    def test_exact_match(self):
        agent = _make_data_agent()
        extracted = [{"name": "Alice", "type": "character", "description": "hero"}]
        canonical = [{"name": "Alice", "type": "character", "description": "hero", "id": 1}]

        matches = agent._find_alias_matches(extracted, canonical)
        assert len(matches) == 1
        assert matches[0].confidence == 1.0
        assert matches[0].canonical_name == "Alice"

    def test_similarity_match(self):
        agent = _make_data_agent()
        # "张小凡" vs "张小凡凡" — high similarity in Chinese names
        # Use names that SequenceMatcher rates >= 0.75
        extracted = [{"name": "张三丰", "type": "character", "description": "warrior"}]
        canonical = [{"name": "张三", "type": "character", "description": "warrior", "id": 1}]

        matches = agent._find_alias_matches(extracted, canonical)
        assert len(matches) == 1
        assert matches[0].confidence >= agent.ALIAS_SIMILARITY_THRESHOLD

    def test_no_match_different_type(self):
        agent = _make_data_agent()
        extracted = [{"name": "Alice", "type": "character", "description": ""}]
        canonical = [{"name": "Alice", "type": "location", "description": "", "id": 1}]

        matches = agent._find_alias_matches(extracted, canonical)
        assert len(matches) == 0

    def test_no_match_different_name(self):
        agent = _make_data_agent()
        extracted = [{"name": "Bob", "type": "character", "description": ""}]
        canonical = [{"name": "Alice", "type": "character", "description": "", "id": 1}]

        matches = agent._find_alias_matches(extracted, canonical)
        assert len(matches) == 0


# ===========================================================================
# DataAgent — disambiguate_aliases
# ===========================================================================

class TestDisambiguateAliases:
    @pytest.mark.asyncio
    async def test_exact_match_resolved(self):
        agent = _make_data_agent()
        db = _make_mock_db()

        # Mock DB returning canonical entities
        char = MagicMock()
        char.name = "Alice"
        char.description = "hero"
        char.id = 1
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [char]
        db.execute.return_value = result_mock

        entities = [{"name": "Alice", "type": "character", "description": "hero"}]
        resolved = await agent.disambiguate_aliases(entities, db)

        assert resolved[0]["canonical_name"] == "Alice"
        assert resolved[0]["disambiguation_confidence"] == 1.0

    @pytest.mark.asyncio
    async def test_new_entity_no_match(self):
        agent = _make_data_agent()
        db = _make_mock_db()
        # No canonical entities in DB
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db.execute.return_value = result_mock

        entities = [{"name": "NewGuy", "type": "character", "description": "stranger"}]
        resolved = await agent.disambiguate_aliases(entities, db)

        assert resolved[0]["canonical_name"] == "NewGuy"
        assert resolved[0]["disambiguation_confidence"] == 1.0


# ===========================================================================
# DataAgent — compute_entity_delta
# ===========================================================================

class TestComputeEntityDelta:
    def test_added_entity(self):
        agent = _make_data_agent()
        old = []
        new = [{"name": "Alice", "type": "character", "description": "hero"}]

        deltas = agent.compute_entity_delta(old, new)
        assert len(deltas) > 0
        assert all(d.change_type == "added" for d in deltas)

    def test_removed_entity(self):
        agent = _make_data_agent()
        old = [{"name": "Alice", "type": "character", "description": "hero"}]
        new = []

        deltas = agent.compute_entity_delta(old, new)
        assert len(deltas) > 0
        assert all(d.change_type == "removed" for d in deltas)

    def test_modified_entity(self):
        agent = _make_data_agent()
        old = [{"name": "Alice", "type": "character", "description": "old desc"}]
        new = [{"name": "Alice", "type": "character", "description": "new desc"}]

        deltas = agent.compute_entity_delta(old, new)
        assert len(deltas) == 1
        assert deltas[0].change_type == "modified"
        assert deltas[0].field == "description"
        assert deltas[0].old_value == "old desc"
        assert deltas[0].new_value == "new desc"

    def test_no_changes(self):
        agent = _make_data_agent()
        entities = [{"name": "Alice", "type": "character", "description": "hero"}]

        deltas = agent.compute_entity_delta(entities, entities)
        assert len(deltas) == 0


# ===========================================================================
# DataAgent — process_chapter_incremental
# ===========================================================================

class TestProcessChapterIncremental:
    @pytest.mark.asyncio
    async def test_no_previous_entities(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = [
            {"name": "Alice", "type": "character", "description": "hero"}
        ]
        agent._api_client.call.return_value = "Summary"
        db = _make_mock_db()

        result = await agent.process_chapter_incremental(1, "text", db, previous_entities=None)
        assert result["incremental"] is True
        assert result["delta_count"] == 0
        assert result["deltas"] == []

    @pytest.mark.asyncio
    async def test_with_previous_entities(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = [
            {"name": "Alice", "type": "character", "description": "new desc"}
        ]
        agent._api_client.call.return_value = "Summary"
        db = _make_mock_db()

        prev = [{"name": "Alice", "type": "character", "description": "old desc"}]
        result = await agent.process_chapter_incremental(1, "text", db, previous_entities=prev)
        assert result["incremental"] is True
        assert result["delta_count"] >= 1


# ===========================================================================
# DataAgent — build_relation_graph
# ===========================================================================

class TestBuildRelationGraph:
    @pytest.mark.asyncio
    async def test_empty_db(self):
        agent = _make_data_agent()
        db = _make_mock_db()
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db.execute.return_value = result_mock

        graph = await agent.build_relation_graph(db)
        assert isinstance(graph, RelationGraph)
        assert len(graph.nodes) == 0
        assert len(graph.edges) == 0

    @pytest.mark.asyncio
    async def test_with_characters(self):
        agent = _make_data_agent()
        db = _make_mock_db()

        char = MagicMock()
        char.name = "Alice"
        char.gender = "F"
        char.cultivation_realm = "golden_core"
        char.description = "hero"

        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = [char]
        db.execute.return_value = result_mock

        graph = await agent.build_relation_graph(db)
        assert len(graph.nodes) >= 1
        assert graph.nodes[0].name == "Alice"

    @pytest.mark.asyncio
    async def test_with_project_filter(self):
        agent = _make_data_agent()
        db = _make_mock_db()
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db.execute.return_value = result_mock

        graph = await agent.build_relation_graph(db, project_id=42)
        assert isinstance(graph, RelationGraph)


# ===========================================================================
# DataAgent — get_relation_graph_dict
# ===========================================================================

class TestGetRelationGraphDict:
    @pytest.mark.asyncio
    async def test_returns_dict(self):
        agent = _make_data_agent()
        db = _make_mock_db()
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db.execute.return_value = result_mock

        d = await agent.get_relation_graph_dict(db)
        assert isinstance(d, dict)
        assert "nodes" in d
        assert "edges" in d


# ===========================================================================
# DataAgent — process_chapter_with_disambiguation
# ===========================================================================

class TestProcessChapterWithDisambiguation:
    @pytest.mark.asyncio
    async def test_adds_disambiguation_fields(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = [
            {"name": "Alice", "type": "character", "description": "hero"}
        ]
        agent._api_client.call.return_value = "Summary"
        db = _make_mock_db()
        # No canonical entities
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db.execute.return_value = result_mock

        result = await agent.process_chapter_with_disambiguation(1, "text", db)
        assert result["disambiguation_enabled"] is True
        assert "canonical_name" in result["entities"][0]


# ===========================================================================
# DataAgent — process_chapter_enhanced
# ===========================================================================

class TestProcessChapterEnhanced:
    @pytest.mark.asyncio
    async def test_enhanced_result(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = [
            {"name": "Alice", "type": "character", "description": "hero"}
        ]
        agent._api_client.call.return_value = "Summary"
        db = _make_mock_db()
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db.execute.return_value = result_mock

        result = await agent.process_chapter_enhanced(1, "text", db)
        assert result["enhanced"] is True
        assert result["disambiguation_enabled"] is True
        assert result["incremental"] is True
        assert result["relation_graph_enabled"] is True
        assert "relation_graph" in result

    @pytest.mark.asyncio
    async def test_enhanced_with_previous_entities(self):
        agent = _make_data_agent()
        agent._api_client.call_and_parse_json.return_value = [
            {"name": "Alice", "type": "character", "description": "updated"}
        ]
        agent._api_client.call.return_value = "Summary"
        db = _make_mock_db()
        result_mock = MagicMock()
        result_mock.scalars.return_value.all.return_value = []
        db.execute.return_value = result_mock

        prev = [{"name": "Alice", "type": "character", "description": "old"}]
        result = await agent.process_chapter_enhanced(1, "text", db, previous_entities=prev)
        assert result["delta_count"] >= 1
        assert result["enhanced"] is True
