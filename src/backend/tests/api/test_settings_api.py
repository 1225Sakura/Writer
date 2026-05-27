"""Tests for settings API endpoints.

Covers all settings sub-routers:
- Characters (CRUD, relationships, storylines)
- Items (CRUD)
- Locations (CRUD)
- Factions (CRUD)
- World Settings (CRUD)
- Rules (CRUD)
- Writing Settings (get, update)
"""

import pytest
from httpx import AsyncClient

from backend.core.domain.entities import (
    Character, Item, Location, Faction, WorldSetting, Rule,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _seed_character(db_session, name="Hero", gender="male"):
    c = Character(name=name, gender=gender, personality="brave")
    db_session.add(c)
    await db_session.commit()
    await db_session.refresh(c)
    return c


async def _seed_item(db_session, name="Sword"):
    item = Item(name=name, description="A sharp blade")
    db_session.add(item)
    await db_session.commit()
    await db_session.refresh(item)
    return item


async def _seed_location(db_session, name="Dark Forest"):
    loc = Location(name=name, description="A spooky forest")
    db_session.add(loc)
    await db_session.commit()
    await db_session.refresh(loc)
    return loc


async def _seed_faction(db_session, name="Shadow Clan"):
    faction = Faction(name=name, description="A secretive group")
    db_session.add(faction)
    await db_session.commit()
    await db_session.refresh(faction)
    return faction


async def _seed_world_setting(db_session, name="Magic System"):
    ws = WorldSetting(name=name, description="How magic works")
    db_session.add(ws)
    await db_session.commit()
    await db_session.refresh(ws)
    return ws


async def _seed_rule(db_session, name="No time travel"):
    rule = Rule(name=name, description="Time travel is forbidden", type="world_rule")
    db_session.add(rule)
    await db_session.commit()
    await db_session.refresh(rule)
    return rule


# ===========================================================================
# Character Tests
# ===========================================================================

class TestCharacterEndpoints:

    @pytest.mark.asyncio
    async def test_list_characters_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/characters")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_character(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/settings/characters",
            json={"name": "Test Hero", "gender": "male", "personality": "brave"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Test Hero"

    @pytest.mark.asyncio
    async def test_get_character(self, authenticated_client: AsyncClient, db_session):
        char = await _seed_character(db_session)
        response = await authenticated_client.get(f"/api/v1/settings/characters/{char.id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Hero"

    @pytest.mark.asyncio
    async def test_get_character_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/characters/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_character(self, authenticated_client: AsyncClient, db_session):
        char = await _seed_character(db_session)
        response = await authenticated_client.patch(
            f"/api/v1/settings/characters/{char.id}",
            json={"name": "Updated Hero"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Hero"

    @pytest.mark.asyncio
    async def test_update_character_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.patch(
            "/api/v1/settings/characters/9999",
            json={"name": "Nope"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_character(self, authenticated_client: AsyncClient, db_session):
        char = await _seed_character(db_session)
        response = await authenticated_client.delete(f"/api/v1/settings/characters/{char.id}")
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_delete_character_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/settings/characters/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_characters_with_tier_filter(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/settings/characters",
            params={"tier": "main"},
        )
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_list_character_relationships_empty(self, authenticated_client: AsyncClient, db_session):
        char = await _seed_character(db_session)
        response = await authenticated_client.get(
            f"/api/v1/settings/characters/{char.id}/relationships",
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_list_character_storylines_empty(self, authenticated_client: AsyncClient, db_session):
        char = await _seed_character(db_session)
        response = await authenticated_client.get(
            f"/api/v1/settings/characters/{char.id}/storylines",
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)


# ===========================================================================
# Item Tests
# ===========================================================================

class TestItemEndpoints:

    @pytest.mark.asyncio
    async def test_list_items_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/items")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_item(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/settings/items",
            json={"name": "Magic Staff", "description": "A powerful staff"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Magic Staff"

    @pytest.mark.asyncio
    async def test_get_item(self, authenticated_client: AsyncClient, db_session):
        item = await _seed_item(db_session)
        response = await authenticated_client.get(f"/api/v1/settings/items/{item.id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Sword"

    @pytest.mark.asyncio
    async def test_get_item_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/items/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_item(self, authenticated_client: AsyncClient, db_session):
        item = await _seed_item(db_session)
        response = await authenticated_client.patch(
            f"/api/v1/settings/items/{item.id}",
            json={"name": "Enchanted Sword"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Enchanted Sword"

    @pytest.mark.asyncio
    async def test_update_item_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.patch(
            "/api/v1/settings/items/9999",
            json={"name": "Nope"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_item(self, authenticated_client: AsyncClient, db_session):
        item = await _seed_item(db_session)
        response = await authenticated_client.delete(f"/api/v1/settings/items/{item.id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_item_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/settings/items/9999")
        assert response.status_code == 404


# ===========================================================================
# Location Tests
# ===========================================================================

class TestLocationEndpoints:

    @pytest.mark.asyncio
    async def test_list_locations_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/locations")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_location(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/settings/locations",
            json={"name": "Crystal Cave", "description": "A glowing cave"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Crystal Cave"

    @pytest.mark.asyncio
    async def test_get_location(self, authenticated_client: AsyncClient, db_session):
        loc = await _seed_location(db_session)
        response = await authenticated_client.get(f"/api/v1/settings/locations/{loc.id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Dark Forest"

    @pytest.mark.asyncio
    async def test_get_location_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/locations/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_location(self, authenticated_client: AsyncClient, db_session):
        loc = await _seed_location(db_session)
        response = await authenticated_client.patch(
            f"/api/v1/settings/locations/{loc.id}",
            json={"name": "Enchanted Forest"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Enchanted Forest"

    @pytest.mark.asyncio
    async def test_update_location_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.patch(
            "/api/v1/settings/locations/9999",
            json={"name": "Nope"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_location(self, authenticated_client: AsyncClient, db_session):
        loc = await _seed_location(db_session)
        response = await authenticated_client.delete(f"/api/v1/settings/locations/{loc.id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_location_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/settings/locations/9999")
        assert response.status_code == 404


# ===========================================================================
# Faction Tests
# ===========================================================================

class TestFactionEndpoints:

    @pytest.mark.asyncio
    async def test_list_factions_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/factions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_faction(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/settings/factions",
            json={"name": "Fire Sect", "description": "Masters of fire"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Fire Sect"

    @pytest.mark.asyncio
    async def test_get_faction(self, authenticated_client: AsyncClient, db_session):
        faction = await _seed_faction(db_session)
        response = await authenticated_client.get(f"/api/v1/settings/factions/{faction.id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Shadow Clan"

    @pytest.mark.asyncio
    async def test_get_faction_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/factions/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_faction(self, authenticated_client: AsyncClient, db_session):
        faction = await _seed_faction(db_session)
        response = await authenticated_client.patch(
            f"/api/v1/settings/factions/{faction.id}",
            json={"name": "Light Clan"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Light Clan"

    @pytest.mark.asyncio
    async def test_update_faction_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.patch(
            "/api/v1/settings/factions/9999",
            json={"name": "Nope"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_faction(self, authenticated_client: AsyncClient, db_session):
        faction = await _seed_faction(db_session)
        response = await authenticated_client.delete(f"/api/v1/settings/factions/{faction.id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_faction_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/settings/factions/9999")
        assert response.status_code == 404


# ===========================================================================
# World Setting Tests
# ===========================================================================

class TestWorldSettingEndpoints:

    @pytest.mark.asyncio
    async def test_list_world_settings_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/world")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_world_setting(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/settings/world",
            json={"name": "Gravity", "description": "How gravity works"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Gravity"

    @pytest.mark.asyncio
    async def test_get_world_setting(self, authenticated_client: AsyncClient, db_session):
        ws = await _seed_world_setting(db_session)
        response = await authenticated_client.get(f"/api/v1/settings/world/{ws.id}")
        assert response.status_code == 200
        assert response.json()["name"] == "Magic System"

    @pytest.mark.asyncio
    async def test_get_world_setting_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/world/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_world_setting(self, authenticated_client: AsyncClient, db_session):
        ws = await _seed_world_setting(db_session)
        response = await authenticated_client.patch(
            f"/api/v1/settings/world/{ws.id}",
            json={"name": "Updated Magic System"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Magic System"

    @pytest.mark.asyncio
    async def test_update_world_setting_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.patch(
            "/api/v1/settings/world/9999",
            json={"name": "Nope"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_world_setting(self, authenticated_client: AsyncClient, db_session):
        ws = await _seed_world_setting(db_session)
        response = await authenticated_client.delete(f"/api/v1/settings/world/{ws.id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_world_setting_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/settings/world/9999")
        assert response.status_code == 404


# ===========================================================================
# Rule Tests
# ===========================================================================

class TestRuleEndpoints:

    @pytest.mark.asyncio
    async def test_list_rules_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/rules")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_create_rule(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/settings/rules",
            json={"name": "Power Limit", "description": "Max power level", "type": "world_rule"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Power Limit"

    @pytest.mark.asyncio
    async def test_get_rule(self, authenticated_client: AsyncClient, db_session):
        rule = await _seed_rule(db_session)
        response = await authenticated_client.get(f"/api/v1/settings/rules/{rule.id}")
        assert response.status_code == 200
        assert response.json()["name"] == "No time travel"

    @pytest.mark.asyncio
    async def test_get_rule_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/rules/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_rule(self, authenticated_client: AsyncClient, db_session):
        rule = await _seed_rule(db_session)
        response = await authenticated_client.patch(
            f"/api/v1/settings/rules/{rule.id}",
            json={"name": "Updated Rule"},
        )
        assert response.status_code == 200
        assert response.json()["name"] == "Updated Rule"

    @pytest.mark.asyncio
    async def test_update_rule_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.patch(
            "/api/v1/settings/rules/9999",
            json={"name": "Nope"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_rule(self, authenticated_client: AsyncClient, db_session):
        rule = await _seed_rule(db_session)
        response = await authenticated_client.delete(f"/api/v1/settings/rules/{rule.id}")
        assert response.status_code == 200

    @pytest.mark.asyncio
    async def test_delete_rule_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/settings/rules/9999")
        assert response.status_code == 404


# ===========================================================================
# Writing Settings Tests
# ===========================================================================

class TestWritingSettingsEndpoints:

    @pytest.mark.asyncio
    async def test_get_writing_settings_creates_defaults(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/settings/writing")
        assert response.status_code == 200
        data = response.json()
        assert "human_ai_ratio" in data
        assert "writing_style" in data

    @pytest.mark.asyncio
    async def test_update_writing_settings(self, authenticated_client: AsyncClient):
        # First get (creates defaults)
        await authenticated_client.get("/api/v1/settings/writing")
        # Then update
        response = await authenticated_client.patch(
            "/api/v1/settings/writing",
            json={"human_ai_ratio": 0.7, "writing_style": "江南"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["human_ai_ratio"] == 0.7
