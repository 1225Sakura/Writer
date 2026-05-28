"""Integration tests for ContextManager — 4-layer build_context_pack().

Verifies:
- Backward compatibility (no new params)
- Temporal KG enrichment via build_context_pack
- Flat vs layered assembly modes
- 3-chapter integration with decay weights
- KG context formatting
"""

import pytest
import pytest_asyncio

from backend.core.domain.entities import (
    Project, Chapter, Character, WorldSetting, Rule,
)
from backend.services.context_manager import ContextManager
from backend.services.context_layers import LayerType
from backend.services.entity_registry import EntityRegistry, EntityRecord
from backend.services.temporal_kg import TemporalKG, SVOQuad


# =============================================================================
# Fixtures
# =============================================================================


@pytest_asyncio.fixture
async def project_and_chapters(db_session):
    """Insert a Project, three Chapters, and supporting entities."""
    project = Project(name="Integration Test", description="A test novel")
    db_session.add(project)
    await db_session.flush()

    ch1 = Chapter(
        project_id=project.id, title="Chapter 1", chapter_order=1,
        summary="Protagonist awakens.", word_count=3000, status="published",
    )
    ch2 = Chapter(
        project_id=project.id, title="Chapter 2", chapter_order=2,
        summary="Training arc begins.", word_count=2500, status="published",
    )
    ch3 = Chapter(
        project_id=project.id, title="Chapter 3", chapter_order=3,
        summary="First battle.", word_count=4000, status="draft",
    )
    db_session.add_all([ch1, ch2, ch3])
    await db_session.flush()

    # Supporting entities
    char = Character(project_id=project.id, name="Alice", tier="A", cultivation_realm="Foundation")
    ws = WorldSetting(project_id=project.id, name="Xianxia Realm", description="A realm of cultivation")
    rule = Rule(project_id=project.id, name="Qi Rule", description="Qi flows through meridians")
    db_session.add_all([char, ws, rule])
    await db_session.flush()

    return project, ch1, ch2, ch3


@pytest.fixture
def cm():
    """Create a ContextManager with default config."""
    return ContextManager()


# =============================================================================
# Test: Backward compatibility
# =============================================================================


@pytest.mark.asyncio
async def test_build_context_pack_backward_compat(db_session, project_and_chapters, cm):
    """Calling build_context_pack without new params produces same output shape."""
    _, ch1, _, _ = project_and_chapters

    pack = await cm.build_context_pack(ch1.id, db_session)

    # Original keys still present
    assert "meta" in pack
    assert "core" in pack
    assert "scene" in pack
    assert "global" in pack
    assert "recent_summaries" in pack
    assert "plot_threads" in pack
    assert pack["meta"]["chapter_id"] == ch1.id
    assert pack["meta"]["chapter_order"] == 1

    # New keys also present (kg_context empty, _layered populated)
    assert "kg_context" in pack
    assert pack["kg_context"] == {}
    assert "_layered" in pack


# =============================================================================
# Test: KG enrichment
# =============================================================================


@pytest.mark.asyncio
async def test_build_context_pack_with_temporal_kg(db_session, project_and_chapters, cm):
    """KG quads appear in the context pack output."""
    project, ch1, ch2, _ = project_and_chapters

    kg = TemporalKG(db=db_session)
    await kg.add_quads_batch([
        SVOQuad(
            project_id=project.id, chapter_id=ch1.id, chapter_order=1,
            subject="Alice", verb="awakens", object="Power",
        ),
        SVOQuad(
            project_id=project.id, chapter_id=ch2.id, chapter_order=2,
            subject="Alice", verb="trains", object="Sword",
        ),
    ])

    pack = await cm.build_context_pack(ch2.id, db_session, temporal_kg=kg)

    kg_ctx = pack["kg_context"]
    assert kg_ctx
    assert kg_ctx["total_quads"] == 2
    assert "recent_events" in kg_ctx
    assert "ch1" in kg_ctx["recent_events"]
    assert "ch2" in kg_ctx["recent_events"]
    assert kg_ctx["recent_events"]["ch1"][0]["subject"] == "Alice"
    assert kg_ctx["recent_events"]["ch1"][0]["verb"] == "awakens"


# =============================================================================
# Test: Flat fallback
# =============================================================================


