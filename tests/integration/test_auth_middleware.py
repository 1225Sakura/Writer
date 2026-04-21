"""
Integration tests for authentication middleware.

Tests that the X-API-Key header is properly validated across protected endpoints.
Each test runs in a transaction that is rolled back automatically.

Note: httpx ASGITransport defaults client to ("127.0.0.1", 123), which is
recognized as localhost. Since auth_skip_localhost defaults to True, auth
would be skipped. To properly test auth behavior, we patch
auth_skip_localhost to False in the relevant tests.
"""

import pytest
from unittest.mock import patch

pytestmark = pytest.mark.integration

TEST_API_KEY = "test-api-key-12345"


class TestAuthMiddleware:
    """Test authentication middleware behavior."""

    async def test_request_without_api_key_returns_401(self, client):
        """Request without X-API-Key header to protected endpoint returns 401."""
        with patch("backend.middleware.auth.settings.auth_skip_localhost", False):
            response = await client.get("/api/v1/settings/characters")
        assert response.status_code == 401
        data = response.json()
        assert "detail" in data
        assert "API key" in data["detail"] or "Missing" in data["detail"]

    async def test_request_with_correct_api_key_returns_200(self, client):
        """Request with valid X-API-Key header passes authentication."""
        headers = {"X-API-Key": TEST_API_KEY}
        with patch("backend.middleware.auth.settings.auth_skip_localhost", False):
            with patch("backend.middleware.auth.get_or_create_api_key", return_value=TEST_API_KEY):
                response = await client.get("/api/v1/settings/characters", headers=headers)
        assert response.status_code == 200

    async def test_request_with_invalid_api_key_returns_403(self, client):
        """Request with invalid X-API-Key header returns 403."""
        headers = {"X-API-Key": "invalid-key"}
        with patch("backend.middleware.auth.settings.auth_skip_localhost", False):
            with patch("backend.middleware.auth.get_or_create_api_key", return_value=TEST_API_KEY):
                response = await client.get("/api/v1/settings/characters", headers=headers)
        assert response.status_code == 403
        data = response.json()
        assert "detail" in data

    async def test_localhost_skips_auth_when_configured(self, client):
        """Localhost requests skip auth when auth_skip_localhost is True."""
        # ASGITransport defaults client to ("127.0.0.1", 123) which is localhost.
        # With auth_skip_localhost=True (default), no API key should be required.
        response = await client.get("/api/v1/settings/characters")
        assert response.status_code == 200

    async def test_auth_applies_to_settings_routes(self, client):
        """Authentication is enforced on settings endpoints."""
        headers = {"X-API-Key": TEST_API_KEY}
        with patch("backend.middleware.auth.settings.auth_skip_localhost", False):
            with patch("backend.middleware.auth.get_or_create_api_key", return_value=TEST_API_KEY):
                # Without auth
                no_auth = await client.get("/api/v1/settings/items")
                assert no_auth.status_code in (401, 403)

                # With auth
                with_auth = await client.get("/api/v1/settings/items", headers=headers)
                assert with_auth.status_code == 200

    async def test_auth_applies_to_chapters_routes(self, client):
        """Authentication is enforced on chapters endpoints."""
        headers = {"X-API-Key": TEST_API_KEY}
        with patch("backend.middleware.auth.settings.auth_skip_localhost", False):
            with patch("backend.middleware.auth.get_or_create_api_key", return_value=TEST_API_KEY):
                # Without auth
                no_auth = await client.get("/api/v1/chapters/outlines")
                assert no_auth.status_code in (401, 403)

                # With auth
                with_auth = await client.get("/api/v1/chapters/outlines", headers=headers)
                assert with_auth.status_code == 200

    async def test_health_endpoint_is_public(self, client):
        """Health check endpoint does not require authentication."""
        response = await client.get("/api/v1/health")
        assert response.status_code == 200

    async def test_root_endpoint_is_public(self, client):
        """Root endpoint does not require authentication."""
        response = await client.get("/")
        assert response.status_code == 200
