"""Tests for TemporalKG — SVO quad CRUD, query, conflict detection, and graph building."""

import pytest
import pytest_asyncio

from backend.core.domain.entities import Project, Chapter, Character
from backend.services.entity_registry import EntityRegistry, EntityRecord
from backend.services.temporal_kg import TemporalKG, SVOQuad, TemporalKGQuad


# =============================================================================
# Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def project_and_chapters(db_session):
    """Insert a Project and two Chapters for FK references."""
    project = Project(name="Test Project", description="A test novel")
    db_session.add(project)
    await db_session.flush()

    ch1 = Chapter(project_id=project.id, title="Chapter 1", chapter_order=1)
    ch2 = Chapter(project_id=project.id, title="Chapter 2", chapter_order=2)
    db_session.add_all([ch1, ch2])
    await db_session.flush()
    return project, ch1, ch2


@pytest_asyncio.fixture
async def characters(db_session, project_and_chapters):
    """Insert sample characters for entity registry integration."""
    project, _, _ = project_and_chapters
    c1 = Character(project_id=project.id, name="Alice", description="Protagonist")
    c2 = Character(project_id=project.id, name="Bob", description="Antagonist")
    db_session.add_all([c1, c2])
    await db_session.flush()
    return c1, c2


@pytest_asyncio.fixture
def kg(db_session):
    """Create a TemporalKG instance."""
    return TemporalKG(db=db_session)


@pytest_asyncio.fixture
def kg_with_registry(db_session, characters):
    """Create a TemporalKG with a populated EntityRegistry."""
    registry = EntityRegistry()
    c1, c2 = characters
    registry.register(EntityRecord(
        canonical_id=c1.id, entity_type="character", canonical_name="Alice"
    ))
    registry.register(EntityRecord(
        canonical_id=c2.id, entity_type="character", canonical_name="Bob"
    ))
    return TemporalKG(db=db_session, entity_registry=registry)


# =============================================================================
# CRUD Tests
# =============================================================================


@pytest.mark.asyncio
async def test_add_and_get_quad(kg, project_and_chapters):
    """Round-trip SVO quad storage."""
    project, ch1, _ = project_and_chapters

    quad = SVOQuad(
        project_id=project.id,
        chapter_id=ch1.id,
        chapter_order=1,
        subject="Alice",
        subject_type="character",
        verb="meets",
        object="Bob",
        object_type="character",
        context_snippet="Alice met Bob at the tavern.",
        confidence=0.95,
        metadata={"source": "chapter_1_draft"},
    )

    quad_id = await kg.add_quad(quad)
    assert quad_id is not None
    assert quad_id > 0

    retrieved = await kg.get_quad(quad_id)
    assert retrieved is not None
    assert retrieved.subject == "Alice"
    assert retrieved.verb == "meets"
    assert retrieved.object == "Bob"
    assert retrieved.confidence == 0.95
    assert retrieved.metadata == {"source": "chapter_1_draft"}
    assert retrieved.context_snippet == "Alice met Bob at the tavern."


@pytest.mark.asyncio
async def test_get_quad_not_found(kg):
    """Non-existent quad ID returns None."""
    result = await kg.get_quad(99999)
    assert result is None


@pytest.mark.asyncio
async def test_add_quads_batch(kg, project_and_chapters):
    """Batch insert returns correct count."""
    project, ch1, ch2 = project_and_chapters

    quads = [
        SVOQuad(
            project_id=project.id,
            chapter_id=ch1.id,
            chapter_order=1,
            subject="Alice",
            verb="discovers",
            object="Sword",
        ),
        SVOQuad(
            project_id=project.id,
            chapter_id=ch1.id,
            chapter_order=1,
            subject="Alice",
            verb="trains",
            object="Sword",
        ),
        SVOQuad(
            project_id=project.id,
            chapter_id=ch2.id,
            chapter_order=2,
            subject="Alice",
            verb="fights",
            object="Bob",
        ),
    ]

    count = await kg.add_quads_batch(quads)
    assert count == 3

    # Verify they are all retrievable
    results = await kg.query_by_chapter(ch1.id)
    assert len(results) == 2