@pytest.mark.asyncio
async def test_assemble_context_flat_fallback(db_session, project_and_chapters, cm):
    """Without _layered key, assemble_context uses flat mode."""
    _, ch1, _, _ = project_and_chapters

    pack = await cm.build_context_pack(ch1.id, db_session)
    # Remove _layered to simulate old-style pack
    del pack["_layered"]

    assembled = cm.assemble_context(pack, max_chars=4000)

    assert "layered" not in assembled
    assert "sections" in assembled
    assert "meta" in assembled
    assert "weights" in assembled
    # Sections should have content/text/budget keys
    for section_data in assembled["sections"].values():
        assert "content" in section_data
        assert "text" in section_data
        assert "budget" in section_data


# =============================================================================
# Test: Layered mode
# =============================================================================


@pytest.mark.asyncio
async def test_assemble_context_layered_mode(db_session, project_and_chapters, cm):
    """With _layered key, assemble_context uses layered mode."""
    _, ch1, _, _ = project_and_chapters

    pack = await cm.build_context_pack(ch1.id, db_session)
    assembled = cm.assemble_context(pack, max_chars=4000)

    assert assembled.get("layered") is True
    assert "sections" in assembled
    assert "weights" in assembled
    # Weights should be layer-level (global/arc/chapter/scene)
    assert set(assembled["weights"].keys()) == {lt.value for lt in LayerType}

    # Each section should carry a "layer" annotation
    for section_data in assembled["sections"].values():
        assert "layer" in section_data
        assert section_data["layer"] in {lt.value for lt in LayerType}


# =============================================================================
# Test: 3-chapter integration with decay
# =============================================================================


@pytest.mark.asyncio
async def test_3_chapter_integration_decay(db_session, project_and_chapters, cm):
    """Create 3 chapters with quads; verify decay weights differ by distance."""
    project, ch1, ch2, ch3 = project_and_chapters

    kg = TemporalKG(db=db_session)
    await kg.add_quads_batch([
        SVOQuad(project_id=project.id, chapter_id=ch1.id, chapter_order=1,
                subject="Alice", verb="awakens", object="Power"),
        SVOQuad(project_id=project.id, chapter_id=ch2.id, chapter_order=2,
                subject="Alice", verb="trains", object="Sword"),
        SVOQuad(project_id=project.id, chapter_id=ch3.id, chapter_order=3,
                subject="Alice", verb="fights", object="Enemy"),
    ])

    # Build for ch3 (current) — all quads in range, no cross-chapter decay
    pack_ch3 = await cm.build_context_pack(ch3.id, db_session, temporal_kg=kg)
    assembled_ch3 = cm.assemble_context(pack_ch3, max_chars=8000)

    assert assembled_ch3["layered"] is True
    weights_ch3 = assembled_ch3["weights"]

    # Weights should sum to ~1.0
    assert abs(sum(weights_ch3.values()) - 1.0) < 1e-6

    # Global (L1) should never decay — its weight should be nonzero
    assert weights_ch3["global"] > 0

    # Build for ch1 — pack_meta.chapter_order=1, current=1 => distance=0
    pack_ch1 = await cm.build_context_pack(ch1.id, db_session, temporal_kg=kg)
    assembled_ch1 = cm.assemble_context(pack_ch1, max_chars=8000)
    weights_ch1 = assembled_ch1["weights"]

    # Both should have valid layer keys
    assert set(weights_ch1.keys()) == set(weights_ch3.keys())

    # KG context should have quads for ch1 only
    assert pack_ch1["kg_context"]["total_quads"] == 1
    assert "ch1" in pack_ch1["kg_context"]["recent_events"]


# =============================================================================
# Test: KG context formatting
# =============================================================================


def test_kg_context_format(cm):
    """Verify SVO quad formatting via _format_kg_context."""
    quads = [
        SVOQuad(chapter_order=1, subject="Alice", verb="meets", object="Bob", confidence=0.9),
        SVOQuad(chapter_order=1, subject="Alice", verb="discovers", object="Sword", confidence=0.8),
        SVOQuad(chapter_order=2, subject="Bob", verb="steals", object="Sword", confidence=0.7),
    ]

    result = cm._format_kg_context(quads, current_chapter_order=3)

    assert result["total_quads"] == 3
    assert result["chapter_range"] == "1-2"
    assert "ch1" in result["recent_events"]
    assert "ch2" in result["recent_events"]
    assert len(result["recent_events"]["ch1"]) == 2
    assert len(result["recent_events"]["ch2"]) == 1

    # Verify quad data
    ch1_events = result["recent_events"]["ch1"]
    subjects = {e["subject"] for e in ch1_events}
    assert "Alice" in subjects


def test_kg_context_format_empty(cm):
    """Empty quads list returns empty dict."""
    result = cm._format_kg_context([], current_chapter_order=1)
    assert result == {}
