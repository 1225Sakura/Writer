"""Tests for local API authentication middleware."""

import pytest
import asyncio
from httpx import AsyncClient, ASGITransport
from fastapi import Request

from backend.middleware.auth import (
    verify_api_key,
    get_or_create_api_key,
    generate_api_key,
    set_api_key,
    clear_api_key_cache,
    _is_localhost_request,
)


@pytest.fixture(autouse=True)
def reset_auth_cache():
    """Reset API key cache before each test."""
    clear_api_key_cache()
    yield
    clear_api_key_cache()


class TestAuthHelpers:
    """Test auth helper functions."""

    def test_generate_api_key(self):
        """Test API key generation."""
        key1 = generate_api_key()
        key2 = generate_api_key()

        assert key1.startswith("writer_")
        assert key2.startswith("writer_")
        assert len(key1) > 40  # Should be reasonably long
        assert key1 != key2  # Should be unique

    @pytest.mark.asyncio
    async def test_set_and_get_api_key(self):
        """Test setting and retrieving API key."""
        test_key = "writer_test_key_12345"
        set_api_key(test_key)

        retrieved = await get_or_create_api_key()
        assert retrieved == test_key

    @pytest.mark.asyncio
    async def test_clear_api_key_cache(self):
        """Test clearing the API key cache."""
        from unittest.mock import patch
        set_api_key("test_key")
        clear_api_key_cache()

        # Patch settings.api_key to None so get_or_create generates a new key
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.api_key = None
            new_key = await get_or_create_api_key()
            assert new_key != "test_key"
            assert new_key.startswith("writer_")


class TestLocalhostDetection:
    """Test localhost request detection."""

    def test_localhost_ipv4(self):
        """Test detection of IPv4 localhost."""
        req = Request(scope={"type": "http", "client": ("127.0.0.1", 12345)})
        assert _is_localhost_request(req) is True

    def test_localhost_ipv6(self):
        """Test detection of IPv6 localhost."""
        req = Request(scope={"type": "http", "client": ("::1", 12345)})
        assert _is_localhost_request(req) is True

    def test_non_localhost(self):
        """Test that non-localhost is rejected."""
        req = Request(scope={"type": "http", "client": ("192.168.1.1", 12345)})
        assert _is_localhost_request(req) is False

    def test_no_client(self):
        """Test request with no client info."""
        req = Request(scope={"type": "http"})
        assert _is_localhost_request(req) is False


class TestVerifyApiKey:
    """Test the verify_api_key dependency directly."""

    @pytest.mark.asyncio
    async def test_verifies_valid_key(self):
        """Test that a valid API key passes verification."""
        key = generate_api_key()
        set_api_key(key)

        req = Request(scope={"type": "http", "client": ("192.168.1.1", 12345)})
        result = await verify_api_key(req, key)
        assert result is True

    @pytest.mark.asyncio
    async def test_rejects_invalid_key(self):
        """Test that an invalid API key is rejected."""
        set_api_key("writer_valid_key")

        req = Request(scope={"type": "http", "client": ("192.168.1.1", 12345)})
        with pytest.raises(Exception) as exc_info:
            await verify_api_key(req, "wrong_key")
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_rejects_missing_key(self):
        """Test that a missing API key is rejected."""
        set_api_key("writer_valid_key")

        req = Request(scope={"type": "http", "client": ("192.168.1.1", 12345)})
        with pytest.raises(Exception) as exc_info:
            await verify_api_key(req, None)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_skips_localhost(self):
        """Test that localhost requests skip auth."""
        req = Request(scope={"type": "http", "client": ("127.0.0.1", 12345)})
        result = await verify_api_key(req, None)
        assert result is True


class TestAuthModuleImports:
    """Test that auth module can be imported and has expected exports."""

    def test_require_auth_export(self):
        """Test that require_auth is exported."""
        from backend.middleware.auth import require_auth
        assert require_auth is not None

    def test_auth_response_model(self):
        """Test AuthResponse model."""
        from backend.middleware.auth import AuthResponse
        resp = AuthResponse(api_key="writer_test", message="ok")
        assert resp.api_key == "writer_test"
        assert resp.message == "ok"
