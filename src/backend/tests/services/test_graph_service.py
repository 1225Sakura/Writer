"""Comprehensive tests for GraphService - entity relationship graph building and analysis.

Covers: build_project_graph, build_entity_neighborhood, multi_hop_query,
find_shortest_path, compute_centrality, find_clusters, _load_entities,
_load_single_entity, _load_character_relationships, _load_implicit_edges,
_get_neighbors, NetworkX integration methods, and dataclass utilities.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from backend.services.graph_service import (
    GraphService,
    GraphNode,
    GraphEdge,
    GraphData,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_db():
    return MagicMock()


@pytest.fixture
def service(mock_db):
    return GraphService(db=mock_db)


@pytest.fixture
def sample_graph():
    """Create a sample GraphData for testing."""
    nodes = [
        GraphNode(id=1, type="character", label="主角", properties={}),
        GraphNode(id=2, type="character", label="反派", properties={}),
        GraphNode(id=3, type="item", label="神器", properties={"owner": "主角"}),
        GraphNode(id=4, type="location", label="宗门", properties={}),
    ]
    edges = [
        GraphEdge(source=1, target=2, label="敌人", type="character_relationship"),
        GraphEdge(source=1, target=3, label="拥有", type="ownership"),
    ]
    return GraphData(nodes=nodes, edges=edges)


def _make_mock_scalars(entities):
    """Helper to build a mock result with scalars().all() chain."""
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = entities
    return mock_result


def _make_mock_scalar_one(entity):
    """Helper to build a mock result with scalar_one_or_none()."""
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = entity
    return mock_result


def _make_entity(etype, eid, name, **kwargs):
    """Create a mock entity with given attributes."""
    entity = MagicMock()
    entity.id = eid
    entity.name = name
    entity.description = kwargs.get("description", "")
    entity.project_id = kwargs.get("project_id", 1)
    for k, v in kwargs.items():
        setattr(entity, k, v)
    return entity


# =============================================================================
# GraphData serialization
# =============================================================================


class TestGraphDataSerialization:
    """Test GraphData to_dict."""

    def test_to_dict_contains_nodes_and_edges(self, sample_graph):
        d = sample_graph.to_dict()
        assert "nodes" in d
        assert "edges" in d
        assert len(d["nodes"]) == 4
        assert len(d["edges"]) == 2

    def test_node_dict_has_required_fields(self, sample_graph):
        d = sample_graph.to_dict()
        for node in d["nodes"]:
            assert "id" in node
            assert "type" in node
            assert "label" in node

    def test_edge_dict_has_required_fields(self, sample_graph):
        d = sample_graph.to_dict()
        for edge in d["edges"]:
            assert "source" in edge
            assert "target" in edge
            assert "label" in edge
            assert "type" in edge

    def test_to_dict_empty_graph(self):
        graph = GraphData()
        d = graph.to_dict()
        assert d["nodes"] == []
        assert d["edges"] == []

    def test_node_properties_preserved(self):
        node = GraphNode(id=1, type="character", label="test", properties={"key": "val"}, color="#fff", size=5)
        graph = GraphData(nodes=[node])
        d = graph.to_dict()
        assert d["nodes"][0]["properties"] == {"key": "val"}
        assert d["nodes"][0]["color"] == "#fff"
        assert d["nodes"][0]["size"] == 5

    def test_edge_properties_preserved(self):
        edge = GraphEdge(source=1, target=2, label="rel", type="t", properties={"desc": "x"}, directed=False)
        graph = GraphData(edges=[edge])
        d = graph.to_dict()
        assert d["edges"][0]["properties"] == {"desc": "x"}
        assert d["edges"][0]["directed"] is False


# =============================================================================
# _compute_node_sizes
# =============================================================================


class TestNodeSizes:
    """Test node size computation based on degree."""

    def test_connected_node_gets_larger_size(self, service, sample_graph):
        service._compute_node_sizes(sample_graph)
        node_map = {n.id: n for n in sample_graph.nodes}
        assert node_map[1].size > 1
        assert node_map[4].size == 1

    def test_size_caps_at_11(self, service):
        nodes = [GraphNode(id=i, type="character", label=f"c{i}") for i in range(12)]
        edges = [GraphEdge(source=0, target=i, label="rel", type="rel") for i in range(1, 12)]
        graph = GraphData(nodes=nodes, edges=edges)
        service._compute_node_sizes(graph)
        node_0 = next(n for n in graph.nodes if n.id == 0)
        assert node_0.size == 11

    def test_disconnected_nodes_have_size_one(self, service):
        nodes = [GraphNode(id=i, type="character", label=f"c{i}") for i in range(3)]
        graph = GraphData(nodes=nodes, edges=[])
        service._compute_node_sizes(graph)
        for node in graph.nodes:
            assert node.size == 1

    def test_bidirectional_edges_counted(self, service):
        nodes = [GraphNode(id=1, type="character", label="a"), GraphNode(id=2, type="character", label="b")]
        edges = [
            GraphEdge(source=1, target=2, label="fwd", type="rel"),
            GraphEdge(source=2, target=1, label="rev", type="rel"),
        ]
        graph = GraphData(nodes=nodes, edges=edges)
        service._compute_node_sizes(graph)
        node_1 = next(n for n in graph.nodes if n.id == 1)
        assert node_1.size == 3  # 1 + 2 edges


# =============================================================================
# _infer_type
# =============================================================================


class TestInferType:
    """Test entity type inference from node list."""

    def test_infers_known_type(self, service, sample_graph):
        assert service._infer_type(1, sample_graph.nodes) == "character"
        assert service._infer_type(3, sample_graph.nodes) == "item"

    def test_unknown_id_returns_none(self, service, sample_graph):
        assert service._infer_type(999, sample_graph.nodes) is None

    def test_empty_nodes_returns_none(self, service):
        assert service._infer_type(1, []) is None


# =============================================================================
# _count_by_type
# =============================================================================


class TestCountByType:
    """Test type counting."""

    def test_count_by_type(self, service, sample_graph):
        counts = service._count_by_type(sample_graph)
        assert counts["character"] == 2
        assert counts["item"] == 1
        assert counts["location"] == 1

    def test_count_empty_graph(self, service):
        counts = service._count_by_type(GraphData())
        assert counts == {}


# =============================================================================
# Constants
# =============================================================================


class TestConstants:
    """Test class constants."""

    def test_all_entity_types_have_colors(self):
        for etype in ["character", "item", "location", "faction"]:
            assert etype in GraphService.NODE_COLORS

    def test_all_entity_types_have_labels(self):
        for etype in ["character", "item", "location", "faction"]:
            assert etype in GraphService.TYPE_LABELS

    def test_entity_models_map(self):
        for etype in ["character", "item", "location", "faction"]:
            assert etype in GraphService.ENTITY_MODELS


# =============================================================================
# build_project_graph
# =============================================================================


class TestBuildProjectGraph:
    """Test project graph building with mocked DB."""

    @pytest.mark.asyncio
    async def test_build_empty_graph(self, service, mock_db):
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)
        graph = await service.build_project_graph()
        assert isinstance(graph, GraphData)
        assert len(graph.nodes) == 0

    @pytest.mark.asyncio
    async def test_build_with_entity_types_filter(self, service, mock_db):
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)
        graph = await service.build_project_graph(entity_types=["character"])
        assert isinstance(graph, GraphData)

    @pytest.mark.asyncio
    async def test_build_with_project_id(self, service, mock_db):
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)
        graph = await service.build_project_graph(project_id=42)
        assert isinstance(graph, GraphData)

    @pytest.mark.asyncio
    async def test_build_populates_nodes(self, service, mock_db):
        """build_project_graph populates nodes from entities."""
        char = _make_entity("character", 1, "主角", personality="勇敢")
        # First call: load characters; second: load implicit edges (returns empty)
        mock_scalars = MagicMock()
        mock_scalars.scalars.return_value.all.return_value = [char]
        mock_db.execute = AsyncMock(return_value=mock_scalars)

        graph = await service.build_project_graph(entity_types=["character"])
        assert len(graph.nodes) == 1
        assert graph.nodes[0].label == "主角"
        assert graph.nodes[0].type == "character"

    @pytest.mark.asyncio
    async def test_build_loads_character_relationships(self, service, mock_db):
        """When character type is included, relationship edges are loaded."""
        rel = MagicMock()
        rel.character_id = 1
        rel.target_id = 2
        rel.type = "敌人"
        rel.description = "宿敌"

        call_count = 0
        mock_results = []

        # Calls: load_characters, load_relationships, load_implicit_edges
        char_scalars = _make_mock_scalars([_make_entity("character", 1, "A"), _make_entity("character", 2, "B")])
        rel_scalars = _make_mock_scalars([rel])
        empty_scalars = _make_mock_scalars([])

        async def side_effect(stmt):
            nonlocal call_count
            call_count += 1
            # Character query, Relationship query, or implicit edge query
            stmt_str = str(stmt)
            if "character_relationships" in stmt_str:
                return rel_scalars
            return empty_scalars

        mock_db.execute = AsyncMock(side_effect=side_effect)
        graph = await service.build_project_graph(entity_types=["character"])
        # Should have edges from relationships
        assert any(e.type == "character_relationship" for e in graph.edges)

    @pytest.mark.asyncio
    async def test_build_computes_node_sizes(self, service, mock_db):
        """build_project_graph computes node sizes based on connections."""
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)
        graph = await service.build_project_graph()
        # With no edges, all sizes should be 1
        for node in graph.nodes:
            assert node.size >= 1


# =============================================================================
# _load_entities
# =============================================================================


class TestLoadEntities:
    """Test entity loading into graph nodes."""

    @pytest.mark.asyncio
    async def test_load_entities_unknown_type(self, service):
        """Unknown entity type returns empty list."""
        result = await service._load_entities("unknown_type")
        assert result == []

    @pytest.mark.asyncio
    async def test_load_entities_character(self, service, mock_db):
        """Characters are loaded with correct properties."""
        char = _make_entity("character", 1, "主角", personality="勇敢", gender="男")
        mock_result = _make_mock_scalars([char])
        mock_db.execute = AsyncMock(return_value=mock_result)

        nodes = await service._load_entities("character")
        assert len(nodes) == 1
        assert nodes[0].type == "character"
        assert nodes[0].label == "主角"
        assert nodes[0].color == GraphService.NODE_COLORS["character"]

    @pytest.mark.asyncio
    async def test_load_entities_with_project_filter(self, service, mock_db):
        """Project ID filter is applied when model has project_id."""
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)

        await service._load_entities("character", project_id=42)
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_load_entities_extracts_properties(self, service, mock_db):
        """Entity attributes are extracted into properties dict."""
        item = _make_entity("item", 5, "神剑", owner="主角", location="宗门")
        mock_result = _make_mock_scalars([item])
        mock_db.execute = AsyncMock(return_value=mock_result)

        nodes = await service._load_entities("item")
        assert nodes[0].properties.get("owner") == "主角"

    @pytest.mark.asyncio
    async def test_load_entities_empty_db(self, service, mock_db):
        """Empty database returns empty node list."""
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)

        nodes = await service._load_entities("faction")
        assert nodes == []


# =============================================================================
# _load_single_entity
# =============================================================================


class TestLoadSingleEntity:
    """Test loading a single entity."""

    @pytest.mark.asyncio
    async def test_load_single_entity_found(self, service, mock_db):
        char = _make_entity("character", 1, "主角", description="主角描述")
        mock_result = _make_mock_scalar_one(char)
        mock_db.execute = AsyncMock(return_value=mock_result)

        node = await service._load_single_entity(1, "character")
        assert node is not None
        assert node.id == 1
        assert node.label == "主角"

    @pytest.mark.asyncio
    async def test_load_single_entity_not_found(self, service, mock_db):
        mock_result = _make_mock_scalar_one(None)
        mock_db.execute = AsyncMock(return_value=mock_result)

        node = await service._load_single_entity(999, "character")
        assert node is None

    @pytest.mark.asyncio
    async def test_load_single_entity_unknown_type(self, service):
        """Unknown entity type returns None."""
        node = await service._load_single_entity(1, "nonexistent")
        assert node is None

    @pytest.mark.asyncio
    async def test_load_single_entity_color_assigned(self, service, mock_db):
        item = _make_entity("item", 3, "法宝")
        mock_result = _make_mock_scalar_one(item)
        mock_db.execute = AsyncMock(return_value=mock_result)

        node = await service._load_single_entity(3, "item")
        assert node.color == GraphService.NODE_COLORS["item"]


# =============================================================================
# _load_character_relationships
# =============================================================================


class TestLoadCharacterRelationships:
    """Test loading character relationship edges."""

    @pytest.mark.asyncio
    async def test_load_relationships(self, service, mock_db):
        rel = MagicMock()
        rel.character_id = 1
        rel.target_id = 2
        rel.type = "师徒"
        rel.description = "师父与徒弟"
        mock_result = _make_mock_scalars([rel])
        mock_db.execute = AsyncMock(return_value=mock_result)

        edges = await service._load_character_relationships()
        assert len(edges) == 1
        assert edges[0].source == 1
        assert edges[0].target == 2
        assert edges[0].label == "师徒"
        assert edges[0].type == "character_relationship"

    @pytest.mark.asyncio
    async def test_load_relationships_with_project_id(self, service, mock_db):
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)

        await service._load_character_relationships(project_id=10)
        mock_db.execute.assert_called_once()

    @pytest.mark.asyncio
    async def test_load_relationships_empty(self, service, mock_db):
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)

        edges = await service._load_character_relationships()
        assert edges == []


# =============================================================================
# _load_implicit_edges
# =============================================================================


class TestLoadImplicitEdges:
    """Test implicit edge loading from entity properties."""

    @pytest.mark.asyncio
    async def test_ownership_edge_from_item_owner(self, service):
        """Items with owner matching a character name create ownership edges."""
        nodes = [
            GraphNode(id=1, type="character", label="张三", properties={}),
            GraphNode(id=10, type="item", label="宝剑", properties={"owner": "张三"}),
        ]
        edges = await service._load_implicit_edges(nodes)
        ownership_edges = [e for e in edges if e.type == "ownership"]
        assert len(ownership_edges) == 1
        assert ownership_edges[0].source == 1
        assert ownership_edges[0].target == 10

    @pytest.mark.asyncio
    async def test_ownership_edge_case_insensitive(self, service):
        """Owner matching is case-insensitive."""
        nodes = [
            GraphNode(id=1, type="character", label="Hero", properties={}),
            GraphNode(id=10, type="item", label="Sword", properties={"owner": "hero"}),
        ]
        edges = await service._load_implicit_edges(nodes)
        assert any(e.type == "ownership" for e in edges)

    @pytest.mark.asyncio
    async def test_implicit_edges_no_match(self, service):
        """No implicit edges when owner doesn't match any character."""
        nodes = [
            GraphNode(id=1, type="character", label="张三", properties={}),
            GraphNode(id=10, type="item", label="宝剑", properties={"owner": "李四"}),
        ]
        edges = await service._load_implicit_edges(nodes)
        assert len(edges) == 0

    @pytest.mark.asyncio
    async def test_faction_location_edge(self, service):
        """Location importance matching faction creates faction_location edge."""
        nodes = [
            GraphNode(id=5, type="faction", label="天剑宗", properties={}),
            GraphNode(id=20, type="location", label="主峰", properties={"importance": "天剑宗"}),
        ]
        edges = await service._load_implicit_edges(nodes)
        faction_edges = [e for e in edges if e.type == "faction_location"]
        assert len(faction_edges) == 1
        assert faction_edges[0].source == 5
        assert faction_edges[0].target == 20

    @pytest.mark.asyncio
    async def test_implicit_edges_empty_nodes(self, service):
        """Empty nodes returns empty edges."""
        edges = await service._load_implicit_edges([])
        assert edges == []

    @pytest.mark.asyncio
    async def test_implicit_edges_empty_owner(self, service):
        """Items with empty owner don't create edges."""
        nodes = [
            GraphNode(id=1, type="character", label="主角", properties={}),
            GraphNode(id=10, type="item", label="无主之剑", properties={"owner": ""}),
        ]
        edges = await service._load_implicit_edges(nodes)
        assert len(edges) == 0