@pytest.mark.asyncio
async def test_delete_quad(kg, project_and_chapters):
    """Deleting a quad removes it and returns True."""
    project, ch1, _ = project_and_chapters

    quad = SVOQuad(
        project_id=project.id,
        chapter_id=ch1.id,
        chapter_order=1,
        subject="Alice",
        verb="gives",
        object="Sword",
    )
    quad_id = await kg.add_quad(quad)

    deleted = await kg.delete_quad(quad_id)
    assert deleted is True

    retrieved = await kg.get_quad(quad_id)
    assert retrieved is None


@pytest.mark.asyncio
async def test_delete_quad_not_found(kg):
    """Deleting non-existent quad returns False."""
    deleted = await kg.delete_quad(99999)
    assert deleted is False


# =============================================================================
# Query Tests
# =============================================================================


@pytest.mark.asyncio
async def test_query_by_entity_subject(kg, project_and_chapters):
    """Find quads where entity is the subject."""
    project, ch1, ch2 = project_and_chapters

    await kg.add_quads_batch([
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="Alice", verb="meets", object="Bob"),
        SVOQuad(project_id=project.id, chapter_id=ch2.id, chapter_order=2,
                subject="Bob", verb="greets", object="Alice"),
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="Alice", verb="discovers", object="Sword"),
    ])

    results = await kg.query_by_entity("Alice", as_subject=True, as_object=False)
    assert len(results) == 2
    assert all(q.subject == "Alice" for q in results)


@pytest.mark.asyncio
async def test_query_by_entity_object(kg, project_and_chapters):
    """Find quads where entity is the object."""
    project, ch1, ch2 = project_and_chapters

    await kg.add_quads_batch([
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="Alice", verb="meets", object="Bob"),
        SVOQuad(project_id=project.id, chapter_id=ch2.id, chapter_order=2,
                subject="Bob", verb="greets", object="Alice"),
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="Alice", verb="discovers", object="Sword"),
    ])

    results = await kg.query_by_entity("Alice", as_subject=False, as_object=True)
    assert len(results) == 1
    assert results[0].object == "Alice"


@pytest.mark.asyncio
async def test_query_by_entity_both_directions(kg, project_and_chapters):
    """Find quads where entity is either subject or object."""
    project, ch1, ch2 = project_and_chapters

    await kg.add_quads_batch([
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="Alice", verb="meets", object="Bob"),
        SVOQuad(project_id=project.id, chapter_id=ch2.id, chapter_order=2,
                subject="Bob", verb="greets", object="Alice"),
    ])

    results = await kg.query_by_entity("Alice", as_subject=True, as_object=True)
    assert len(results) == 2


@pytest.mark.asyncio
async def test_query_by_chapter(kg, project_and_chapters):
    """Find all quads belonging to a chapter."""
    project, ch1, ch2 = project_and_chapters

    await kg.add_quads_batch([
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="A", verb="v1", object="B"),
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="C", verb="v2", object="D"),
        SVOQuad(project_id=project.id, chapter_id=ch2.id, chapter_order=2,
                subject="E", verb="v3", object="F"),
    ])

    results = await kg.query_by_chapter(ch1.id)
    assert len(results) == 2

    results2 = await kg.query_by_chapter(ch2.id)
    assert len(results2) == 1


