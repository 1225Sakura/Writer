"""Temporal Knowledge Graph — SVO Quad CRUD + Query + Conflict Detection.

Stores Subject-Verb-Object quads with chapter ordering, enabling temporal
narrative queries (what happened when) and graph-based conflict detection.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Index, select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import Base
from backend.services.graph_service import GraphData, GraphNode, GraphEdge

logger = logging.getLogger(__name__)


# =============================================================================
# SQLAlchemy Model
# =============================================================================


class TemporalKGQuad(Base):
    """A single Subject-Verb-Object quad in the temporal knowledge graph."""

    __tablename__ = "temporal_kg_quads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    chapter_id = Column(Integer, ForeignKey("chapters.id"), nullable=True)
    chapter_order = Column(Integer, nullable=False)
    subject = Column(String, nullable=False)
    subject_type = Column(String, nullable=True)
    subject_id = Column(Integer, nullable=True)
    verb = Column(String, nullable=False)
    object = Column(String, nullable=True)
    object_type = Column(String, nullable=True)
    object_id = Column(Integer, nullable=True)
    context_snippet = Column(Text, nullable=True)
    confidence = Column(Float, default=1.0)
    metadata_json = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (
        Index("idx_tkg_project", "project_id"),
        Index("idx_tkg_chapter", "chapter_id"),
        Index("idx_tkg_chapter_order", "chapter_order"),
        Index("idx_tkg_subject", "subject"),
        Index("idx_tkg_object", "object"),
        Index("idx_tkg_verb", "verb"),
        Index("idx_tkg_subject_id", "subject_id"),
        Index("idx_tkg_object_id", "object_id"),
    )


# =============================================================================
# Dataclass
# =============================================================================


@dataclass
class SVOQuad:
    """Domain-level SVO quad (mirrors TemporalKGQuad row)."""

    id: Optional[int] = None
    project_id: Optional[int] = None
    chapter_id: Optional[int] = None
    chapter_order: int = 0
    subject: str = ""
    subject_type: Optional[str] = None
    subject_id: Optional[int] = None
    verb: str = ""
    object: Optional[str] = None
    object_type: Optional[str] = None
    object_id: Optional[int] = None
    context_snippet: Optional[str] = None
    confidence: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)


# =============================================================================
# Conflict verb pairs (contradictory actions)
# =============================================================================

_CONFLICT_PAIRS: List[Tuple[str, str]] = [
    ("kill", "talk"),
    ("kill", "befriend"),
    ("kill", "heal"),
    ("kill", "ally"),
    ("betray", "trust"),
    ("betray", "befriend"),
    ("destroy", "build"),
    ("destroy", "repair"),
    ("imprison", "free"),
    ("exile", "welcome"),
]

# Normalize: store both directions for O(1) lookup
_CONFLICT_SET: Set[Tuple[str, str]] = set()
for a, b in _CONFLICT_PAIRS:
    _CONFLICT_SET.add((a, b))
    _CONFLICT_SET.add((b, a))


def _verbs_conflict(v1: str, v2: str) -> bool:
    """Check whether two verbs are contradictory."""
    return (v1.lower(), v2.lower()) in _CONFLICT_SET


# =============================================================================
# TemporalKG Service
# =============================================================================


class TemporalKG:
    """Temporal Knowledge Graph — SVO quad CRUD, query, and conflict detection."""

    def __init__(self, db: AsyncSession, entity_registry=None):
        """Initialise with a database session and optional EntityRegistry.

        Args:
            db: SQLAlchemy AsyncSession.
            entity_registry: Optional EntityRegistry instance for auto-resolving
                subject/object names to IDs and types.
        """
        self.db = db
        self.entity_registry = entity_registry

    # -----------------------------------------------------------------
    # CRUD
    # -----------------------------------------------------------------

    async def add_quad(self, quad: SVOQuad) -> int:
        """Insert a single SVO quad and return its ID."""
        self._maybe_resolve_entities(quad)
        row = TemporalKGQuad(
            project_id=quad.project_id,
            chapter_id=quad.chapter_id,
            chapter_order=quad.chapter_order,
            subject=quad.subject,
            subject_type=quad.subject_type,
            subject_id=quad.subject_id,
            verb=quad.verb,
            object=quad.object,
            object_type=quad.object_type,
            object_id=quad.object_id,
            context_snippet=quad.context_snippet,
            confidence=quad.confidence,
            metadata_json=json.dumps(quad.metadata) if quad.metadata else None,
        )
        self.db.add(row)
        await self.db.flush()
        return row.id

    async def add_quads_batch(self, quads: List[SVOQuad]) -> int:
        """Insert multiple quads in a batch. Returns count of inserted quads."""
        for quad in quads:
            self._maybe_resolve_entities(quad)
        rows = [
            TemporalKGQuad(
                project_id=q.project_id,
                chapter_id=q.chapter_id,
                chapter_order=q.chapter_order,
                subject=q.subject,
                subject_type=q.subject_type,
                subject_id=q.subject_id,
                verb=q.verb,
                object=q.object,
                object_type=q.object_type,
                object_id=q.object_id,
                context_snippet=q.context_snippet,
                confidence=q.confidence,
                metadata_json=json.dumps(q.metadata) if q.metadata else None,
            )
            for q in quads
        ]
        self.db.add_all(rows)
        await self.db.flush()
        return len(rows)

    async def get_quad(self, quad_id: int) -> Optional[SVOQuad]:
        """Retrieve a single quad by ID."""
        result = await self.db.execute(
            select(TemporalKGQuad).where(TemporalKGQuad.id == quad_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return None
        return self._row_to_quad(row)

    async def delete_quad(self, quad_id: int) -> bool:
        """Delete a quad by ID. Returns True if deleted."""
        result = await self.db.execute(
            select(TemporalKGQuad).where(TemporalKGQuad.id == quad_id)
        )
        row = result.scalar_one_or_none()
        if row is None:
            return False
        await self.db.delete(row)
        await self.db.flush()
        return True

    # -----------------------------------------------------------------
    # Query
    # -----------------------------------------------------------------

    async def query_by_entity(
        self,
        entity_name: str,
        entity_id: Optional[int] = None,
        as_subject: bool = True,
        as_object: bool = True,
    ) -> List[SVOQuad]:
        """Find quads where the entity appears as subject and/or object.

        Matches by name (case-insensitive) or by entity_id.
        """
        conditions = []
        name_lower = entity_name.lower()

        if as_subject:
            if entity_id is not None:
                conditions.append(
                    (TemporalKGQuad.subject == entity_name)
                    | (TemporalKGQuad.subject_id == entity_id)
                )
            else:
                conditions.append(TemporalKGQuad.subject == entity_name)

        if as_object:
            if entity_id is not None:
                conditions.append(
                    (TemporalKGQuad.object == entity_name)
                    | (TemporalKGQuad.object_id == entity_id)
                )
            else:
                conditions.append(TemporalKGQuad.object == entity_name)

        if not conditions:
            return []

        # Combine with OR
        from sqlalchemy import or_
        combined = conditions[0]
        for c in conditions[1:]:
            combined = or_(combined, c)

        result = await self.db.execute(
            select(TemporalKGQuad).where(combined).order_by(TemporalKGQuad.chapter_order)
        )
        return [self._row_to_quad(row) for row in result.scalars().all()]

    async def query_by_chapter(self, chapter_id: int) -> List[SVOQuad]:
        """Find all quads belonging to a specific chapter."""
        result = await self.db.execute(
            select(TemporalKGQuad)
            .where(TemporalKGQuad.chapter_id == chapter_id)
            .order_by(TemporalKGQuad.chapter_order)
        )
        return [self._row_to_quad(row) for row in result.scalars().all()]

    async def query_by_chapter_range(
        self, start_order: int, end_order: int
    ) -> List[SVOQuad]:
        """Find quads whose chapter_order falls within [start_order, end_order]."""
        result = await self.db.execute(
            select(TemporalKGQuad)
            .where(
                TemporalKGQuad.chapter_order >= start_order,
                TemporalKGQuad.chapter_order <= end_order,
            )
            .order_by(TemporalKGQuad.chapter_order)
        )
        return [self._row_to_quad(row) for row in result.scalars().all()]

    async def query_by_verb(
        self, verb: str, project_id: Optional[int] = None
    ) -> List[SVOQuad]:
        """Find all quads with a specific verb, optionally filtered by project."""
        stmt = select(TemporalKGQuad).where(TemporalKGQuad.verb == verb)
        if project_id is not None:
            stmt = stmt.where(TemporalKGQuad.project_id == project_id)
        stmt = stmt.order_by(TemporalKGQuad.chapter_order)
        result = await self.db.execute(stmt)
        return [self._row_to_quad(row) for row in result.scalars().all()]

    # -----------------------------------------------------------------
    # Conflict Detection
    # -----------------------------------------------------------------

    async def detect_conflicts(self, quad: SVOQuad) -> List[Dict[str, Any]]:
        """Check for contradictory quads against existing data.

        A conflict exists when two quads share the same subject-object pair
        (in either direction) but have contradictory verbs.

        Returns:
            List of conflict dicts with keys:
            - existing_quad: the conflicting SVOQuad already in the DB
            - new_quad: the incoming quad
            - reason: human-readable explanation
        """
        conflicts: List[Dict[str, Any]] = []

        # Look for quads involving the same subject/object pair
        from sqlalchemy import or_, and_

        stmt = select(TemporalKGQuad).where(
            or_(
                # Same direction: same subject + same object
                and_(
                    TemporalKGQuad.subject == quad.subject,
                    TemporalKGQuad.object == quad.object,
                ),
                # Reversed direction: subject<->object swapped
                and_(
                    TemporalKGQuad.subject == quad.object,
                    TemporalKGQuad.object == quad.subject,
                ),
            )
        )

        if quad.project_id is not None:
            stmt = stmt.where(TemporalKGQuad.project_id == quad.project_id)

        result = await self.db.execute(stmt)
        existing_rows = result.scalars().all()

        for row in existing_rows:
            existing_quad = self._row_to_quad(row)
            # Check verb conflict
            if _verbs_conflict(quad.verb, existing_quad.verb):
                conflicts.append({
                    "existing_quad": existing_quad,
                    "new_quad": quad,
                    "reason": (
                        f"Contradictory verbs: '{existing_quad.verb}' vs '{quad.verb}' "
                        f"between '{quad.subject}' and '{quad.object}'"
                    ),
                })

        return conflicts

    # -----------------------------------------------------------------
    # Graph Building
    # -----------------------------------------------------------------

    async def build_subgraph(
        self, entity_name: str, max_hops: int = 2
    ) -> Dict[str, Any]:
        """Build a subgraph centered on an entity using BFS up to max_hops.

        Returns a dict compatible with GraphService.GraphData.to_dict().
        """
        nodes_map: Dict[Tuple[str, str], GraphNode] = {}
        edges_list: List[GraphEdge] = []
        visited: Set[Tuple[str, str]] = set()

        # BFS queue: (entity_name, depth)
        queue = [(entity_name, 0)]
        node_id_counter = 1

        while queue:
            current_name, depth = queue.pop(0)
            if depth > max_hops:
                continue

            key = (current_name.lower(), "entity")
            if key in visited:
                continue
            visited.add(key)

            # Find all quads where current_name appears
            from sqlalchemy import or_
            result = await self.db.execute(
                select(TemporalKGQuad).where(
                    or_(
                        TemporalKGQuad.subject == current_name,
                        TemporalKGQuad.object == current_name,
                    )
                )
            )
            quads = result.scalars().all()

            # Add current node if not already present
            if key not in nodes_map:
                node_type = "entity"
                # Try to infer type from quads
                for q in quads:
                    if q.subject == current_name and q.subject_type:
                        node_type = q.subject_type
                        break
                    if q.object == current_name and q.object_type:
                        node_type = q.object_type
                        break

                nodes_map[key] = GraphNode(
                    id=node_id_counter,
                    type=node_type,
                    label=current_name,
                    properties={},
                )
                node_id_counter += 1

            for quad in quads:
                # Determine neighbor
                if quad.subject == current_name:
                    neighbor_name = quad.object
                    neighbor_type = quad.object_type or "entity"
                    edge_source = nodes_map[key].id
                    edge_target = None  # filled below
                else:
                    neighbor_name = quad.subject
                    neighbor_type = quad.subject_type or "entity"
                    edge_source = None
                    edge_target = nodes_map[key].id

                if neighbor_name is None:
                    continue

                neighbor_key = (neighbor_name.lower(), neighbor_type)

                # Add neighbor node
                if neighbor_key not in nodes_map:
                    nodes_map[neighbor_key] = GraphNode(
                        id=node_id_counter,
                        type=neighbor_type,
                        label=neighbor_name,
                        properties={},
                    )
                    node_id_counter += 1

                # Resolve edge endpoints
                if edge_source is None:
                    edge_source = nodes_map[neighbor_key].id
                if edge_target is None:
                    edge_target = nodes_map[neighbor_key].id

                edges_list.append(GraphEdge(
                    source=edge_source,
                    target=edge_target,
                    label=quad.verb,
                    type="svo_quad",
                    properties={
                        "chapter_order": quad.chapter_order,
                        "confidence": quad.confidence,
                        "context": quad.context_snippet or "",
                    },
                ))

                # Enqueue neighbor for BFS
                if depth < max_hops and neighbor_key not in visited:
                    queue.append((neighbor_name, depth + 1))

        graph_data = GraphData(nodes=list(nodes_map.values()), edges=edges_list)
        return graph_data.to_dict()

    # -----------------------------------------------------------------
    # Helpers
    # -----------------------------------------------------------------

    def _maybe_resolve_entities(self, quad: SVOQuad) -> None:
        """Auto-resolve subject/object names to IDs via EntityRegistry."""
        if self.entity_registry is None:
            return

        if quad.subject and quad.subject_id is None:
            record = self.entity_registry.resolve(quad.subject)
            if record:
                quad.subject_id = record.canonical_id
                quad.subject_type = quad.subject_type or record.entity_type

        if quad.object and quad.object_id is None:
            record = self.entity_registry.resolve(quad.object)
            if record:
                quad.object_id = record.canonical_id
                quad.object_type = quad.object_type or record.entity_type

    @staticmethod
    def _row_to_quad(row: TemporalKGQuad) -> SVOQuad:
        """Convert a SQLAlchemy row to an SVOQuad dataclass."""
        meta = {}
        if row.metadata_json:
            try:
                meta = json.loads(row.metadata_json)
            except (json.JSONDecodeError, TypeError):
                meta = {}

        return SVOQuad(
            id=row.id,
            project_id=row.project_id,
            chapter_id=row.chapter_id,
            chapter_order=row.chapter_order,
            subject=row.subject,
            subject_type=row.subject_type,
            subject_id=row.subject_id,
            verb=row.verb,
            object=row.object,
            object_type=row.object_type,
            object_id=row.object_id,
            context_snippet=row.context_snippet,
            confidence=row.confidence,
            metadata=meta,
        )