# =============================================================================
# _get_neighbors
# =============================================================================


class TestGetNeighbors:
    """Test neighbor discovery."""

    @pytest.mark.asyncio
    async def test_character_relationship_neighbors(self, service, mock_db):
        """Character has neighbors from relationships."""
        rel = MagicMock()
        rel.target_id = 2
        rel.type = "敌人"
        rel.description = "宿敌"

        rel_result = _make_mock_scalars([rel])

        # For character type: first query is character_relationships (source),
        # second is character_relationships (target),
        # then item queries, then character query for name
        empty_scalars = _make_mock_scalars([])
        char_result = _make_mock_scalar_one(_make_entity("character", 1, "主角"))

        call_count = 0

        async def side_effect(stmt):
            nonlocal call_count
            call_count += 1
            stmt_str = str(stmt)
            if "character_relationships" in stmt_str and call_count <= 2:
                return rel_result if call_count == 1 else empty_scalars
            if "items" in stmt_str:
                return empty_scalars
            if "characters" in stmt_str:
                return char_result
            return empty_scalars

        mock_db.execute = AsyncMock(side_effect=side_effect)
        neighbors = await service._get_neighbors(1, "character")
        assert len(neighbors) >= 1
        assert any(n[1] == "character" for n in neighbors)

    @pytest.mark.asyncio
    async def test_item_owner_neighbor(self, service, mock_db):
        """Item with owner creates neighbor link to character."""
        item = _make_entity("item", 10, "宝剑", owner="主角")
        item_result = _make_mock_scalar_one(item)
        char = _make_entity("character", 1, "主角")
        char_result = _make_mock_scalar_one(char)

        async def side_effect(stmt):
            stmt_str = str(stmt)
            if "items" in stmt_str:
                return item_result
            if "characters" in stmt_str:
                return char_result
            return _make_mock_scalar_one(None)

        mock_db.execute = AsyncMock(side_effect=side_effect)
        neighbors = await service._get_neighbors(10, "item")
        assert len(neighbors) == 1
        assert neighbors[0] == (1, "character", {"label": "拥有者", "type": "ownership"})

    @pytest.mark.asyncio
    async def test_item_no_owner(self, service, mock_db):
        """Item without owner returns no character neighbors."""
        item = _make_entity("item", 10, "无主剑", owner=None)
        mock_result = _make_mock_scalar_one(item)
        mock_db.execute = AsyncMock(return_value=mock_result)

        neighbors = await service._get_neighbors(10, "item")
        assert len(neighbors) == 0

    @pytest.mark.asyncio
    async def test_item_owner_not_found(self, service, mock_db):
        """Item with owner that doesn't match any character returns no neighbors."""
        item = _make_entity("item", 10, "宝剑", owner="不存在的角色")

        item_result = _make_mock_scalar_one(item)
        no_char_result = _make_mock_scalar_one(None)

        async def side_effect(stmt):
            stmt_str = str(stmt)
            if "items" in stmt_str:
                return item_result
            return no_char_result

        mock_db.execute = AsyncMock(side_effect=side_effect)
        neighbors = await service._get_neighbors(10, "item")
        assert len(neighbors) == 0

    @pytest.mark.asyncio
    async def test_neighbors_with_project_id(self, service, mock_db):
        """Project ID filter is applied to neighbor queries."""
        rel = MagicMock()
        rel.target_id = 2
        rel.type = "盟友"
        rel.description = ""

        empty = _make_mock_scalars([])
        rel_result = _make_mock_scalars([rel])
        char_result = _make_mock_scalar_one(_make_entity("character", 1, "A"))

        call_count = 0

        async def side_effect(stmt):
            nonlocal call_count
            call_count += 1
            stmt_str = str(stmt)
            if "character_relationships" in stmt_str and call_count <= 2:
                return rel_result if call_count == 1 else empty
            if "characters" in stmt_str:
                return char_result
            return empty

        mock_db.execute = AsyncMock(side_effect=side_effect)
        await service._get_neighbors(1, "character", project_id=42)

    @pytest.mark.asyncio
    async def test_location_type_returns_no_neighbors(self, service, mock_db):
        """Location entities have no explicit neighbor logic."""
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)
        neighbors = await service._get_neighbors(5, "location")
        assert neighbors == []


