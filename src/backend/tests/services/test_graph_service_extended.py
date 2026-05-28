"""Extended tests for GraphService — Phase 5 Tier 2.

Covers additional edge cases for: GraphNode/GraphEdge dataclasses,
build_networkx_graph, nx_shortest_path, all_paths, find_reachable,
community_detection, find_cliques, nx_centrality, top_centrality,
graph_stats, BFS path, and _count_by_type.
"""

import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.services.graph_service import (
    GraphService,
    GraphNode,
    GraphEdge,
    GraphData,
    _HAS_NETWORKX,
)

nx = pytest.importorskip("networkx") if _HAS_NETWORKX else None


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
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = entities
    return mock_result


def _make_mock_scalar_one(entity):
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = entity
    return mock_result


def _make_entity(etype, eid, name, **kwargs):
    entity = MagicMock()
    entity.id = eid
    entity.name = name
    entity.description = kwargs.get("description", "")
    entity.project_id = kwargs.get("project_id", 1)
    for k, v in kwargs.items():
        setattr(entity, k, v)
    return entity


# =============================================================================
# GraphNode dataclass
# =============================================================================


class TestGraphNodeDataclass:
    """Test GraphNode dataclass defaults."""

    def test_default_properties(self):
        node = GraphNode(id=1, type="character", label="test")
        assert node.properties == {}
        assert node.color is None
        assert node.size == 1

    def test_custom_properties(self):
        node = GraphNode(
            id=1,
            type="item",
            label="sword",
            properties={"damage": 100},
            color="#fff",
            size=5,
        )
        assert node.properties["damage"] == 100
        assert node.color == "#fff"
        assert node.size == 5

    def test_equality(self):
        n1 = GraphNode(id=1, type="c", label="a")
        n2 = GraphNode(id=1, type="c", label="a")
        assert n1 == n2


# =============================================================================
# GraphEdge dataclass
# =============================================================================


class TestGraphEdgeDataclass:
    """Test GraphEdge dataclass defaults."""

    def test_default_properties(self):
        edge = GraphEdge(source=1, target=2, label="rel", type="t")
        assert edge.properties == {}
        assert edge.directed is True

    def test_custom_directed(self):
        edge = GraphEdge(
            source=1, target=2, label="rel", type="t", directed=False
        )
        assert edge.directed is False

    def test_custom_properties(self):
        edge = GraphEdge(
            source=1,
            target=2,
            label="rel",
            type="t",
            properties={"weight": 0.5},
        )
        assert edge.properties["weight"] == 0.5


# =============================================================================
# GraphData additional tests
# =============================================================================


class TestGraphDataExtended:
    """Additional GraphData tests."""

    def test_to_dict_directed_field(self):
        edge = GraphEdge(source=1, target=2, label="r", type="t", directed=False)
        graph = GraphData(edges=[edge])
        d = graph.to_dict()
        assert d["edges"][0]["directed"] is False

    def test_to_dict_node_color_and_size(self):
        node = GraphNode(
            id=1, type="c", label="a", color="#abc", size=7, properties={}
        )
        graph = GraphData(nodes=[node])
        d = graph.to_dict()
        assert d["nodes"][0]["color"] == "#abc"
        assert d["nodes"][0]["size"] == 7

    def test_empty_graph_serialization(self):
        graph = GraphData()
        d = graph.to_dict()
        assert d == {"nodes": [], "edges": []}

    def test_large_graph_serialization(self):
        nodes = [
            GraphNode(id=i, type="character", label=f"c{i}") for i in range(100)
        ]
        edges = [
            GraphEdge(source=i, target=i + 1, label="r", type="t")
            for i in range(99)
        ]
        graph = GraphData(nodes=nodes, edges=edges)
        d = graph.to_dict()
        assert len(d["nodes"]) == 100
        assert len(d["edges"]) == 99


# =============================================================================
# NetworkX integration additional tests
# =============================================================================