@pytest.mark.asyncio
async def test_query_by_chapter_range(kg, project_and_chapters):
    """Range query returns correct subset."""
    project, ch1, ch2 = project_and_chapters

    # Add a third chapter for a wider range
    ch3 = Chapter(project_id=project.id, title="Chapter 3", chapter_order=3)
    kg.db.add(ch3)
    await kg.db.flush()

    await kg.add_quads_batch([
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="A", verb="v1", object="B"),
        SVOQuad(project_id=project.id, chapter_id=ch2.id, chapter_order=2,
                subject="C", verb="v2", object="D"),
        SVOQuad(project_id=project.id, chapter_id=ch3.id, chapter_order=3,
                subject="E", verb="v3", object="F"),
    ])

    # Range [1, 2] should return 2 quads
    results = await kg.query_by_chapter_range(1, 2)
    assert len(results) == 2
    assert all(q.chapter_order <= 2 for q in results)

    # Range [2, 3] should return 2 quads
    results = await kg.query_by_chapter_range(2, 3)
    assert len(results) == 2

    # Range [1, 3] should return all 3
    results = await kg.query_by_chapter_range(1, 3)
    assert len(results) == 3


@pytest.mark.asyncio
async def test_query_by_verb(kg, project_and_chapters):
    """Find quads by verb type."""
    project, ch1, ch2 = project_and_chapters

    await kg.add_quads_batch([
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="A", verb="kill", object="B"),
        SVOQuad(project_id=project.id, chapter_id=ch2.id, chapter_order=2,
                subject="C", verb="talk", object="D"),
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="E", verb="kill", object="F"),
    ])

    results = await kg.query_by_verb("kill", project_id=project.id)
    assert len(results) == 2
    assert all(q.verb == "kill" for q in results)


# =============================================================================
# Conflict Detection Tests
# =============================================================================


@pytest.mark.asyncio
async def test_detect_conflicts_contradictory(kg, project_and_chapters):
    """Detects kill-alive conflict between same entity pair."""
    project, ch1, ch2 = project_and_chapters

    # Existing quad: Alice kills Bob
    await kg.add_quad(SVOQuad(
        project_id=project.id, chapter_id=ch1.id, chapter_order=1,
        subject="Alice", verb="kill", object="Bob",
    ))

    # New conflicting quad: Alice talks to Bob (contradicts kill)
    new_quad = SVOQuad(
        project_id=project.id, chapter_id=ch2.id, chapter_order=2,
        subject="Alice", verb="talk", object="Bob",
    )

    conflicts = await kg.detect_conflicts(new_quad)
    assert len(conflicts) == 1
    assert "Contradictory" in conflicts[0]["reason"]


@pytest.mark.asyncio
async def test_detect_conflicts_reversed_direction(kg, project_and_chapters):
    """Detects conflict even when subject/object are swapped."""
    project, ch1, ch2 = project_and_chapters

    # Existing: Alice kills Bob
    await kg.add_quad(SVOQuad(
        project_id=project.id, chapter_id=ch1.id, chapter_order=1,
        subject="Alice", verb="kill", object="Bob",
    ))

    # New: Bob talks to Alice (reversed, still contradicts)
    new_quad = SVOQuad(
        project_id=project.id, chapter_id=ch2.id, chapter_order=2,
        subject="Bob", verb="talk", object="Alice",
    )

    conflicts = await kg.detect_conflicts(new_quad)
    assert len(conflicts) == 1


@pytest.mark.asyncio
async def test_detect_conflicts_none(kg, project_and_chapters):
    """No false positives for consistent quads."""
    project, ch1, ch2 = project_and_chapters

    # Existing: Alice meets Bob
    await kg.add_quad(SVOQuad(
        project_id=project.id, chapter_id=ch1.id, chapter_order=1,
        subject="Alice", verb="meets", object="Bob",
    ))

    # New: Alice talks to Bob (compatible with "meets")
    new_quad = SVOQuad(
        project_id=project.id, chapter_id=ch2.id, chapter_order=2,
        subject="Alice", verb="talk", object="Bob",
    )

    conflicts = await kg.detect_conflicts(new_quad)
    assert len(conflicts) == 0