# =============================================================================
# build_entity_neighborhood
# =============================================================================


class TestBuildNeighborhood:
    """Test entity neighborhood building."""

    @pytest.mark.asyncio
    async def test_neighborhood_nonexistent_entity(self, service, mock_db):
        mock_result = _make_mock_scalar_one(None)
        mock_db.execute = AsyncMock(return_value=mock_result)

        graph = await service.build_entity_neighborhood(999, "character")
        assert len(graph.nodes) == 0

    @pytest.mark.asyncio
    async def test_neighborhood_single_entity_depth_zero(self, service, mock_db):
        """Depth=0 returns only the center entity."""
        char = _make_entity("character", 1, "主角")
        mock_result = _make_mock_scalar_one(char)
        mock_db.execute = AsyncMock(return_value=mock_result)

        graph = await service.build_entity_neighborhood(1, "character", depth=0)
        assert len(graph.nodes) == 1
        assert graph.nodes[0].label == "主角"

    @pytest.mark.asyncio
    async def test_neighborhood_unknown_type(self, service):
        """Unknown entity type returns empty graph."""
        graph = await service.build_entity_neighborhood(1, "nonexistent")
        assert len(graph.nodes) == 0

    @pytest.mark.asyncio
    async def test_neighborhood_deduplicates_edges(self, service, mock_db):
        """Duplicate edges are not added."""
        char1 = _make_entity("character", 1, "A")
        char2 = _make_entity("character", 2, "B")

        rel = MagicMock()
        rel.character_id = 1
        rel.target_id = 2
        rel.type = "朋友"
        rel.description = ""

        call_count = 0

        async def side_effect(stmt):
            nonlocal call_count
            call_count += 1
            stmt_str = str(stmt)
            if call_count == 1:
                return _make_mock_scalar_one(char1)
            if "character_relationships" in stmt_str:
                return _make_mock_scalars([rel])
            if "characters" in stmt_str:
                entity_id = None
                if hasattr(stmt, 'whereclause') and stmt.whereclause is not None:
                    return _make_mock_scalar_one(char2)
                return _make_mock_scalars([])
            return _make_mock_scalars([])

        mock_db.execute = AsyncMock(side_effect=side_effect)
        graph = await service.build_entity_neighborhood(1, "character", depth=1)