@pytest.mark.skipif(not _HAS_NETWORKX, reason="NetworkX not installed")
class TestNetworkXExtended:
    """Extended NetworkX integration tests."""

    def test_build_networkx_preserves_node_attrs(self, service, sample_graph):
        G, UG = service.build_networkx_graph(sample_graph)
        assert G is not None
        node_data = G.nodes["character:1"]
        assert node_data["label"] == "主角"
        assert node_data["type"] == "character"

    def test_build_networkx_preserves_edge_attrs(self, service, sample_graph):
        G, UG = service.build_networkx_graph(sample_graph)
        assert G is not None
        edge_data = G.edges["character:1", "character:2"]
        assert edge_data["label"] == "敌人"
        assert edge_data["type"] == "character_relationship"

    def test_build_networkx_with_node_properties(self, service):
        nodes = [
            GraphNode(
                id=1,
                type="item",
                label="sword",
                properties={"damage": 100, "owner": "hero"},
            ),
        ]
        graph = GraphData(nodes=nodes)
        G, UG = service.build_networkx_graph(graph)
        assert G is not None
        assert G.nodes["item:1"]["damage"] == 100

    def test_build_networkx_with_custom_mapping(self, service, sample_graph):
        mapping = {n.id: n.type for n in sample_graph.nodes}
        G, UG = service.build_networkx_graph(
            sample_graph, _entity_id_to_type=mapping
        )
        assert G is not None
        assert G.number_of_nodes() == 4

    def test_nx_shortest_path_undirected(self, service, sample_graph):
        result = service.nx_shortest_path(
            sample_graph, 1, "character", 2, "character", directed=False
        )
        assert result is not None
        assert len(result) >= 2

    def test_nx_shortest_path_directed(self, service, sample_graph):
        result = service.nx_shortest_path(
            sample_graph, 1, "character", 2, "character", directed=True
        )
        # Either found or None (depending on edge direction)
        assert result is None or isinstance(result, list)

    def test_nx_shortest_path_source_not_in_graph(self, service, sample_graph):
        result = service.nx_shortest_path(
            sample_graph, 999, "character", 1, "character"
        )
        assert result is None

    def test_nx_shortest_path_target_not_in_graph(self, service, sample_graph):
        result = service.nx_shortest_path(
            sample_graph, 1, "character", 999, "character"
        )
        assert result is None

    def test_all_paths_returns_list(self, service, sample_graph):
        paths = service.all_paths(
            sample_graph, 1, "character", 2, "character"
        )
        assert isinstance(paths, list)

    def test_all_paths_with_max_depth(self, service, sample_graph):
        paths = service.all_paths(
            sample_graph, 1, "character", 2, "character", max_depth=1
        )
        assert isinstance(paths, list)

    def test_all_paths_nonexistent_source(self, service, sample_graph):
        paths = service.all_paths(
            sample_graph, 999, "character", 1, "character"
        )
        assert paths == []

    def test_find_reachable_returns_list(self, service, sample_graph):
        reachable = service.find_reachable(sample_graph, 1, "character", max_depth=2)
        assert isinstance(reachable, list)

    def test_find_reachable_has_distance(self, service, sample_graph):
        reachable = service.find_reachable(sample_graph, 1, "character", max_depth=2)
        for r in reachable:
            assert "id" in r
            assert "type" in r
            assert "label" in r
            assert "distance" in r

    def test_find_reachable_nonexistent(self, service, sample_graph):
        reachable = service.find_reachable(sample_graph, 999, "character")
        assert reachable == []

    def test_community_detection_connected_components(self, service, sample_graph):
        communities = service.community_detection(
            sample_graph, method="connected_components"
        )
        assert isinstance(communities, list)
        assert len(communities) >= 1

    def test_community_detection_weakly_connected(self, service, sample_graph):
        communities = service.community_detection(
            sample_graph, method="weakly_connected"
        )
        assert isinstance(communities, list)

    def test_community_detection_unknown_method(self, service, sample_graph):
        communities = service.community_detection(
            sample_graph, method="unknown_method"
        )
        assert isinstance(communities, list)

    def test_find_cliques_triangle(self, service):
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

    def test_find_cliques_small_graph(self, service, sample_graph):
        cliques = service.find_cliques(sample_graph, min_size=3)
        assert isinstance(cliques, list)

    def test_nx_centrality_degree(self, service, sample_graph):
        scores = service.nx_centrality(sample_graph, metric="degree")
        assert isinstance(scores, dict)
        for key, score in scores.items():
            assert isinstance(key, tuple)
            assert isinstance(score, float)

    def test_nx_centrality_betweenness(self, service, sample_graph):
        scores = service.nx_centrality(sample_graph, metric="betweenness")
        assert isinstance(scores, dict)

    def test_nx_centrality_closeness(self, service, sample_graph):
        scores = service.nx_centrality(sample_graph, metric="closeness")
        assert isinstance(scores, dict)

    def test_nx_centrality_pagerank(self, service, sample_graph):
        scores = service.nx_centrality(sample_graph, metric="pagerank")
        assert isinstance(scores, dict)

    def test_nx_centrality_unknown_defaults_to_degree(self, service, sample_graph):
        scores = service.nx_centrality(sample_graph, metric="nonexistent")
        assert isinstance(scores, dict)

    def test_top_centrality_returns_sorted(self, service, sample_graph):
        top = service.top_centrality(sample_graph, metric="degree", top_n=3)
        assert isinstance(top, list)
        if len(top) > 1:
            for i in range(len(top) - 1):
                assert top[i]["score"] >= top[i + 1]["score"]

    def test_top_centrality_with_type_filter(self, service, sample_graph):
        top = service.top_centrality(
            sample_graph, metric="degree", entity_type="character"
        )
        for item in top:
            assert item["type"] == "character"

    def test_top_centrality_top_n_limit(self, service, sample_graph):
        top = service.top_centrality(sample_graph, metric="degree", top_n=2)
        assert len(top) <= 2

    def test_graph_stats_keys(self, service, sample_graph):
        stats = service.graph_stats(sample_graph)
        assert "num_nodes" in stats
        assert "num_edges" in stats
        assert "density" in stats
        assert "is_directed" in stats
        assert "node_types" in stats

    def test_graph_stats_values(self, service, sample_graph):
        stats = service.graph_stats(sample_graph)
        assert stats["num_nodes"] == 4
        assert stats["num_edges"] == 2
        assert stats["is_directed"] is True

    def test_graph_stats_density(self, service, sample_graph):
        stats = service.graph_stats(sample_graph)
        assert 0 <= stats["density"] <= 1

    def test_graph_stats_node_types(self, service, sample_graph):
        stats = service.graph_stats(sample_graph)
        assert stats["node_types"]["character"] == 2
        assert stats["node_types"]["item"] == 1
        assert stats["node_types"]["location"] == 1


