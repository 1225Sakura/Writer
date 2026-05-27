"""Tests for Conflict Detector - ownership, location, and faction conflict detection."""

import pytest
from backend.services.conflict_detector import ConflictDetector, Conflict
from backend.services.graph_service import GraphData, GraphNode, GraphEdge


def _make_node(id: int, type: str, label: str, properties: dict = None) -> GraphNode:
    return GraphNode(id=id, type=type, label=label, properties=properties or {})


def _make_edge(source: int, target: int, type: str, label: str = "") -> GraphEdge:
    return GraphEdge(source=source, target=target, type=type, label=label)


# =============================================================================
# Conflict dataclass
# =============================================================================


class TestConflictDataclass:
    """Test Conflict dataclass serialization."""

    def test_to_dict(self):
        c = Conflict(
            conflict_type="ownership",
            severity="error",
            message="test msg",
            entity_a={"id": 1},
            entity_b={"id": 2},
            edge_info={"type": "ownership"},
        )
        d = c.to_dict()
        assert d["conflict_type"] == "ownership"
        assert d["severity"] == "error"
        assert d["message"] == "test msg"
        assert d["edge_info"]["type"] == "ownership"


# =============================================================================
# Ownership Conflicts
# =============================================================================


class TestOwnershipConflicts:
    """Test ownership conflict detection."""

    def test_no_conflict_single_owner(self):
        nodes = [
            _make_node(1, "character", "Alice"),
            _make_node(10, "item", "Sword"),
        ]
        edges = [_make_edge(1, 10, "ownership")]
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        conflicts = detector.detect_ownership_conflicts()
        assert len(conflicts) == 0

    def test_multiple_owners_detected(self):
        nodes = [
            _make_node(1, "character", "Alice"),
            _make_node(2, "character", "Bob"),
            _make_node(10, "item", "Sword"),
        ]
        edges = [
            _make_edge(1, 10, "ownership"),
            _make_edge(2, 10, "ownership"),
        ]
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        conflicts = detector.detect_ownership_conflicts()
        assert len(conflicts) == 1
        assert conflicts[0].conflict_type == "ownership"
        assert conflicts[0].severity == "error"

    def test_owner_property_mismatch_warning(self):
        nodes = [
            _make_node(1, "character", "Alice"),
            _make_node(10, "item", "Sword", properties={"owner": "alice"}),
        ]
        edges = []  # No ownership edge
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        conflicts = detector.detect_ownership_conflicts()
        assert len(conflicts) == 1
        assert conflicts[0].severity == "warning"


# =============================================================================
# Location Conflicts
# =============================================================================


class TestLocationConflicts:
    """Test location conflict detection."""

    def test_no_conflict_single_location(self):
        nodes = [
            _make_node(1, "character", "Alice"),
            _make_node(100, "location", "Castle"),
        ]
        edges = [_make_edge(1, 100, "location")]
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        conflicts = detector.detect_location_conflicts()
        assert len(conflicts) == 0

    def test_multiple_locations_detected(self):
        nodes = [
            _make_node(1, "character", "Alice"),
            _make_node(100, "location", "Castle"),
            _make_node(101, "location", "Forest"),
        ]
        edges = [
            _make_edge(1, 100, "location"),
            _make_edge(1, 101, "location"),
        ]
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        conflicts = detector.detect_location_conflicts()
        assert len(conflicts) == 1
        assert conflicts[0].conflict_type == "location"

    def test_location_visit_edge_detected(self):
        nodes = [
            _make_node(1, "character", "Alice"),
            _make_node(100, "location", "Castle"),
            _make_node(101, "location", "Forest"),
        ]
        edges = [
            _make_edge(1, 100, "location"),
            _make_edge(1, 101, "location_visit"),
        ]
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        conflicts = detector.detect_location_conflicts()
        assert len(conflicts) == 1

    def test_item_location_property_mismatch(self):
        nodes = [
            _make_node(10, "item", "Sword", properties={"location": "castle"}),
            _make_node(100, "location", "Castle"),
        ]
        edges = []  # No location edge
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        conflicts = detector.detect_location_conflicts()
        assert len(conflicts) == 1
        assert conflicts[0].severity == "warning"


# =============================================================================
# Faction Conflicts
# =============================================================================


class TestFactionConflicts:
    """Test faction conflict detection."""

    def test_no_conflict_single_controller(self):
        nodes = [
            _make_node(1, "faction", "Empire"),
            _make_node(100, "location", "Castle"),
        ]
        edges = [_make_edge(1, 100, "faction_control")]
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        conflicts = detector.detect_faction_conflicts()
        assert len(conflicts) == 0

    def test_multiple_controllers_detected(self):
        nodes = [
            _make_node(1, "faction", "Empire"),
            _make_node(2, "faction", "Rebels"),
            _make_node(100, "location", "Castle"),
        ]
        edges = [
            _make_edge(1, 100, "faction_control"),
            _make_edge(2, 100, "faction_control"),
        ]
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        conflicts = detector.detect_faction_conflicts()
        assert len(conflicts) == 1
        assert conflicts[0].conflict_type == "faction"

    def test_faction_location_edge_detected(self):
        nodes = [
            _make_node(1, "faction", "Empire"),
            _make_node(100, "location", "Castle"),
        ]
        edges = [_make_edge(1, 100, "faction_location")]
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        # faction_location is also indexed as faction edge
        assert len(detector._faction_edges) == 1


# =============================================================================
# Detect All / Has Conflicts
# =============================================================================


class TestDetectAll:
    """Test combined detection."""

    def test_detect_all_returns_all_types(self):
        gd = GraphData(nodes=[], edges=[])
        detector = ConflictDetector(gd)
        result = detector.detect_all_conflicts()
        assert "ownership" in result
        assert "location" in result
        assert "faction" in result

    def test_has_conflicts_false_when_clean(self):
        nodes = [
            _make_node(1, "character", "Alice"),
            _make_node(10, "item", "Sword"),
        ]
        edges = [_make_edge(1, 10, "ownership")]
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        assert detector.has_conflicts() is False

    def test_has_conflicts_true_when_multiple_owners(self):
        nodes = [
            _make_node(1, "character", "Alice"),
            _make_node(2, "character", "Bob"),
            _make_node(10, "item", "Sword"),
        ]
        edges = [
            _make_edge(1, 10, "ownership"),
            _make_edge(2, 10, "ownership"),
        ]
        gd = GraphData(nodes=nodes, edges=edges)
        detector = ConflictDetector(gd)
        assert detector.has_conflicts() is True


# =============================================================================
# Internal helpers
# =============================================================================


class TestInferType:
    """Test _infer_type helper."""

    def test_infers_known_node(self):
        nodes = [_make_node(1, "character", "Alice")]
        gd = GraphData(nodes=nodes, edges=[])
        detector = ConflictDetector(gd)
        assert detector._infer_type(1) == "character"

    def test_returns_none_for_unknown(self):
        gd = GraphData(nodes=[], edges=[])
        detector = ConflictDetector(gd)
        assert detector._infer_type(999) is None