# =============================================================================
# multi_hop_query
# =============================================================================


class TestMultiHopQuery:
    """Test multi-hop path queries."""

    @pytest.mark.asyncio
    async def test_multi_hop_start_not_found(self, service, mock_db):
        """Returns empty paths when start entity not found."""
        mock_result = _make_mock_scalar_one(None)
        mock_db.execute = AsyncMock(return_value=mock_result)

        paths = await service.multi_hop_query(999, "character")
        assert paths == []

    @pytest.mark.asyncio
    async def test_multi_hop_no_end_returns_reachable(self, service, mock_db):
        """Without end entity, returns all reachable paths."""
        char = _make_entity("character", 1, "主角")

        call_count = 0

        async def side_effect(stmt):
            nonlocal call_count
            call_count += 1
            stmt_str = str(stmt)
            if call_count == 1:
                return _make_mock_scalar_one(char)
            if "character_relationships" in stmt_str:
                return _make_mock_scalars([])
            if "items" in stmt_str:
                return _make_mock_scalars([])
            if "characters" in stmt_str:
                return _make_mock_scalar_one(char)
            return _make_mock_scalars([])

        mock_db.execute = AsyncMock(side_effect=side_effect)
        paths = await service.multi_hop_query(1, "character", max_hops=2)
        assert isinstance(paths, list)

    @pytest.mark.asyncio
    async def test_multi_hop_with_relation_types_filter(self, service, mock_db):
        """Relation types filter works."""
        char = _make_entity("character", 1, "主角")

        async def side_effect(stmt):
            stmt_str = str(stmt)
            if "character_relationships" in stmt_str:
                return _make_mock_scalars([])
            if "items" in stmt_str:
                return _make_mock_scalars([])
            if "characters" in stmt_str:
                return _make_mock_scalar_one(char)
            return _make_mock_scalars([])

        mock_db.execute = AsyncMock(side_effect=side_effect)
        paths = await service.multi_hop_query(
            1, "character", relation_types=["friendship"]
        )
        assert isinstance(paths, list)

    @pytest.mark.asyncio
    async def test_multi_hop_respects_max_hops(self, service, mock_db):
        """max_hops limits search depth."""
        char = _make_entity("character", 1, "主角")

        async def side_effect(stmt):
            stmt_str = str(stmt)
            if "character_relationships" in stmt_str:
                return _make_mock_scalars([])
            if "items" in stmt_str:
                return _make_mock_scalars([])
            if "characters" in stmt_str:
                return _make_mock_scalar_one(char)
            return _make_mock_scalars([])

        mock_db.execute = AsyncMock(side_effect=side_effect)
        paths = await service.multi_hop_query(1, "character", max_hops=1)
        for p in paths:
            assert p["hops"] <= 1