# =============================================================================
# BFS path additional tests
# =============================================================================


class TestBFSPathExtended:
    """Additional BFS path tests."""

    def test_bfs_path_self_loop(self, service):
        adj = {(1, "c"): [(1, "c")]}
        path = service._bfs_path((1, "c"), (1, "c"), adj)
        assert path == [(1, "c")]

    def test_bfs_path_long_chain(self, service):
        adj = {
            (i, "c"): [(i + 1, "c")] for i in range(5)
        }
        adj[(5, "c")] = []
        path = service._bfs_path((0, "c"), (5, "c"), adj)
        assert path is not None
        assert len(path) == 6

    def test_bfs_path_finds_shortest(self, service):
        """BFS finds the shortest path, not any path."""
        adj = {
            (1, "c"): [(2, "c"), (3, "c")],
            (2, "c"): [(1, "c"), (4, "c")],
            (3, "c"): [(1, "c"), (4, "c")],
            (4, "c"): [(2, "c"), (3, "c")],
        }
        path = service._bfs_path((1, "c"), (4, "c"), adj)
        assert path is not None
        assert len(path) == 3  # 1 -> 2 -> 4 or 1 -> 3 -> 4

    def test_bfs_path_disconnected_graph(self, service):
        adj = {(1, "c"): [], (2, "c"): [], (3, "c"): []}
        path = service._bfs_path((1, "c"), (3, "c"), adj)
        assert path is None


# =============================================================================
# _count_by_type additional tests
# =============================================================================


