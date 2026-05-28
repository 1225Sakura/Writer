"""Tests for EntityRegistry — shared entity name-to-ID mapping."""

import pytest
import pytest_asyncio

from backend.core.domain.entities import Character, Item, Location, Faction
from backend.services.entity_registry import EntityRecord, EntityRegistry


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest_asyncio.fixture
async def populated_db(db_session):
    """Insert sample entities into the in-memory database."""
    # Character with aliases embedded in description
    c1 = Character(
        name="Li Xiao",
        description="Main protagonist. <!--aliases:[\"Xiao Li\",\"Young Li\"]-->",
        gender="male",
    )
    c2 = Character(name="Zhang Wei", description="Rival cultivator.")
    item = Item(name="Dragon Saber", description="Legendary weapon. <!--aliases:[\"Saber of Dragon\"]-->" )
    loc = Location(name="Azure Peak", description="A tall mountain.")
    faction = Faction(name="Iron Fist Sect", description="Martial sect. <!--aliases:[\"Iron Fist\"]-->")

    db_session.add_all([c1, c2, item, loc, faction])
    await db_session.flush()
    return db_session


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_resolve_exact_name(populated_db):
    """Character name resolves to correct ID."""
    registry = EntityRegistry()
    await registry.load_from_db(populated_db)

    record = registry.resolve("Li Xiao")
    assert record is not None
    assert record.entity_type == "character"
    assert record.canonical_name == "Li Xiao"


@pytest.mark.asyncio
async def test_resolve_alias(populated_db):
    """Alias from description JSON resolves correctly."""
    registry = EntityRegistry()
    await registry.load_from_db(populated_db)

    record = registry.resolve("Xiao Li")
    assert record is not None
    assert record.canonical_name == "Li Xiao"
    assert record.entity_type == "character"


@pytest.mark.asyncio
async def test_resolve_type_filter(populated_db):
    """Type-scoped resolution works."""
    registry = EntityRegistry()
    await registry.load_from_db(populated_db)

    # "Xiao Li" exists only as a character alias — filtering to item should miss
    assert registry.resolve("Xiao Li", entity_type="item") is None
    assert registry.resolve("Xiao Li", entity_type="character") is not None

    # Item alias
    assert registry.resolve("Saber of Dragon", entity_type="item") is not None
    assert registry.resolve("Saber of Dragon", entity_type="character") is None


@pytest.mark.asyncio
async def test_resolve_not_found(populated_db):
    """Returns None for unknown names."""
    registry = EntityRegistry()
    await registry.load_from_db(populated_db)

    assert registry.resolve("Nonexistent Hero") is None
    assert registry.resolve_all("Nonexistent Hero") == []


@pytest.mark.asyncio
async def test_bulk_register():
    """Registers multiple entities and returns count."""
    registry = EntityRegistry()

    records = [
        EntityRecord(canonical_id=1, entity_type="character", canonical_name="A"),
        EntityRecord(canonical_id=2, entity_type="item", canonical_name="B"),
        EntityRecord(
            canonical_id=3,
            entity_type="location",
            canonical_name="C",
            aliases=["See"],
        ),
    ]
    count = registry.bulk_register(records)
    assert count == 3
    assert registry.resolve("A") is not None
    assert registry.resolve("B") is not None
    assert registry.resolve("See") is not None
    assert registry.resolve("See").canonical_name == "C"


@pytest.mark.asyncio
async def test_cache_invalidation(populated_db):
    """After invalidation, fresh data is loaded."""
    registry = EntityRegistry()
    await registry.load_from_db(populated_db)
    assert registry.resolve("Li Xiao") is not None

    registry.invalidate_cache()
    assert registry.resolve("Li Xiao") is None

    # Reload and verify data is available again
    count = await registry.load_from_db(populated_db)
    assert count > 0
    assert registry.resolve("Li Xiao") is not None


@pytest.mark.asyncio
async def test_resolve_all_multiple_types():
    """resolve_all returns records across entity types sharing the same key."""
    registry = EntityRegistry()
    registry.register(
        EntityRecord(canonical_id=1, entity_type="character", canonical_name="Shadow")
    )
    registry.register(
        EntityRecord(canonical_id=9, entity_type="item", canonical_name="Shadow")
    )

    results = registry.resolve_all("Shadow")
    assert len(results) == 2
    types = {r.entity_type for r in results}
    assert types == {"character", "item"}


@pytest.mark.asyncio
async def test_get_stats(populated_db):
    """Stats reflect loaded data accurately."""
    registry = EntityRegistry()
    await registry.load_from_db(populated_db)

    stats = registry.get_stats()
    assert stats["unique_entities"] == 5  # 2 chars + 1 item + 1 location + 1 faction
    assert stats["total_keys"] >= 5  # canonical names + aliases