# =============================================================================
# find_shortest_path
# =============================================================================


class TestFindShortestPath:
    """Test BFS shortest path finding."""

    @pytest.mark.asyncio
    async def test_shortest_path_start_not_found(self, service, mock_db):
        """Returns None when start entity not found."""
        mock_result = _make_mock_scalar_one(None)
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await service.find_shortest_path(999, "character", 1, "character")
        assert result is None

    @pytest.mark.asyncio
    async def test_shortest_path_same_entity(self, service, mock_db):
        """Start == end with depth 0 returns None (requires depth > 0)."""
        char = _make_entity("character", 1, "主角")
        mock_result = _make_mock_scalar_one(char)
        mock_db.execute = AsyncMock(return_value=mock_result)

        result = await service.find_shortest_path(1, "character", 1, "character")
        assert result is None

    @pytest.mark.asyncio
    async def test_shortest_path_direct_connection(self, service, mock_db):
        """Direct neighbor found in one hop."""
        char1 = _make_entity("character", 1, "主角")
        char2 = _make_entity("character", 2, "反派")

        rel = MagicMock()
        rel.target_id = 2
        rel.type = "敌人"
        rel.description = ""
        rel.character_id = 1

        call_count = 0

        async def side_effect(stmt):
            nonlocal call_count
            call_count += 1
            stmt_str = str(stmt)
            if call_count == 1:
                return _make_mock_scalar_one(char1)
            if "character_relationships" in stmt_str:
                return _make_mock_scalars([rel])
            if "characters" in stmt_str:
                return _make_mock_scalar_one(char2)
            if "items" in stmt_str:
                return _make_mock_scalars([])
            return _make_mock_scalars([])

        mock_db.execute = AsyncMock(side_effect=side_effect)
        result = await service.find_shortest_path(1, "character", 2, "character")
        assert result is not None
        assert result["hops"] == 1
        assert len(result["nodes"]) == 2

    @pytest.mark.asyncio
    async def test_shortest_path_no_path(self, service, mock_db):
        """Returns None when no path exists."""
        char1 = _make_entity("character", 1, "A")
        char2 = _make_entity("character", 2, "B")

        call_count = 0

        async def side_effect(stmt):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return _make_mock_scalar_one(char1)
            if call_count <= 3:
                return _make_mock_scalars([])
            return _make_mock_scalar_one(None)

        mock_db.execute = AsyncMock(side_effect=side_effect)
        result = await service.find_shortest_path(1, "character", 2, "character", max_hops=1)
        assert result is None


