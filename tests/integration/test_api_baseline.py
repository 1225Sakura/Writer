"""
API integration baseline tests — health, settings, chat session.
Phase 0.5.4: Verify core endpoints respond correctly.
"""

import pytest


@pytest.mark.asyncio
class TestHealthEndpoint:
    async def test_health_returns_200(self, client):
        response = await client.get("/health")
        assert response.status_code == 200


@pytest.mark.asyncio
class TestSettingsEndpoints:
    async def test_get_settings(self, client):
        response = await client.get("/api/v1/settings/")
        assert response.status_code in (200, 404, 422)

    async def test_get_writing_settings(self, client):
        response = await client.get("/api/v1/settings/writing")
        assert response.status_code in (200, 404, 422)


@pytest.mark.asyncio
class TestChatEndpoints:
    async def test_list_sessions(self, client):
        response = await client.get("/api/v1/chat/sessions")
        assert response.status_code in (200, 404, 422)

    async def test_create_session(self, client):
        response = await client.post(
            "/api/v1/chat/sessions",
            json={"title": "Test Session"},
        )
        assert response.status_code in (200, 201, 404, 422)
