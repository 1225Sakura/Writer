"""Tests for NarrativeKG — narrative graph CRUD, traversal, RAG context, and persistence."""

import pytest

from backend.services.narrative_kg import NarrativeKG, NarrativeNode, NarrativeEdge


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def kg():
    """Empty NarrativeKG."""
    return NarrativeKG()


@pytest.fixture
def populated_kg():
    """NarrativeKG with a small graph: Alice --allies_with--> Bob --antagonist_of--> Charlie.

    Also: Alice --located_in--> Tavern, Tavern --located_in--> Village.
    """
    kg = NarrativeKG()

    kg.add_node(NarrativeNode(canonical_id=1, entity_type="character", name="Alice"))
    kg.add_node(NarrativeNode(canonical_id=2, entity_type="character", name="Bob"))
    kg.add_node(NarrativeNode(canonical_id=3, entity_type="character", name="Charlie"))
    kg.add_node(NarrativeNode(canonical_id=10, entity_type="location", name="Tavern"))
    kg.add_node(NarrativeNode(canonical_id=11, entity_type="location", name="Village"))

    kg.add_edge(NarrativeEdge(source_id=1, target_id=2, relationship="allies_with", weight=0.9))
    kg.add_edge(NarrativeEdge(source_id=2, target_id=3, relationship="antagonist_of", weight=0.7))
    kg.add_edge(NarrativeEdge(source_id=1, target_id=10, relationship="located_in"))
    kg.add_edge(NarrativeEdge(source_id=10, target_id=11, relationship="located_in"))

    return kg


# =============================================================================
# Node CRUD
# =============================================================================


def test_add_and_get_node(kg):
    """Node round-trip via add_node / get_node."""
    node = NarrativeNode(canonical_id=42, entity_type="character", name="Hero", attributes={"level": 5})
    kg.add_node(node)

    retrieved = kg.get_node(42)
    assert retrieved is not None
    assert retrieved.canonical_id == 42
    assert retrieved.entity_type == "character"
    assert retrieved.name == "Hero"
    assert retrieved.attributes == {"level": 5}


def test_get_node_not_found(kg):
    """Non-existent canonical_id returns None."""
    assert kg.get_node(999) is None


def test_get_nodes_by_type(populated_kg):
    """Filter nodes by entity_type."""
    characters = populated_kg.get_nodes_by_type("character")
    assert len(characters) == 3
    assert {n.name for n in characters} == {"Alice", "Bob", "Charlie"}

    locations = populated_kg.get_nodes_by_type("location")
    assert len(locations) == 2

    assert populated_kg.get_nodes_by_type("item") == []


def test_remove_node(populated_kg):
    """Removing a node also removes its incident edges."""
    assert populated_kg.remove_node(3) is True  # Charlie
    assert populated_kg.get_node(3) is None

    # Edges involving Charlie should be gone
    remaining_edges = populated_kg.get_edges(2)  # Bob's edges
    assert all(e.source_id != 3 and e.target_id != 3 for e in remaining_edges)


def test_remove_node_not_found(kg):
    """Removing non-existent node returns False."""
    assert kg.remove_node(999) is False


# =============================================================================
# Edge CRUD
# =============================================================================


def test_add_and_get_edge(kg):
    """Edge round-trip via add_edge / get_edges."""
    kg.add_node(NarrativeNode(canonical_id=1, entity_type="character", name="A"))
    kg.add_node(NarrativeNode(canonical_id=2, entity_type="character", name="B"))
    edge = NarrativeEdge(source_id=1, target_id=2, relationship="allies_with", weight=0.8, evidence=["chunk_1"])
    kg.add_edge(edge)

    edges_from_1 = kg.get_edges(1)
    assert len(edges_from_1) == 1
    assert edges_from_1[0].relationship == "allies_with"
    assert edges_from_1[0].weight == 0.8
    assert edges_from_1[0].evidence == ["chunk_1"]

    # Edge should also be visible from target
    edges_from_2 = kg.get_edges(2)
    assert len(edges_from_2) == 1


def test_get_edges_between(populated_kg):
    """get_edges_between returns edges in either direction."""
    edges = populated_kg.get_edges_between(1, 2)
    assert len(edges) == 1
    assert edges[0].relationship == "allies_with"

    # Reverse direction should also work
    edges_rev = populated_kg.get_edges_between(2, 1)
    assert len(edges_rev) == 1

    # No edge between these two
    assert populated_kg.get_edges_between(1, 3) == []


def test_remove_edge(populated_kg):
    """Remove a specific edge by source, target, relationship."""
    assert populated_kg.remove_edge(1, 2, "allies_with") is True
    assert populated_kg.get_edges_between(1, 2) == []


def test_remove_edge_not_found(populated_kg):
    """Removing non-existent edge returns False."""
    assert populated_kg.remove_edge(1, 2, "nonexistent") is False


# =============================================================================
# Graph traversal — neighbors
# =============================================================================