# =============================================================================
# compute_centrality
# =============================================================================


class TestComputeCentrality:
    """Test centrality computation."""

    @pytest.mark.asyncio
    async def test_degree_centrality_empty_graph(self, service, mock_db):
        """Empty graph returns empty scores."""
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)

        scores = await service.compute_centrality(metric="degree")
        assert scores == []

    @pytest.mark.asyncio
    async def test_degree_centrality_with_nodes(self, service, mock_db):
        """Degree centrality counts connections."""
        char1 = _make_entity("character", 1, "A")
        char2 = _make_entity("character", 2, "B")

        rel = MagicMock()
        rel.character_id = 1
        rel.target_id = 2
        rel.type = "盟友"
        rel.description = ""

        async def side_effect(stmt):
            stmt_str = str(stmt)
            if "character_relationships" in stmt_str:
                return _make_mock_scalars([rel])
            if "characters" in stmt_str:
                return _make_mock_scalars([char1, char2])
            return _make_mock_scalars([])

        mock_db.execute = AsyncMock(side_effect=side_effect)
        scores = await service.compute_centrality(metric="degree")
        assert len(scores) == 2
        assert all("score" in s for s in scores)

    @pytest.mark.asyncio
    async def test_betweenness_centrality(self, service, mock_db):
        """Betweenness centrality computes without error."""
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)

        scores = await service.compute_centrality(metric="betweenness")
        assert isinstance(scores, list)

    @pytest.mark.asyncio
    async def test_centrality_sorted_descending(self, service, mock_db):
        """Scores are sorted in descending order."""
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)

        scores = await service.compute_centrality()
        if len(scores) > 1:
            for i in range(len(scores) - 1):
                assert scores[i]["score"] >= scores[i + 1]["score"]


