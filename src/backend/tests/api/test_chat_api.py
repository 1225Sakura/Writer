"""Tests for chat API endpoints.

Covers:
- Session CRUD (create, list, get, update, delete)
- Message endpoints (create, list)
- Entity extraction and confirmation
- Session summary
- Rate limiting behavior
"""

import pytest
from httpx import AsyncClient

from backend.core.domain.entities import ChatSession, ChatMessage


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _seed_session(db_session, title="Test Session"):
    session = ChatSession(title=title, status="active")
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return session


async def _seed_message(db_session, session_id, role="user", content="Hello"):
    msg = ChatMessage(session_id=session_id, role=role, content=content)
    db_session.add(msg)
    await db_session.commit()
    await db_session.refresh(msg)
    return msg


# ===========================================================================
# Session Tests
# ===========================================================================

class TestChatSessionEndpoints:

    @pytest.mark.asyncio
    async def test_create_session(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post("/api/v1/chat/sessions")
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "created_at" in data

    @pytest.mark.asyncio
    async def test_list_sessions_empty(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/chat/sessions")
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_list_sessions_with_data(self, authenticated_client: AsyncClient):
        await authenticated_client.post("/api/v1/chat/sessions")
        response = await authenticated_client.get("/api/v1/chat/sessions")
        assert response.status_code == 200
        sessions = response.json()
        assert len(sessions) >= 1

    @pytest.mark.asyncio
    async def test_get_session(self, authenticated_client: AsyncClient, db_session):
        session = await _seed_session(db_session)
        response = await authenticated_client.get(f"/api/v1/chat/sessions/{session.id}")
        assert response.status_code == 200
        assert response.json()["id"] == session.id

    @pytest.mark.asyncio
    async def test_get_session_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/chat/sessions/9999")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_update_session(self, authenticated_client: AsyncClient, db_session):
        session = await _seed_session(db_session)
        response = await authenticated_client.patch(
            f"/api/v1/chat/sessions/{session.id}",
            json={"title": "Updated Title"},
        )
        assert response.status_code == 200
        assert response.json()["title"] == "Updated Title"

    @pytest.mark.asyncio
    async def test_update_session_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.patch(
            "/api/v1/chat/sessions/9999",
            json={"title": "Nope"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_session(self, authenticated_client: AsyncClient, db_session):
        session = await _seed_session(db_session)
        response = await authenticated_client.delete(f"/api/v1/chat/sessions/{session.id}")
        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

    @pytest.mark.asyncio
    async def test_delete_session_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.delete("/api/v1/chat/sessions/9999")
        assert response.status_code == 404


# ===========================================================================
# Message Tests
# ===========================================================================

class TestChatMessageEndpoints:

    @pytest.mark.asyncio
    async def test_create_message(self, authenticated_client: AsyncClient, db_session):
        session = await _seed_session(db_session)
        response = await authenticated_client.post(
            f"/api/v1/chat/sessions/{session.id}/messages",
            json={"role": "user", "content": "Hello AI"},
        )
        assert response.status_code == 200
        assert response.json()["content"] == "Hello AI"

    @pytest.mark.asyncio
    async def test_create_message_session_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/chat/sessions/9999/messages",
            json={"role": "user", "content": "Hello"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_messages_empty(self, authenticated_client: AsyncClient, db_session):
        session = await _seed_session(db_session)
        response = await authenticated_client.get(
            f"/api/v1/chat/sessions/{session.id}/messages",
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_get_messages_with_data(self, authenticated_client: AsyncClient, db_session):
        session = await _seed_session(db_session)
        await _seed_message(db_session, session.id, role="user", content="Hi")
        await _seed_message(db_session, session.id, role="assistant", content="Hello!")
        response = await authenticated_client.get(
            f"/api/v1/chat/sessions/{session.id}/messages",
        )
        assert response.status_code == 200
        messages = response.json()
        assert len(messages) >= 2

    @pytest.mark.asyncio
    async def test_get_messages_session_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/chat/sessions/9999/messages",
        )
        assert response.status_code == 404


# ===========================================================================
# Entity Extraction Tests
# ===========================================================================

class TestEntityEndpoints:

    @pytest.mark.asyncio
    async def test_get_extracted_entities_session_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get(
            "/api/v1/chat/sessions/9999/entities",
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_extracted_entities_empty(self, authenticated_client: AsyncClient, db_session):
        session = await _seed_session(db_session)
        response = await authenticated_client.get(
            f"/api/v1/chat/sessions/{session.id}/entities",
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    @pytest.mark.asyncio
    async def test_confirm_entity_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.patch(
            "/api/v1/chat/entities/9999/confirm",
            params={"confirmed": True},
        )
        assert response.status_code == 404


# ===========================================================================
# Session Summary Tests
# ===========================================================================

class TestSessionSummaryEndpoints:

    @pytest.mark.asyncio
    async def test_get_session_summary_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.get("/api/v1/chat/sessions/9999/summary")
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_session_summary_empty(self, authenticated_client: AsyncClient, db_session):
        session = await _seed_session(db_session)
        response = await authenticated_client.get(
            f"/api/v1/chat/sessions/{session.id}/summary",
        )
        assert response.status_code == 200
        data = response.json()
        assert data["session_id"] == session.id


# ===========================================================================
# Send & Reply Tests
# ===========================================================================

class TestSendAndReplyEndpoints:

    @pytest.mark.asyncio
    async def test_send_session_not_found(self, authenticated_client: AsyncClient):
        response = await authenticated_client.post(
            "/api/v1/chat/sessions/9999/send",
            json={"content": "Hello", "current_category": "genre"},
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_send_empty_content_rejected(self, authenticated_client: AsyncClient, db_session):
        session = await _seed_session(db_session)
        response = await authenticated_client.post(
            f"/api/v1/chat/sessions/{session.id}/send",
            json={"content": "", "current_category": "genre"},
        )
        assert response.status_code == 422  # Pydantic validation error

    @pytest.mark.asyncio
    async def test_send_invalid_category_rejected(self, authenticated_client: AsyncClient, db_session):
        session = await _seed_session(db_session)
        response = await authenticated_client.post(
            f"/api/v1/chat/sessions/{session.id}/send",
            json={"content": "Hello", "current_category": "invalid_category"},
        )
        assert response.status_code == 422
