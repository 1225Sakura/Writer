import pytest
from httpx import AsyncClient, ASGITransport
from backend.interface.web.main import app


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"


@pytest.mark.asyncio
async def test_root(client):
    response = await client.get("/")
    assert response.status_code == 200
    assert "version" in response.json()


@pytest.mark.asyncio
async def test_create_chat_session(client):
    response = await client.post("/api/v1/chat/sessions")
    assert response.status_code == 200
    data = response.json()
    assert "id" in data
    assert "created_at" in data


@pytest.mark.asyncio
async def test_list_chat_sessions(client):
    response = await client.get("/api/v1/chat/sessions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_list_styles(authenticated_client):
    response = await authenticated_client.get("/api/v1/styles/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_characters(client):
    response = await client.get("/api/v1/settings/characters")
    assert response.status_code == 200