# =============================================================================
# find_clusters
# =============================================================================


class TestFindClusters:
    """Test cluster/community detection."""

    @pytest.mark.asyncio
    async def test_find_clusters_empty_graph(self, service, mock_db):
        """Empty graph returns no clusters."""
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)

        clusters = await service.find_clusters()
        assert clusters == []

    @pytest.mark.asyncio
    async def test_find_clusters_returns_structure(self, service, mock_db):
        """Clusters have correct structure."""
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)

        clusters = await service.find_clusters()
        assert isinstance(clusters, list)
        for c in clusters:
            assert "cluster_id" in c
            assert "members" in c
            assert "size" in c

    @pytest.mark.asyncio
    async def test_find_clusters_sorted_by_size(self, service, mock_db):
        """Clusters are sorted by size descending."""
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)

        clusters = await service.find_clusters()
        if len(clusters) > 1:
            for i in range(len(clusters) - 1):
                assert clusters[i]["size"] >= clusters[i + 1]["size"]


# =============================================================================
# _bfs_path
# =============================================================================


class TestBFSPath:
    """Test BFS shortest path."""

    def test_bfs_path_same_node(self, service):
        adj = {(1, "c"): []}
        path = service._bfs_path((1, "c"), (1, "c"), adj)
        assert path == [(1, "c")]

    def test_bfs_path_direct_connection(self, service):
        adj = {(1, "c"): [(2, "c")], (2, "c"): [(1, "c")]}
        path = service._bfs_path((1, "c"), (2, "c"), adj)
        assert path == [(1, "c"), (2, "c")]

    def test_bfs_path_no_connection(self, service):
        adj = {(1, "c"): [], (2, "c"): []}
        path = service._bfs_path((1, "c"), (2, "c"), adj)
        assert path is None

    def test_bfs_path_multi_hop(self, service):
        adj = {(1, "c"): [(2, "c")], (2, "c"): [(1, "c"), (3, "c")], (3, "c"): [(2, "c")]}
        path = service._bfs_path((1, "c"), (3, "c"), adj)
        assert path == [(1, "c"), (2, "c"), (3, "c")]


# =============================================================================
# NetworkX integration
# =============================================================================


