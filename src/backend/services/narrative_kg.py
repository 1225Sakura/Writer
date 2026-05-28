"""Narrative Knowledge Graph — RAG-oriented entity and relationship storage.

Distinct from the temporal KG (Phase 1) which stores SVO quads with chapter
ordering for timeline queries.  This graph stores narrative relationships
between entities for retrieval-augmented generation: character alliances,
location containment, thematic connections, etc.

Both KGs share the EntityRegistry from Phase 1 for canonical ID resolution.
"""

from __future__ import annotations

import json
import logging
from collections import deque
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


# =============================================================================
# Dataclasses
# =============================================================================


@dataclass
class NarrativeNode:
    """A single entity node in the narrative knowledge graph."""

    canonical_id: int  # From EntityRegistry
    entity_type: str  # "character" | "location" | "item" | "event" | "theme"
    name: str
    attributes: Dict[str, Any] = field(default_factory=dict)


@dataclass
class NarrativeEdge:
    """A directed relationship between two narrative nodes."""

    source_id: int  # canonical_id of source node
    target_id: int  # canonical_id of target node
    relationship: str  # "antagonist_of" | "located_in" | "triggered_by" | "allies_with" | etc.
    weight: float = 1.0  # Strength of relationship (0.0-1.0)
    evidence: List[str] = field(default_factory=list)  # chunk_ids supporting this edge
    metadata: Dict[str, Any] = field(default_factory=dict)


# =============================================================================
# NarrativeKG
# =============================================================================


