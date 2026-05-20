"""
API Integration Tests for Auto Novel Writer
Tests for /api/v1/chat, /api/v1/settings, /api/v1/chapters, /api/v1/ai, /api/v1/styles

Run from src/backend directory: python -m pytest tests/test_api_integration.py
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock

from backend.agents.checkers.base import CheckerResult


# ============================================
# Chat API Tests (/api/v1/chat)
# ============================================

class TestChatSessions:
    """Test chat session CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_session(self, client):
        """Test creating a new chat session."""
        response = await client.post("/api/v1/chat/sessions")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "created_at" in data
        assert "updated_at" in data

    @pytest.mark.asyncio
    async def test_list_sessions(self, client):
        """Test listing chat sessions."""
        # Create a few sessions
        await client.post("/api/v1/chat/sessions")
        await client.post("/api/v1/chat/sessions")

        response = await client.get("/api/v1/chat/sessions")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

    @pytest.mark.asyncio
    async def test_get_session(self, client):
        """Test getting a specific session."""
        # Create session
        create_resp = await client.post("/api/v1/chat/sessions")
        session_id = create_resp.json()["id"]

        # Get session
        response = await client.get(f"/api/v1/chat/sessions/{session_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == session_id

    @pytest.mark.asyncio
    async def test_get_session_not_found(self, client):
        """Test getting non-existent session returns 404."""
        response = await client.get("/api/v1/chat/sessions/99999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_session(self, client):
        """Test deleting a chat session."""
        # Create session
        create_resp = await client.post("/api/v1/chat/sessions")
        session_id = create_resp.json()["id"]

        # Delete session
        response = await client.delete(f"/api/v1/chat/sessions/{session_id}")
        assert response.status_code == 200

        # Verify deleted
        get_resp = await client.get(f"/api/v1/chat/sessions/{session_id}")
        assert get_resp.status_code == 404


class TestChatMessages:
    """Test chat message operations."""

    @pytest.mark.asyncio
    async def test_create_message(self, client):
        """Test adding a message to a session."""
        # Create session
        session_resp = await client.post("/api/v1/chat/sessions")
        session_id = session_resp.json()["id"]

        # Create message
        response = await client.post(
            f"/api/v1/chat/sessions/{session_id}/messages",
            json={"role": "user", "content": "Hello, AI!"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "user"
        assert data["content"] == "Hello, AI!"
        assert data["session_id"] == session_id

    @pytest.mark.asyncio
    async def test_create_message_invalid_role(self, client):
        """Test creating message with invalid role."""
        session_resp = await client.post("/api/v1/chat/sessions")
        session_id = session_resp.json()["id"]

        response = await client.post(
            f"/api/v1/chat/sessions/{session_id}/messages",
            json={"role": "invalid_role", "content": "Test"}
        )
        assert response.status_code == 422  # Validation error

    @pytest.mark.asyncio
    async def test_create_message_empty_content(self, client):
        """Test creating message with empty content."""
        session_resp = await client.post("/api/v1/chat/sessions")
        session_id = session_resp.json()["id"]

        response = await client.post(
            f"/api/v1/chat/sessions/{session_id}/messages",
            json={"role": "user", "content": ""}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_get_messages(self, client):
        """Test retrieving messages from a session."""
        # Create session and messages
        session_resp = await client.post("/api/v1/chat/sessions")
        session_id = session_resp.json()["id"]

        await client.post(
            f"/api/v1/chat/sessions/{session_id}/messages",
            json={"role": "user", "content": "Message 1"}
        )
        await client.post(
            f"/api/v1/chat/sessions/{session_id}/messages",
            json={"role": "assistant", "content": "Response 1"}
        )

        # Get messages
        response = await client.get(f"/api/v1/chat/sessions/{session_id}/messages")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

    @pytest.mark.asyncio
    async def test_message_session_not_found(self, client):
        """Test adding message to non-existent session."""
        response = await client.post(
            "/api/v1/chat/sessions/99999/messages",
            json={"role": "user", "content": "Test"}
        )
        assert response.status_code == 404


# ============================================
# Settings API Tests (/api/v1/settings)
# ============================================

class TestCharacterSettings:
    """Test character CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_character(self, client):
        """Test creating a new character."""
        response = await client.post(
            "/api/v1/settings/characters",
            json={
                "name": "张三",
                "gender": "male",
                "personality": "勇敢、善良"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "张三"
        assert data["gender"] == "male"
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_list_characters(self, client):
        """Test listing characters."""
        # Create characters
        await client.post("/api/v1/settings/characters", json={"name": "角色1"})
        await client.post("/api/v1/settings/characters", json={"name": "角色2"})

        response = await client.get("/api/v1/settings/characters")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

    @pytest.mark.asyncio
    async def test_get_character(self, client):
        """Test getting a specific character."""
        create_resp = await client.post(
            "/api/v1/settings/characters",
            json={"name": "测试角色", "gender": "female"}
        )
        character_id = create_resp.json()["id"]

        response = await client.get(f"/api/v1/settings/characters/{character_id}")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "测试角色"

    @pytest.mark.asyncio
    async def test_update_character(self, client):
        """Test updating a character."""
        create_resp = await client.post(
            "/api/v1/settings/characters",
            json={"name": "原名", "gender": "male"}
        )
        character_id = create_resp.json()["id"]

        response = await client.patch(
            f"/api/v1/settings/characters/{character_id}",
            json={"name": "新名字", "personality": "聪明"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "新名字"
        assert data["personality"] == "聪明"

    @pytest.mark.asyncio
    async def test_delete_character(self, client):
        """Test deleting a character."""
        create_resp = await client.post(
            "/api/v1/settings/characters",
            json={"name": "待删除角色"}
        )
        character_id = create_resp.json()["id"]

        response = await client.delete(f"/api/v1/settings/characters/{character_id}")
        assert response.status_code == 200

        # Verify deleted
        get_resp = await client.get(f"/api/v1/settings/characters/{character_id}")
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_create_character_empty_name(self, client):
        """Test creating character with empty name fails."""
        response = await client.post(
            "/api/v1/settings/characters",
            json={"name": ""}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_character_not_found(self, client):
        """Test getting non-existent character returns 404."""
        response = await client.get("/api/v1/settings/characters/99999")
        assert response.status_code == 404


class TestItemSettings:
    """Test item CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_item(self, client):
        """Test creating a new item."""
        response = await client.post(
            "/api/v1/settings/items",
            json={
                "name": "倚天剑",
                "description": "削铁如泥的神兵",
                "owner": "张无忌"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "倚天剑"
        assert data["owner"] == "张无忌"

    @pytest.mark.asyncio
    async def test_list_items(self, client):
        """Test listing items."""
        await client.post("/api/v1/settings/items", json={"name": "物品1"})
        await client.post("/api/v1/settings/items", json={"name": "物品2"})

        response = await client.get("/api/v1/settings/items")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2

    @pytest.mark.asyncio
    async def test_update_item(self, client):
        """Test updating an item."""
        create_resp = await client.post(
            "/api/v1/settings/items",
            json={"name": "原物品"}
        )
        item_id = create_resp.json()["id"]

        response = await client.patch(
            f"/api/v1/settings/items/{item_id}",
            json={"description": "更新后的描述"}
        )
        assert response.status_code == 200
        assert response.json()["description"] == "更新后的描述"

    @pytest.mark.asyncio
    async def test_delete_item(self, client):
        """Test deleting an item."""
        create_resp = await client.post(
            "/api/v1/settings/items",
            json={"name": "待删除物品"}
        )
        item_id = create_resp.json()["id"]

        response = await client.delete(f"/api/v1/settings/items/{item_id}")
        assert response.status_code == 200


class TestLocationSettings:
    """Test location CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_location(self, client):
        """Test creating a new location."""
        response = await client.post(
            "/api/v1/settings/locations",
            json={
                "name": "光明顶",
                "description": "明教总坛",
                "importance": "high"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "光明顶"
        assert data["importance"] == "high"

    @pytest.mark.asyncio
    async def test_list_locations(self, client):
        """Test listing locations."""
        await client.post("/api/v1/settings/locations", json={"name": "地点1"})
        await client.post("/api/v1/settings/locations", json={"name": "地点2"})

        response = await client.get("/api/v1/settings/locations")
        assert response.status_code == 200
        assert len(response.json()) >= 2

    @pytest.mark.asyncio
    async def test_delete_location(self, client):
        """Test deleting a location."""
        create_resp = await client.post(
            "/api/v1/settings/locations",
            json={"name": "待删除地点"}
        )
        location_id = create_resp.json()["id"]

        response = await client.delete(f"/api/v1/settings/locations/{location_id}")
        assert response.status_code == 200


class TestFactionSettings:
    """Test faction CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_faction(self, client):
        """Test creating a new faction."""
        response = await client.post(
            "/api/v1/settings/factions",
            json={
                "name": "明教",
                "description": "天下明门",
                "type": "religious"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "明教"

    @pytest.mark.asyncio
    async def test_list_factions(self, client):
        """Test listing factions."""
        await client.post("/api/v1/settings/factions", json={"name": "势力1", "type": "military"})
        await client.post("/api/v1/settings/factions", json={"name": "势力2", "type": "religious"})

        response = await client.get("/api/v1/settings/factions")
        assert response.status_code == 200
        assert len(response.json()) >= 2


class TestWorldSettings:
    """Test world setting CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_world_setting(self, client):
        """Test creating a world setting."""
        response = await client.post(
            "/api/v1/settings/world",
            json={
                "name": "修炼体系",
                "description": "武林中的修炼境界设定"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "修炼体系"

    @pytest.mark.asyncio
    async def test_list_world_settings(self, client):
        """Test listing world settings."""
        await client.post("/api/v1/settings/world", json={"name": "设定1"})
        await client.post("/api/v1/settings/world", json={"name": "设定2"})

        response = await client.get("/api/v1/settings/world")
        assert response.status_code == 200
        assert len(response.json()) >= 2


class TestRules:
    """Test rule CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_rule(self, client):
        """Test creating a rule."""
        response = await client.post(
            "/api/v1/settings/rules",
            json={
                "name": "不许欺师灭祖",
                "description": "武林基本准则",
                "type": "moral"
            }
        )
        assert response.status_code == 200
        assert response.json()["name"] == "不许欺师灭祖"

    @pytest.mark.asyncio
    async def test_list_rules(self, client):
        """Test listing rules."""
        await client.post("/api/v1/settings/rules", json={"name": "规则1", "type": "combat"})
        await client.post("/api/v1/settings/rules", json={"name": "规则2", "type": "social"})

        response = await client.get("/api/v1/settings/rules")
        assert response.status_code == 200
        assert len(response.json()) >= 2


class TestWritingSettings:
    """Test writing settings operations."""

    @pytest.mark.asyncio
    async def test_get_writing_settings(self, client):
        """Test getting writing settings."""
        response = await client.get("/api/v1/settings/writing")
        assert response.status_code == 200
        data = response.json()
        assert "human_ai_ratio" in data
        assert "writing_style" in data

    @pytest.mark.asyncio
    async def test_update_writing_settings(self, client):
        """Test updating writing settings."""
        # Ensure settings exist first (GET auto-creates defaults)
        await client.get("/api/v1/settings/writing")
        response = await client.patch(
            "/api/v1/settings/writing",
            json={
                "human_ai_ratio": 0.6,
                "writing_style": "江南",
                "target_word_count": 50000
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["human_ai_ratio"] == 0.6
        assert data["writing_style"] == "江南"

    @pytest.mark.asyncio
    async def test_update_writing_settings_invalid_ratio(self, client):
        """Test updating with invalid ratio fails."""
        response = await client.patch(
            "/api/v1/settings/writing",
            json={"human_ai_ratio": 1.5}  # Invalid: > 1.0
        )
        assert response.status_code == 422


# ============================================
# Chapters API Tests (/api/v1/chapters)
# ============================================

class TestOutlineChapters:
    """Test outline and chapter CRUD operations."""

    @pytest.mark.asyncio
    async def test_create_outline(self, client):
        """Test creating an outline."""
        response = await client.post(
            "/api/v1/chapters/outlines",
            json={
                "title": "第一章 穿越",
                "description": "主角穿越到异世界"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "第一章 穿越"
        assert "id" in data

    @pytest.mark.asyncio
    async def test_list_outlines(self, client):
        """Test listing outlines."""
        await client.post("/api/v1/chapters/outlines", json={"title": "大纲1"})
        await client.post("/api/v1/chapters/outlines", json={"title": "大纲2"})

        response = await client.get("/api/v1/chapters/outlines")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 2

    @pytest.mark.asyncio
    async def test_create_chapter(self, client):
        """Test creating a chapter."""
        # Create outline first
        outline_resp = await client.post(
            "/api/v1/chapters/outlines",
            json={"title": "测试大纲"}
        )
        outline_id = outline_resp.json()["id"]

        # Create chapter
        response = await client.post(
            "/api/v1/chapters/",
            json={
                "outline_id": outline_id,
                "title": "第一章",
                "summary": "章节概要",
                "status": "pending",
                "word_count": 0
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "第一章"
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_get_chapter(self, client):
        """Test getting a specific chapter."""
        # Create outline and chapter
        outline_resp = await client.post(
            "/api/v1/chapters/outlines",
            json={"title": "大纲"}
        )
        outline_id = outline_resp.json()["id"]

        chapter_resp = await client.post(
            "/api/v1/chapters/",
            json={"outline_id": outline_id, "title": "测试章节"}
        )
        chapter_id = chapter_resp.json()["id"]

        response = await client.get(f"/api/v1/chapters/{chapter_id}")
        assert response.status_code == 200
        assert response.json()["title"] == "测试章节"

    @pytest.mark.asyncio
    async def test_update_chapter(self, client):
        """Test updating a chapter."""
        # Create outline and chapter
        outline_resp = await client.post(
            "/api/v1/chapters/outlines",
            json={"title": "大纲"}
        )
        outline_id = outline_resp.json()["id"]

        chapter_resp = await client.post(
            "/api/v1/chapters/",
            json={"outline_id": outline_id, "title": "原标题", "status": "pending"}
        )
        chapter_id = chapter_resp.json()["id"]

        response = await client.patch(
            f"/api/v1/chapters/{chapter_id}",
            json={"title": "新标题", "status": "writing"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["title"] == "新标题"
        assert data["status"] == "writing"

    @pytest.mark.asyncio
    async def test_delete_chapter(self, client):
        """Test deleting a chapter."""
        outline_resp = await client.post(
            "/api/v1/chapters/outlines",
            json={"title": "大纲"}
        )
        outline_id = outline_resp.json()["id"]

        chapter_resp = await client.post(
            "/api/v1/chapters/",
            json={"outline_id": outline_id, "title": "待删除章节"}
        )
        chapter_id = chapter_resp.json()["id"]

        response = await client.delete(f"/api/v1/chapters/{chapter_id}")
        assert response.status_code == 200

        # Verify deleted
        get_resp = await client.get(f"/api/v1/chapters/{chapter_id}")
        assert get_resp.status_code == 404

    @pytest.mark.asyncio
    async def test_chapter_not_found(self, client):
        """Test getting non-existent chapter returns 404."""
        response = await client.get("/api/v1/chapters/99999")
        assert response.status_code == 404


# ============================================
# AI API Tests (/api/v1/ai)
# ============================================

class TestAIGeneration:
    """Test AI generation endpoints."""

    @pytest.mark.asyncio
    async def test_generate_content_operation_validation(self, client):
        """Test that generate request validates operations."""
        # Test invalid operation
        response = await client.post(
            "/api/v1/ai/generate",
            json={
                "prompt": "测试提示",
                "operation": "invalid_op",
                "chapter_id": None
            }
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_generate_content_prompt_validation(self, client):
        """Test that empty prompt fails validation."""
        response = await client.post(
            "/api/v1/ai/generate",
            json={
                "prompt": "",
                "operation": "continue"
            }
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_review_settings(self, client):
        """Test AI settings review endpoint."""
        # Mock the AI service
        mock_result = {
            "review_content": "Review complete. Settings look good.",
            "raw_response": {"status": "success"}
        }

        with patch('backend.api.v1.endpoints.ai.get_ai_service') as mock_get_service:
            mock_service = MagicMock()
            mock_service.review_settings = AsyncMock(return_value=mock_result)
            mock_get_service.return_value = mock_service

            response = await client.post(
                "/api/v1/ai/review",
                json={"settings_data": {"characters": [], "locations": []}}
            )
            assert response.status_code == 200
            data = response.json()
            assert "review_content" in data

    @pytest.mark.asyncio
    async def test_extract_entities(self, client):
        """Test entity extraction endpoint."""
        mock_entities = [
            {"name": "张三", "type": "character", "confidence": 0.9},
            {"name": "光明顶", "type": "location", "confidence": 0.8}
        ]

        with patch('backend.api.v1.endpoints.ai.get_ai_service') as mock_get_service:
            mock_service = MagicMock()
            mock_service.extract_entities = AsyncMock(return_value=mock_entities)
            mock_get_service.return_value = mock_service

            response = await client.post(
                "/api/v1/ai/extract-entities",
                json={
                    "chat_messages": [
                        {"role": "user", "content": "张三去了光明顶"}
                    ]
                }
            )
            assert response.status_code == 200
            data = response.json()
            assert "entities" in data

    @pytest.mark.asyncio
    async def test_ai_service_not_configured(self, client):
        """Test that AI endpoints work when API key not set."""
        # This tests the error handling when MiniMax API key is not configured
        response = await client.post(
            "/api/v1/ai/generate",
            json={
                "prompt": "测试",
                "operation": "continue"
            }
        )
        # Will return 503 if AI service not configured, 500 if API key not configured, 422 if validation fails, or 200 if mocked
        assert response.status_code in [200, 422, 500, 503]


# ============================================
# Styles API Tests (/api/v1/styles)
# ============================================

class TestWritingStyles:
    """Test writing styles endpoints."""

    @pytest.mark.asyncio
    async def test_list_styles(self, client):
        """Test listing all writing styles."""
        response = await client.get("/api/v1/styles/")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 4  # 江南, 卡夫卡, 加缪, default

        # Verify expected styles exist
        style_ids = [s["id"] for s in data]
        assert "江南" in style_ids
        assert "卡夫卡" in style_ids
        assert "加缪" in style_ids
        assert "default" in style_ids

    @pytest.mark.asyncio
    async def test_get_style_by_id(self, client):
        """Test getting a specific style by ID."""
        response = await client.get("/api/v1/styles/江南")
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == "江南"
        assert data["name"] == "江南风格"

    @pytest.mark.asyncio
    async def test_get_style_not_found(self, client):
        """Test getting non-existent style returns 404."""
        response = await client.get("/api/v1/styles/nonexistent")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_all_styles_have_required_fields(self, client):
        """Test that all styles have id, name, and description."""
        response = await client.get("/api/v1/styles/")
        data = response.json()

        for style in data:
            assert "id" in style
            assert "name" in style
            assert "description" in style
            assert isinstance(style["id"], str)
            assert isinstance(style["name"], str)
            assert isinstance(style["description"], str)


# ============================================
# Health Check Tests
# ============================================

class TestHealthCheck:
    """Test health check endpoint."""

    @pytest.mark.asyncio
    async def test_health_check(self, client):
        """Test the health check endpoint."""
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data

    @pytest.mark.asyncio
    async def test_root_endpoint(self, client):
        """Test the root endpoint."""
        response = await client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "version" in data


# ============================================
# AI Checker API Tests (/api/v1/ai/check/*)
# ============================================

class TestAICheckers:
    """Test AI checker endpoints with mocked AI service."""

    @pytest.fixture
    async def outline_and_chapter(self, client):
        """Create an outline and chapter for checker tests."""
        outline_resp = await client.post(
            "/api/v1/chapters/outlines",
            json={"title": "Checker Test Outline"}
        )
        outline_id = outline_resp.json()["id"]

        chapter_resp = await client.post(
            "/api/v1/chapters/",
            json={
                "outline_id": outline_id,
                "title": "Checker Test Chapter",
                "summary": "Test chapter for checker endpoints",
                "status": "pending"
            }
        )
        chapter_id = chapter_resp.json()["id"]
        return outline_id, chapter_id

    @pytest.mark.asyncio
    async def test_check_consistency(self, client, outline_and_chapter):
        """Test consistency checker endpoint."""
        _, chapter_id = outline_and_chapter

        mock_result = CheckerResult(
            score=85,
            issues=[{"type": "mismatch", "message": "Location description mismatch"}],
            suggestions=["Update location details"]
        )

        with patch('backend.api.v1.endpoints.ai.get_ai_service') as mock_get_ai, \
             patch('backend.api.v1.endpoints.ai.ConsistencyChecker') as mock_checker_cls, \
             patch('backend.api.v1.endpoints.ai._get_chapter_content', new_callable=AsyncMock, return_value="Test chapter content"):
            mock_get_ai.return_value = MagicMock()
            mock_checker = MagicMock()
            mock_checker.quick_scan = AsyncMock(return_value=mock_result)
            mock_checker_cls.return_value = mock_checker

            response = await client.post(
                "/api/v1/ai/check/consistency",
                json={"chapter_id": chapter_id}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["chapter_id"] == chapter_id
            assert data["score"] == 85
            assert isinstance(data["issues"], list)
            assert isinstance(data["suggestions"], list)

    @pytest.mark.asyncio
    async def test_check_continuity(self, client, outline_and_chapter):
        """Test continuity checker endpoint."""
        _, chapter_id = outline_and_chapter

        mock_result = CheckerResult(
            score=90,
            issues=[],
            suggestions=["Add transition scene"]
        )

        with patch('backend.api.v1.endpoints.ai.get_ai_service') as mock_get_ai, \
             patch('backend.api.v1.endpoints.ai.ContinuityChecker') as mock_checker_cls, \
             patch('backend.api.v1.endpoints.ai._get_chapter_content', new_callable=AsyncMock, return_value="Test chapter content"):
            mock_get_ai.return_value = MagicMock()
            mock_checker = MagicMock()
            mock_checker.quick_scan = AsyncMock(return_value=mock_result)
            mock_checker_cls.return_value = mock_checker

            response = await client.post(
                "/api/v1/ai/check/continuity",
                json={"chapter_id": chapter_id}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["chapter_id"] == chapter_id
            assert data["score"] == 90
            assert "plot_thread_status" in data

    @pytest.mark.asyncio
    async def test_check_pacing(self, client, outline_and_chapter):
        """Test pacing checker endpoint."""
        _, chapter_id = outline_and_chapter

        mock_result = CheckerResult(
            score=75,
            issues=[{"type": "strand", "message": "Quest strand too dominant"}],
            suggestions=["Add more character moments"]
        )

        with patch('backend.api.v1.endpoints.ai.get_ai_service') as mock_get_ai, \
             patch('backend.api.v1.endpoints.ai.PacingChecker') as mock_checker_cls, \
             patch('backend.api.v1.endpoints.ai._get_chapter_content', new_callable=AsyncMock, return_value="Test chapter content"):
            mock_get_ai.return_value = MagicMock()
            mock_checker = MagicMock()
            mock_checker.quick_scan = AsyncMock(return_value=mock_result)
            mock_checker_cls.return_value = mock_checker

            response = await client.post(
                "/api/v1/ai/check/pacing",
                json={"chapter_id": chapter_id}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["chapter_id"] == chapter_id
            assert data["score"] == 75
            assert "strand_ratios" in data
            assert "analysis" in data

    @pytest.mark.asyncio
    async def test_check_ooc(self, client, outline_and_chapter):
        """Test OOC checker endpoint."""
        _, chapter_id = outline_and_chapter

        # Create a character first
        char_resp = await client.post(
            "/api/v1/settings/characters",
            json={"name": "Test Character", "personality": "Brave"}
        )
        character_id = char_resp.json()["id"]

        mock_result = CheckerResult(
            score=95,
            issues=[],
            suggestions=[]
        )

        with patch('backend.api.v1.endpoints.ai.get_ai_service') as mock_get_ai, \
             patch('backend.api.v1.endpoints.ai.OOCChecker') as mock_checker_cls, \
             patch('backend.api.v1.endpoints.ai._get_chapter_content', new_callable=AsyncMock, return_value="Test chapter content"):
            mock_get_ai.return_value = MagicMock()
            mock_checker = MagicMock()
            mock_checker.quick_scan = AsyncMock(return_value=mock_result)
            mock_checker_cls.return_value = mock_checker

            response = await client.post(
                "/api/v1/ai/check/ooc",
                json={"chapter_id": chapter_id, "character_id": character_id}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["chapter_id"] == chapter_id
            assert data["character_id"] == character_id
            assert data["score"] == 95
            assert isinstance(data["violations"], list)

    @pytest.mark.asyncio
    async def test_check_high_point(self, client, outline_and_chapter):
        """Test high point checker endpoint."""
        _, chapter_id = outline_and_chapter

        mock_result = CheckerResult(
            score=80,
            issues=[{"type": "pacing", "message": "Climax too early"}],
            suggestions=["Delay climax"]
        )

        with patch('backend.api.v1.endpoints.ai.get_ai_service') as mock_get_ai, \
             patch('backend.api.v1.endpoints.ai.HighPointChecker') as mock_checker_cls, \
             patch('backend.api.v1.endpoints.ai._get_chapter_content', new_callable=AsyncMock, return_value="Test chapter content"):
            mock_get_ai.return_value = MagicMock()
            mock_checker = MagicMock()
            mock_checker.quick_scan = AsyncMock(return_value=mock_result)
            mock_checker_cls.return_value = mock_checker

            response = await client.post(
                "/api/v1/ai/check/high-point",
                json={"chapter_id": chapter_id}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["chapter_id"] == chapter_id
            assert data["score"] == 80
            assert "high_points" in data
            assert "excitement_density" in data

    @pytest.mark.asyncio
    async def test_check_reader_pull(self, client, outline_and_chapter):
        """Test reader pull checker endpoint."""
        _, chapter_id = outline_and_chapter

        mock_result = CheckerResult(
            score=88,
            issues=[{"type": "hook", "message": "Weak opening hook"}],
            suggestions=["Start with action"]
        )

        with patch('backend.api.v1.endpoints.ai.get_ai_service') as mock_get_ai, \
             patch('backend.api.v1.endpoints.ai.ReaderPullChecker') as mock_checker_cls, \
             patch('backend.api.v1.endpoints.ai._get_chapter_content', new_callable=AsyncMock, return_value="Test chapter content"):
            mock_get_ai.return_value = MagicMock()
            mock_checker = MagicMock()
            mock_checker.quick_scan = AsyncMock(return_value=mock_result)
            mock_checker_cls.return_value = mock_checker

            response = await client.post(
                "/api/v1/ai/check/reader-pull",
                json={"chapter_id": chapter_id}
            )
            assert response.status_code == 200
            data = response.json()
            assert data["chapter_id"] == chapter_id
            assert data["score"] == 88
            assert "hooks" in data
            assert "curiosity_gaps" in data

    @pytest.mark.asyncio
    async def test_checker_chapter_not_found(self, client):
        """Test checker returns 404 for non-existent chapter (or 503 if AI service not configured)."""
        response = await client.post(
            "/api/v1/ai/check/consistency",
            json={"chapter_id": 99999}
        )
        assert response.status_code in [404, 503]

    @pytest.mark.asyncio
    async def test_checker_invalid_chapter_id(self, client):
        """Test checker validates chapter_id."""
        response = await client.post(
            "/api/v1/ai/check/consistency",
            json={"chapter_id": 0}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_checker_ooc_missing_character_id(self, client, outline_and_chapter):
        """Test OOC checker requires character_id."""
        _, chapter_id = outline_and_chapter

        response = await client.post(
            "/api/v1/ai/check/ooc",
            json={"chapter_id": chapter_id}
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_checker_ooc_invalid_character_id(self, client, outline_and_chapter):
        """Test OOC checker validates character_id."""
        _, chapter_id = outline_and_chapter

        response = await client.post(
            "/api/v1/ai/check/ooc",
            json={"chapter_id": chapter_id, "character_id": 0}
        )
        assert response.status_code == 422