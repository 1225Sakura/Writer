import pytest
from httpx import AsyncClient, ASGITransport
from interface.web.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.mark.asyncio
async def test_health_check(client):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


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
async def test_list_styles(client):
    response = await client.get("/api/v1/styles")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_get_settings(client):
    response = await client.get("/api/v1/settings")
    assert response.status_code == 200