@pytest.mark.asyncio
async def test_detect_conflicts_different_entities(kg, project_and_chapters):
    """No conflict when verbs are contradictory but entities differ."""
    project, ch1, ch2 = project_and_chapters

    await kg.add_quad(SVOQuad(
        project_id=project.id, chapter_id=ch1.id, chapter_order=1,
        subject="Alice", verb="kill", object="Bob",
    ))

    new_quad = SVOQuad(
        project_id=project.id, chapter_id=ch2.id, chapter_order=2,
        subject="Charlie", verb="talk", object="Diana",
    )

    conflicts = await kg.detect_conflicts(new_quad)
    assert len(conflicts) == 0


# =============================================================================
# Entity Registry Integration Tests
# =============================================================================


@pytest.mark.asyncio
async def test_entity_registry_integration(kg_with_registry, project_and_chapters, characters):
    """Auto-resolves IDs from registry when adding quads."""
    project, ch1, _ = project_and_chapters
    c1, c2 = characters

    quad = SVOQuad(
        project_id=project.id,
        chapter_id=ch1.id,
        chapter_order=1,
        subject="Alice",
        verb="talks",
        object="Bob",
    )

    quad_id = await kg_with_registry.add_quad(quad)
    retrieved = await kg_with_registry.get_quad(quad_id)

    assert retrieved is not None
    assert retrieved.subject_id == c1.id
    assert retrieved.subject_type == "character"
    assert retrieved.object_id == c2.id
    assert retrieved.object_type == "character"


@pytest.mark.asyncio
async def test_entity_registry_batch_integration(kg_with_registry, project_and_chapters, characters):
    """Batch insert also resolves entity IDs."""
    project, ch1, _ = project_and_chapters
    c1, c2 = characters

    quads = [
        SVOQuad(
            project_id=project.id, chapter_id=ch1.id, chapter_order=1,
            subject="Alice", verb="greets", object="Bob",
        ),
        SVOQuad(
            project_id=project.id, chapter_id=ch1.id, chapter_order=1,
            subject="Bob", verb="bows", object="Alice",
        ),
    ]

    await kg_with_registry.add_quads_batch(quads)

    results = await kg_with_registry.query_by_chapter(ch1.id)
    assert len(results) == 2

    for q in results:
        if q.subject == "Alice":
            assert q.subject_id == c1.id
        if q.subject == "Bob":
            assert q.subject_id == c2.id


# =============================================================================
# Graph Building Tests
# =============================================================================


@pytest.mark.asyncio
async def test_build_subgraph(kg, project_and_chapters):
    """Build_subgraph returns a valid graph dict with nodes and edges."""
    project, ch1, ch2 = project_and_chapters

    await kg.add_quads_batch([
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="Alice", subject_type="character",
                verb="meets", object="Bob", object_type="character"),
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="Alice", subject_type="character",
                verb="finds", object="Sword", object_type="item"),
        SVOQuad(project_id=project.id, chapter_id=ch2.id, chapter_order=2,
                subject="Bob", subject_type="character",
                verb="steals", object="Sword", object_type="item"),
    ])

    graph = await kg.build_subgraph("Alice", max_hops=2)

    assert "nodes" in graph
    assert "edges" in graph
    assert len(graph["nodes"]) >= 3  # Alice, Bob, Sword

    node_labels = {n["label"] for n in graph["nodes"]}
    assert "Alice" in node_labels
    assert "Bob" in node_labels
    assert "Sword" in node_labels


@pytest.mark.asyncio
async def test_build_subgraph_single_entity(kg, project_and_chapters):
    """Subgraph with no connections returns just the queried entity."""
    project, ch1, _ = project_and_chapters

    await kg.add_quad(SVOQuad(
        project_id=project.id, chapter_id=ch1.id, chapter_order=1,
        subject="Lone", verb="exists", object=None,
    ))

    graph = await kg.build_subgraph("Lone", max_hops=1)
    assert len(graph["nodes"]) == 1
    assert graph["nodes"][0]["label"] == "Lone"