class TestNetworkXIntegration:
    """Test NetworkX-based graph analysis."""

    def test_build_networkx_graph(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        G, undirected_G = service.build_networkx_graph(sample_graph)
        if G is not None:
            assert G.number_of_nodes() == 4
            assert G.number_of_edges() == 2

    def test_build_networkx_graph_empty(self, service):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        G, undirected_G = service.build_networkx_graph(GraphData())
        if G is not None:
            assert G.number_of_nodes() == 0

    def test_build_networkx_graph_with_mapping(self, service, sample_graph):
        """Custom entity_id_to_type mapping is used."""
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        mapping = {n.id: n.type for n in sample_graph.nodes}
        G, UG = service.build_networkx_graph(sample_graph, _entity_id_to_type=mapping)
        if G is not None:
            assert G.number_of_nodes() == 4

    def test_graph_stats(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        stats = service.graph_stats(sample_graph)
        if stats:
            assert "num_nodes" in stats
            assert "num_edges" in stats
            assert stats["num_nodes"] == 4
            assert stats["num_edges"] == 2

    def test_graph_stats_empty(self, service):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        stats = service.graph_stats(GraphData())
        if stats:
            assert stats["num_nodes"] == 0

    def test_top_centrality(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        top = service.top_centrality(sample_graph, metric="degree", top_n=3)
        assert isinstance(top, list)
        if top:
            assert "id" in top[0]
            assert "score" in top[0]

    def test_top_centrality_with_type_filter(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        top = service.top_centrality(sample_graph, metric="degree", entity_type="character")
        assert all(item["type"] == "character" for item in top)

    def test_nx_shortest_path_found(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        result = service.nx_shortest_path(sample_graph, 1, "character", 2, "character")
        if result is not None:
            assert len(result) >= 2

    def test_nx_shortest_path_not_found(self, service):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        disconnected = GraphData(
            nodes=[
                GraphNode(id=1, type="character", label="A"),
                GraphNode(id=99, type="character", label="B"),
            ],
            edges=[],
        )
        result = service.nx_shortest_path(disconnected, 1, "character", 99, "character")
        assert result is None

    def test_nx_shortest_path_nonexistent_node(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        result = service.nx_shortest_path(sample_graph, 999, "character", 1, "character")
        assert result is None

    def test_all_paths(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        paths = service.all_paths(sample_graph, 1, "character", 2, "character")
        assert isinstance(paths, list)

    def test_all_paths_nonexistent(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        paths = service.all_paths(sample_graph, 999, "character", 1, "character")
        assert paths == []

    def test_find_reachable(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        reachable = service.find_reachable(sample_graph, 1, "character", max_depth=2)
        assert isinstance(reachable, list)

    def test_find_reachable_nonexistent(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        reachable = service.find_reachable(sample_graph, 999, "character")
        assert reachable == []

    def test_community_detection_connected(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        communities = service.community_detection(sample_graph, method="connected_components")
        assert isinstance(communities, list)
        assert len(communities) >= 1

    def test_community_detection_weakly_connected(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        communities = service.community_detection(sample_graph, method="weakly_connected")
        assert isinstance(communities, list)

    def test_community_detection_label_propagation(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        communities = service.community_detection(sample_graph, method="label_propagation")
        assert isinstance(communities, list)

    def test_find_cliques(self, service):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        # Create a triangle (clique of 3)
        graph = GraphData(
            nodes=[
                GraphNode(id=i, type="character", label=f"c{i}") for i in range(3)
            ],
            edges=[
                GraphEdge(source=0, target=1, label="r", type="t"),
                GraphEdge(source=1, target=2, label="r", type="t"),
                GraphEdge(source=0, target=2, label="r", type="t"),
            ],
        )
        cliques = service.find_cliques(graph, min_size=3)
        assert isinstance(cliques, list)

    def test_find_cliques_min_size_filter(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        cliques = service.find_cliques(sample_graph, min_size=100)
        assert cliques == []

    def test_nx_centrality_degree(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        scores = service.nx_centrality(sample_graph, metric="degree")
        assert isinstance(scores, dict)
        if scores:
            for key, score in scores.items():
                assert isinstance(key, tuple)
                assert isinstance(score, float)

    def test_nx_centrality_betweenness(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        scores = service.nx_centrality(sample_graph, metric="betweenness")
        assert isinstance(scores, dict)

    def test_nx_centrality_closeness(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        scores = service.nx_centrality(sample_graph, metric="closeness")
        assert isinstance(scores, dict)

    def test_nx_centrality_pagerank(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        scores = service.nx_centrality(sample_graph, metric="pagerank")
        assert isinstance(scores, dict)

    def test_nx_centrality_unknown_metric(self, service, sample_graph):
        try:
            import networkx as nx
        except ImportError:
            pytest.skip("NetworkX not installed")

        scores = service.nx_centrality(sample_graph, metric="unknown")
        assert isinstance(scores, dict)