def test_get_neighbors_one_hop(populated_kg):
    """1-hop neighbors of Alice: Bob (id=2) and Tavern (id=10)."""
    neighbors = populated_kg.get_neighbors(1, max_hops=1)
    assert neighbors[1] == 0  # self
    assert neighbors[2] == 1  # Bob
    assert neighbors[10] == 1  # Tavern
    # Charlie and Village should NOT be reachable in 1 hop
    assert 3 not in neighbors
    assert 11 not in neighbors


def test_get_neighbors_two_hop(populated_kg):
    """2-hop neighbors of Alice: includes Charlie (via Bob) and Village (via Tavern)."""
    neighbors = populated_kg.get_neighbors(1, max_hops=2)
    assert neighbors[1] == 0
    assert neighbors[2] == 1
    assert neighbors[3] == 2  # Charlie via Bob
    assert neighbors[10] == 1
    assert neighbors[11] == 2  # Village via Tavern


def test_get_neighbors_unknown_node(kg):
    """Neighbors of unknown node returns empty dict."""
    assert kg.get_neighbors(999) == {}


# =============================================================================
# Graph traversal — pathfinding
# =============================================================================


def test_find_path_direct(kg):
    """Direct connection returns [source, target]."""
    kg.add_node(NarrativeNode(canonical_id=1, entity_type="character", name="A"))
    kg.add_node(NarrativeNode(canonical_id=2, entity_type="character", name="B"))
    kg.add_edge(NarrativeEdge(source_id=1, target_id=2, relationship="allies_with"))

    path = kg.find_path(1, 2)
    assert path == [1, 2]


def test_find_path_indirect(populated_kg):
    """Multi-hop path: Alice -> Bob -> Charlie."""
    path = populated_kg.find_path(1, 3, max_hops=3)
    assert path is not None
    assert path[0] == 1
    assert path[-1] == 3
    assert len(path) == 3  # Alice -> Bob -> Charlie


def test_find_path_none(populated_kg):
    """No path within max_hops returns None."""
    # Add an isolated node
    populated_kg.add_node(NarrativeNode(canonical_id=99, entity_type="theme", name="Isolation"))
    path = populated_kg.find_path(1, 99, max_hops=3)
    assert path is None


def test_find_path_same_node(kg):
    """Path from a node to itself is just [id]."""
    kg.add_node(NarrativeNode(canonical_id=1, entity_type="character", name="A"))
    assert kg.find_path(1, 1) == [1]


def test_find_path_unknown_node(kg):
    """Path involving unknown node returns None."""
    kg.add_node(NarrativeNode(canonical_id=1, entity_type="character", name="A"))
    assert kg.find_path(1, 999) is None
    assert kg.find_path(999, 1) is None


# =============================================================================
# RAG integration
# =============================================================================


def test_get_entity_context(populated_kg):
    """Returns structured context with node, connected nodes, and edges."""
    ctx = populated_kg.get_entity_context(1, max_hops=2)  # Alice

    assert ctx["node"]["name"] == "Alice"
    assert ctx["node"]["entity_type"] == "character"

    connected = {n["canonical_id"]: n for n in ctx["connected_nodes"]}
    assert 2 in connected  # Bob
    assert connected[2]["distance"] == 1
    assert 3 in connected  # Charlie (2-hop via Bob)
    assert connected[3]["distance"] == 2
    assert 10 in connected  # Tavern
    assert 11 in connected  # Village

    # Alice should not appear in her own connected_nodes
    assert 1 not in connected

    # Edges involving Alice
    edge_rels = {e["relationship"] for e in ctx["edges"]}
    assert "allies_with" in edge_rels
    assert "located_in" in edge_rels


def test_get_entity_context_unknown(kg):
    """Context for unknown node returns empty structure."""
    ctx = kg.get_entity_context(999)
    assert ctx["node"] is None
    assert ctx["connected_nodes"] == []
    assert ctx["edges"] == []


def test_query_by_relationship(populated_kg):
    """Filter edges by relationship type."""
    located = populated_kg.query_by_relationship("located_in")
    assert len(located) == 2
    assert all(e.relationship == "located_in" for e in located)

    allies = populated_kg.query_by_relationship("allies_with")
    assert len(allies) == 1

    assert populated_kg.query_by_relationship("nonexistent") == []


# =============================================================================
# Persistence
# =============================================================================


def test_to_from_dict_roundtrip(populated_kg):
    """Serialize and deserialize preserves graph structure."""
    data = populated_kg.to_dict()

    assert "nodes" in data
    assert "edges" in data
    assert len(data["nodes"]) == 5
    assert len(data["edges"]) == 4

    # Deserialize
    restored = NarrativeKG.from_dict(data)

    assert len(restored._nodes) == 5
    assert len(restored._edges) == 4
    assert restored.get_node(1).name == "Alice"
    assert restored.get_node(11).name == "Village"

    # Traversal should still work
    path = restored.find_path(1, 3)
    assert path is not None
    assert path == [1, 2, 3]

    # Edges preserved
    edges = restored.get_edges_between(1, 2)
    assert len(edges) == 1
    assert edges[0].relationship == "allies_with"
    assert edges[0].weight == 0.9


def test_from_dict_empty():
    """Deserializing an empty dict produces an empty graph."""
    kg = NarrativeKG.from_dict({})
    assert len(kg._nodes) == 0
    assert len(kg._edges) == 0
