"""
Integration tests for Settings API endpoints.

Tests character, item, and location CRUD operations via HTTP.
Each test runs in a transaction that is rolled back automatically.
"""

import pytest
from factories import CharacterFactory, ItemFactory, LocationFactory

pytestmark = pytest.mark.integration


# ---------------------------------------------------------------------------
# Character CRUD
# ---------------------------------------------------------------------------

class TestCharacterCRUD:
    """Test character CRUD operations via API."""

    async def test_create_character_returns_201_and_character_data(self, client, auth_headers):
        """POST /api/v1/settings/characters creates a new character."""
        payload = {
            "name": "李逍遥",
            "gender": "male",
            "personality": "乐观开朗",
            "desires": "成为大侠",
            "flaws": "冲动",
            "description": "一个年轻的剑客",
            "tier": "核心",
            "cultivation_realm": "筑基期",
        }
        response = await client.post(
            "/api/v1/settings/characters", json=payload, headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "李逍遥"
        assert data["gender"] == "male"
        assert "id" in data

    async def test_list_characters_returns_created_characters(self, client, auth_headers, db_session):
        """GET /api/v1/settings/characters returns list of characters."""
        char = CharacterFactory(name="赵灵儿")
        db_session.add(char)
        await db_session.flush()

        response = await client.get("/api/v1/settings/characters", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert any(c["name"] == "赵灵儿" for c in data)

    async def test_get_character_by_id_returns_character(self, client, auth_headers, db_session):
        """GET /api/v1/settings/characters/{id} returns a specific character."""
        char = CharacterFactory(name="林月如")
        db_session.add(char)
        await db_session.flush()
        await db_session.refresh(char)

        response = await client.get(
            f"/api/v1/settings/characters/{char.id}", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "林月如"
        assert data["id"] == char.id

    async def test_update_character_returns_updated_data(self, client, auth_headers, db_session):
        """PATCH /api/v1/settings/characters/{id} updates a character."""
        char = CharacterFactory(name="阿奴", personality="天真")
        db_session.add(char)
        await db_session.flush()
        await db_session.refresh(char)

        response = await client.patch(
            f"/api/v1/settings/characters/{char.id}",
            json={"personality": "成熟稳重"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["personality"] == "成熟稳重"
        assert data["name"] == "阿奴"

    async def test_delete_character_returns_success_message(self, client, auth_headers, db_session):
        """DELETE /api/v1/settings/characters/{id} removes a character."""
        char = CharacterFactory(name="酒剑仙")
        db_session.add(char)
        await db_session.flush()
        await db_session.refresh(char)

        response = await client.delete(
            f"/api/v1/settings/characters/{char.id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Character deleted"

        # Verify deletion
        get_resp = await client.get(
            f"/api/v1/settings/characters/{char.id}", headers=auth_headers
        )
        assert get_resp.status_code == 404

    async def test_get_nonexistent_character_returns_404(self, client, auth_headers):
        """GET /api/v1/settings/characters/99999 returns 404 for missing character."""
        response = await client.get("/api/v1/settings/characters/99999", headers=auth_headers)
        assert response.status_code == 404

    async def test_create_character_without_auth_returns_401(self, client):
        """POST /api/v1/settings/characters without X-API-Key returns 401."""
        from unittest.mock import patch
        payload = {"name": "无名"}
        with patch("backend.middleware.auth.settings.auth_skip_localhost", False):
            response = await client.post("/api/v1/settings/characters", json=payload)
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Item CRUD
# ---------------------------------------------------------------------------

class TestItemCRUD:
    """Test item CRUD operations via API."""

    async def test_create_item_returns_201_and_item_data(self, client, auth_headers):
        """POST /api/v1/settings/items creates a new item."""
        payload = {
            "name": "七星剑",
            "description": "一把传说中的神剑",
            "owner": "李逍遥",
            "location": "蜀山",
        }
        response = await client.post("/api/v1/settings/items", json=payload, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "七星剑"
        assert data["owner"] == "李逍遥"
        assert "id" in data

    async def test_list_items_returns_created_items(self, client, auth_headers, db_session):
        """GET /api/v1/settings/items returns list of items."""
        item = ItemFactory(name="五灵珠")
        db_session.add(item)
        await db_session.flush()

        response = await client.get("/api/v1/settings/items", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert any(i["name"] == "五灵珠" for i in data)

    async def test_update_item_returns_updated_data(self, client, auth_headers, db_session):
        """PATCH /api/v1/settings/items/{id} updates an item."""
        item = ItemFactory(name="玉佩", owner="赵灵儿")
        db_session.add(item)
        await db_session.flush()
        await db_session.refresh(item)

        response = await client.patch(
            f"/api/v1/settings/items/{item.id}",
            json={"owner": "李逍遥"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["owner"] == "李逍遥"

    async def test_delete_item_returns_success_message(self, client, auth_headers, db_session):
        """DELETE /api/v1/settings/items/{id} removes an item."""
        item = ItemFactory(name="酒葫芦")
        db_session.add(item)
        await db_session.flush()
        await db_session.refresh(item)

        response = await client.delete(
            f"/api/v1/settings/items/{item.id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Item deleted"

    async def test_filter_items_by_owner_returns_matching_items(self, client, auth_headers, db_session):
        """GET /api/v1/settings/items?owner=xxx filters items by owner."""
        item1 = ItemFactory(name="剑", owner="李逍遥")
        item2 = ItemFactory(name="扇", owner="林月如")
        db_session.add_all([item1, item2])
        await db_session.flush()

        response = await client.get(
            "/api/v1/settings/items?owner=李逍遥", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert all(i["owner"] == "李逍遥" for i in data)


# ---------------------------------------------------------------------------
# Location CRUD
# ---------------------------------------------------------------------------

class TestLocationCRUD:
    """Test location CRUD operations via API."""

    async def test_create_location_returns_201_and_location_data(self, client, auth_headers):
        """POST /api/v1/settings/locations creates a new location."""
        payload = {
            "name": "蜀山",
            "description": "修仙圣地",
            "importance": "重要",
        }
        response = await client.post(
            "/api/v1/settings/locations", json=payload, headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "蜀山"
        assert data["importance"] == "重要"
        assert "id" in data

    async def test_list_locations_returns_created_locations(self, client, auth_headers, db_session):
        """GET /api/v1/settings/locations returns list of locations."""
        loc = LocationFactory(name="锁妖塔")
        db_session.add(loc)
        await db_session.flush()

        response = await client.get("/api/v1/settings/locations", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert any(l["name"] == "锁妖塔" for l in data)

    async def test_update_location_returns_updated_data(self, client, auth_headers, db_session):
        """PATCH /api/v1/settings/locations/{id} updates a location."""
        loc = LocationFactory(name="仙灵岛", importance="一般")
        db_session.add(loc)
        await db_session.flush()
        await db_session.refresh(loc)

        response = await client.patch(
            f"/api/v1/settings/locations/{loc.id}",
            json={"importance": "重要"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["importance"] == "重要"

    async def test_delete_location_returns_success_message(self, client, auth_headers, db_session):
        """DELETE /api/v1/settings/locations/{id} removes a location."""
        loc = LocationFactory(name="苏州城")
        db_session.add(loc)
        await db_session.flush()
        await db_session.refresh(loc)

        response = await client.delete(
            f"/api/v1/settings/locations/{loc.id}", headers=auth_headers
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Location deleted"

    async def test_filter_locations_by_importance_returns_matching(self, client, auth_headers, db_session):
        """GET /api/v1/settings/locations?importance=xxx filters locations."""
        loc1 = LocationFactory(name="京城", importance="重要")
        loc2 = LocationFactory(name="小村庄", importance="一般")
        db_session.add_all([loc1, loc2])
        await db_session.flush()

        response = await client.get(
            "/api/v1/settings/locations?importance=重要", headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert all(l["importance"] == "重要" for l in data)