class NarrativeKG:
    """Narrative knowledge graph for RAG retrieval.

    Stores narrative relationships (alliances, enmities, containment, causation)
    between entities and provides traversal/query primitives for context assembly.
    """

    def __init__(self, entity_registry: Any = None) -> None:
        self._nodes: Dict[int, NarrativeNode] = {}  # canonical_id -> node
        self._edges: List[NarrativeEdge] = []
        self._adjacency: Dict[int, List[int]] = {}  # canonical_id -> [connected canonical_ids]
        self._entity_registry = entity_registry

    # -----------------------------------------------------------------
    # Node operations
    # -----------------------------------------------------------------

    def add_node(self, node: NarrativeNode) -> None:
        """Add a node to the graph. Overwrites if canonical_id already exists."""
        if node.canonical_id not in self._adjacency:
            self._adjacency[node.canonical_id] = []
        self._nodes[node.canonical_id] = node

    def get_node(self, canonical_id: int) -> Optional[NarrativeNode]:
        """Retrieve a node by canonical_id, or None."""
        return self._nodes.get(canonical_id)

    def get_nodes_by_type(self, entity_type: str) -> List[NarrativeNode]:
        """Return all nodes matching the given entity_type."""
        return [n for n in self._nodes.values() if n.entity_type == entity_type]

    def remove_node(self, canonical_id: int) -> bool:
        """Remove a node and all its incident edges. Returns True if found."""
        if canonical_id not in self._nodes:
            return False

        del self._nodes[canonical_id]

        # Remove all edges involving this node
        self._edges = [
            e for e in self._edges
            if e.source_id != canonical_id and e.target_id != canonical_id
        ]

        # Clean up adjacency
        if canonical_id in self._adjacency:
            # Remove references from neighbors
            for neighbor_id in self._adjacency[canonical_id]:
                if neighbor_id in self._adjacency:
                    self._adjacency[neighbor_id] = [
                        nid for nid in self._adjacency[neighbor_id]
                        if nid != canonical_id
                    ]
            del self._adjacency[canonical_id]

        return True

    # -----------------------------------------------------------------
    # Edge operations
    # -----------------------------------------------------------------

    def add_edge(self, edge: NarrativeEdge) -> None:
        """Add a directed edge to the graph.

        Auto-creates placeholder nodes for source/target if they don't exist,
        so that adjacency stays consistent.
        """
        self._edges.append(edge)

        # Ensure both endpoints exist in adjacency
        for node_id in (edge.source_id, edge.target_id):
            if node_id not in self._adjacency:
                self._adjacency[node_id] = []

        # Update adjacency (undirected traversal support)
        if edge.target_id not in self._adjacency[edge.source_id]:
            self._adjacency[edge.source_id].append(edge.target_id)
        if edge.source_id not in self._adjacency[edge.target_id]:
            self._adjacency[edge.target_id].append(edge.source_id)

    def get_edges(self, canonical_id: int) -> List[NarrativeEdge]:
        """Return all edges where canonical_id is source or target."""
        return [
            e for e in self._edges
            if e.source_id == canonical_id or e.target_id == canonical_id
        ]

    def get_edges_between(self, source_id: int, target_id: int) -> List[NarrativeEdge]:
        """Return all edges between two specific nodes (in either direction)."""
        return [
            e for e in self._edges
            if (e.source_id == source_id and e.target_id == target_id)
            or (e.source_id == target_id and e.target_id == source_id)
        ]

    def remove_edge(self, source_id: int, target_id: int, relationship: str) -> bool:
        """Remove a specific edge by source, target, and relationship type.

        Returns True if an edge was removed.
        """
        original_len = len(self._edges)
        self._edges = [
            e for e in self._edges
            if not (
                e.source_id == source_id
                and e.target_id == target_id
                and e.relationship == relationship
            )
        ]
        return len(self._edges) < original_len

    # -----------------------------------------------------------------
    # Graph traversal
    # -----------------------------------------------------------------

    def get_neighbors(self, canonical_id: int, max_hops: int = 1) -> Dict[int, int]:
        """BFS to find all nodes within max_hops of canonical_id.

        Returns:
            Dict mapping canonical_id -> shortest distance (hop count).
            Includes the starting node at distance 0.
        """
        if canonical_id not in self._nodes:
            return {}

        distances: Dict[int, int] = {canonical_id: 0}
        queue: deque = deque([(canonical_id, 0)])

        while queue:
            current_id, depth = queue.popleft()
            if depth >= max_hops:
                continue

            for neighbor_id in self._adjacency.get(current_id, []):
                if neighbor_id not in distances:
                    distances[neighbor_id] = depth + 1
                    queue.append((neighbor_id, depth + 1))

        return distances

    def find_path(
        self, source_id: int, target_id: int, max_hops: int = 3
    ) -> Optional[List[int]]:
        """BFS shortest path between two nodes.

        Returns:
            List of canonical_ids from source to target (inclusive), or None
            if no path exists within max_hops.
        """
        if source_id not in self._nodes or target_id not in self._nodes:
            return None
        if source_id == target_id:
            return [source_id]

        # BFS with parent tracking
        visited: Set[int] = {source_id}
        parent: Dict[int, int] = {}
        queue: deque = deque([(source_id, 0)])

        while queue:
            current_id, depth = queue.popleft()
            if depth >= max_hops:
                continue

            for neighbor_id in self._adjacency.get(current_id, []):
                if neighbor_id in visited:
                    continue

                visited.add(neighbor_id)
                parent[neighbor_id] = current_id

                if neighbor_id == target_id:
                    # Reconstruct path
                    path: List[int] = [target_id]
                    node = target_id
                    while node in parent:
                        node = parent[node]
                        path.append(node)
                    path.reverse()
                    return path

                queue.append((neighbor_id, depth + 1))

        return None

    # -----------------------------------------------------------------
    # RAG integration
    # -----------------------------------------------------------------

    def get_entity_context(self, canonical_id: int, max_hops: int = 2) -> Dict[str, Any]:
        """Get structured context for an entity suitable for RAG injection.

        Returns:
            Dict with keys:
            - node: the entity's NarrativeNode (as dict)
            - connected_nodes: list of connected node dicts with their distance
            - edges: list of edge dicts involving this entity
        """
        node = self._nodes.get(canonical_id)
        if node is None:
            return {"node": None, "connected_nodes": [], "edges": []}

        # Gather neighbors within max_hops
        distances = self.get_neighbors(canonical_id, max_hops=max_hops)

        connected_nodes = []
        for nid, distance in distances.items():
            if nid == canonical_id:
                continue
            neighbor = self._nodes.get(nid)
            if neighbor is not None:
                connected_nodes.append({
                    "canonical_id": neighbor.canonical_id,
                    "entity_type": neighbor.entity_type,
                    "name": neighbor.name,
                    "attributes": neighbor.attributes,
                    "distance": distance,
                })

        # Gather edges involving this entity
        edges = [
            {
                "source_id": e.source_id,
                "target_id": e.target_id,
                "relationship": e.relationship,
                "weight": e.weight,
                "evidence": e.evidence,
                "metadata": e.metadata,
            }
            for e in self.get_edges(canonical_id)
        ]

        return {
            "node": {
                "canonical_id": node.canonical_id,
                "entity_type": node.entity_type,
                "name": node.name,
                "attributes": node.attributes,
            },
            "connected_nodes": connected_nodes,
            "edges": edges,
        }

    def query_by_relationship(self, relationship: str) -> List[NarrativeEdge]:
        """Find all edges with a specific relationship type."""
        return [e for e in self._edges if e.relationship == relationship]

    # -----------------------------------------------------------------
    # Persistence
    # -----------------------------------------------------------------

    def to_dict(self) -> Dict[str, Any]:
        """Serialize the entire graph to a dict for JSON persistence."""
        return {
            "nodes": [
                {
                    "canonical_id": n.canonical_id,
                    "entity_type": n.entity_type,
                    "name": n.name,
                    "attributes": n.attributes,
                }
                for n in self._nodes.values()
            ],
            "edges": [
                {
                    "source_id": e.source_id,
                    "target_id": e.target_id,
                    "relationship": e.relationship,
                    "weight": e.weight,
                    "evidence": e.evidence,
                    "metadata": e.metadata,
                }
                for e in self._edges
            ],
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any], entity_registry: Any = None) -> NarrativeKG:
        """Deserialize a graph from a dict (inverse of to_dict)."""
        kg = cls(entity_registry=entity_registry)

        for nd in data.get("nodes", []):
            kg.add_node(NarrativeNode(
                canonical_id=nd["canonical_id"],
                entity_type=nd["entity_type"],
                name=nd["name"],
                attributes=nd.get("attributes", {}),
            ))

        for ed in data.get("edges", []):
            kg.add_edge(NarrativeEdge(
                source_id=ed["source_id"],
                target_id=ed["target_id"],
                relationship=ed["relationship"],
                weight=ed.get("weight", 1.0),
                evidence=ed.get("evidence", []),
                metadata=ed.get("metadata", {}),
            ))

        return kg