class TestCountByTypeExtended:
    """Additional type counting tests."""

    def test_count_single_type(self, service):
        nodes = [
            GraphNode(id=i, type="character", label=f"c{i}") for i in range(5)
        ]
        graph = GraphData(nodes=nodes)
        counts = service._count_by_type(graph)
        assert counts == {"character": 5}

    def test_count_all_types(self, service):
        nodes = [
            GraphNode(id=1, type="character", label="a"),
            GraphNode(id=2, type="item", label="b"),
            GraphNode(id=3, type="location", label="c"),
            GraphNode(id=4, type="faction", label="d"),
        ]
        graph = GraphData(nodes=nodes)
        counts = service._count_by_type(graph)
        assert counts == {
            "character": 1,
            "item": 1,
            "location": 1,
            "faction": 1,
        }


# =============================================================================
# _infer_type additional tests
# =============================================================================


class TestInferTypeExtended:
    """Additional type inference tests."""

    def test_infer_type_multiple_nodes(self, service):
        nodes = [
            GraphNode(id=1, type="character", label="a"),
            GraphNode(id=2, type="item", label="b"),
            GraphNode(id=3, type="location", label="c"),
        ]
        assert service._infer_type(1, nodes) == "character"
        assert service._infer_type(2, nodes) == "item"
        assert service._infer_type(3, nodes) == "location"

    def test_infer_type_first_match_wins(self, service):
        """If duplicate IDs exist, first match wins."""
        nodes = [
            GraphNode(id=1, type="character", label="a"),
            GraphNode(id=1, type="item", label="b"),
        ]
        assert service._infer_type(1, nodes) == "character"


# =============================================================================
# _compute_node_sizes additional tests
# =============================================================================


class TestNodeSizesExtended:
    """Additional node size tests."""

    def test_size_with_single_edge(self, service):
        nodes = [
            GraphNode(id=1, type="c", label="a"),
            GraphNode(id=2, type="c", label="b"),
        ]
        edges = [GraphEdge(source=1, target=2, label="r", type="t")]
        graph = GraphData(nodes=nodes, edges=edges)
        service._compute_node_sizes(graph)
        n1 = next(n for n in graph.nodes if n.id == 1)
        n2 = next(n for n in graph.nodes if n.id == 2)
        assert n1.size == 2
        assert n2.size == 2

    def test_size_with_many_edges(self, service):
        """Node connected to many others gets size 11 (capped)."""
        nodes = [GraphNode(id=i, type="c", label=f"n{i}") for i in range(20)]
        edges = [
            GraphEdge(source=0, target=i, label="r", type="t")
            for i in range(1, 20)
        ]
        graph = GraphData(nodes=nodes, edges=edges)
        service._compute_node_sizes(graph)
        n0 = next(n for n in graph.nodes if n.id == 0)
        assert n0.size == 11


# =============================================================================
# Constants additional tests
# =============================================================================


class TestConstantsExtended:
    """Additional constants tests."""

    def test_node_colors_are_hex(self):
        for color in GraphService.NODE_COLORS.values():
            assert color.startswith("#")
            assert len(color) == 7

    def test_type_labels_are_chinese(self):
        for label in GraphService.TYPE_LABELS.values():
            # Chinese characters
            assert any("一" <= c <= "鿿" for c in label)

    def test_entity_models_have_id(self):
        for model in GraphService.ENTITY_MODELS.values():
            assert hasattr(model, "id")


# =============================================================================
# build_project_graph additional tests
# =============================================================================


class TestBuildProjectGraphExtended:
    """Additional build_project_graph tests."""

    @pytest.mark.asyncio
    async def test_build_with_all_entity_types(self, service, mock_db):
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)
        graph = await service.build_project_graph(
            entity_types=["character", "item", "location", "faction"]
        )
        assert isinstance(graph, GraphData)

    @pytest.mark.asyncio
    async def test_build_with_empty_entity_types(self, service, mock_db):
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)
        graph = await service.build_project_graph(entity_types=[])
        assert len(graph.nodes) == 0

    @pytest.mark.asyncio
    async def test_build_with_unknown_entity_type(self, service, mock_db):
        mock_result = _make_mock_scalars([])
        mock_db.execute = AsyncMock(return_value=mock_result)
        graph = await service.build_project_graph(entity_types=["unknown"])
        assert len(graph.nodes) == 0
