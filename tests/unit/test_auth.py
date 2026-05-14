"""Unit tests for authentication middleware.

Covers API key generation, verification, and localhost skip logic.
No database required — all tests use mocks and in-memory state.
"""

import pytest
from fastapi import Request, HTTPException
from unittest.mock import patch, MagicMock

from backend.middleware.auth import (
    generate_api_key,
    get_or_create_api_key,
    set_api_key,
    clear_api_key_cache,
    verify_api_key,
    _is_localhost_request,
    AuthConfig,
    AuthResponse,
)


# ============================================
# generate_api_key
# ============================================

class TestGenerateApiKey:
    """Tests for generate_api_key function."""

    def test_returns_string(self):
        """Returns a string value."""
        key = generate_api_key()
        assert isinstance(key, str)

    def test_starts_with_writer_prefix(self):
        """Generated key starts with 'writer_' prefix."""
        key = generate_api_key()
        assert key.startswith("writer_")

    def test_is_unique_per_call(self):
        """Each call generates a unique key."""
        key1 = generate_api_key()
        key2 = generate_api_key()
        assert key1 != key2

    def test_has_reasonable_length(self):
        """Key has reasonable length (> 40 chars)."""
        key = generate_api_key()
        assert len(key) > 40

    def test_contains_only_urlsafe_chars(self):
        """Key contains only URL-safe characters."""
        key = generate_api_key()
        # URL-safe base64: A-Z, a-z, 0-9, -, _
        assert all(c.isalnum() or c in "-_" for c in key[len("writer_"):])


# ============================================
# get_or_create_api_key
# ============================================

class TestGetOrCreateApiKey:
    """Tests for get_or_create_api_key async function."""

    @pytest.fixture(autouse=True)
    def reset_cache(self):
        """Clear API key cache before each test."""
        clear_api_key_cache()
        yield
        clear_api_key_cache()

    @pytest.mark.asyncio
    async def test_returns_cached_key(self):
        """Returns cached key when available."""
        set_api_key("writer_cached_key")
        result = await get_or_create_api_key()
        assert result == "writer_cached_key"

    @pytest.mark.asyncio
    async def test_generates_new_key_when_no_cache(self):
        """Generates new key when cache is empty."""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.api_key = None
            mock_settings.auth_skip_localhost = True
            clear_api_key_cache()
            result = await get_or_create_api_key()
            assert result.startswith("writer_")

    @pytest.mark.asyncio
    async def test_uses_settings_api_key(self):
        """Uses API key from settings when available."""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.api_key = "writer_from_settings"
            mock_settings.auth_skip_localhost = True
            clear_api_key_cache()
            result = await get_or_create_api_key()
            assert result == "writer_from_settings"


# ============================================
# set_api_key / clear_api_key_cache
# ============================================

class TestKeyCacheManagement:
    """Tests for set_api_key and clear_api_key_cache."""

    def test_set_api_key_updates_cache(self):
        """set_api_key stores key in cache."""
        set_api_key("test_key_123")
        # Verify via get_or_create_api_key
        import asyncio
        result = asyncio.run(get_or_create_api_key())
        assert result == "test_key_123"

    def test_clear_api_key_cache_removes_key(self):
        """clear_api_key_cache removes cached key."""
        set_api_key("test_key")
        clear_api_key_cache()
        import asyncio
        result = asyncio.run(get_or_create_api_key())
        assert result != "test_key"


# ============================================
# _is_localhost_request
# ============================================

class TestIsLocalhostRequest:
    """Tests for _is_localhost_request function."""

    def test_ipv4_loopback(self):
        """Returns True for 127.0.0.1."""
        req = Request(scope={"type": "http", "client": ("127.0.0.1", 12345)})
        assert _is_localhost_request(req) is True

    def test_ipv6_loopback(self):
        """Returns True for ::1."""
        req = Request(scope={"type": "http", "client": ("::1", 12345)})
        assert _is_localhost_request(req) is True

    def test_localhost_string(self):
        """Returns True for 'localhost' hostname."""
        req = Request(scope={"type": "http", "client": ("localhost", 12345)})
        assert _is_localhost_request(req) is True

    def test_non_loopback_ipv4(self):
        """Returns False for non-loopback IPv4."""
        req = Request(scope={"type": "http", "client": ("192.168.1.1", 12345)})
        assert _is_localhost_request(req) is False

    def test_non_loopback_ipv6(self):
        """Returns False for non-loopback IPv6."""
        req = Request(scope={"type": "http", "client": ("fe80::1", 12345)})
        assert _is_localhost_request(req) is False

    def test_no_client_info(self):
        """Returns False when no client info available."""
        req = Request(scope={"type": "http"})
        assert _is_localhost_request(req) is False

    def test_none_client_host(self):
        """Returns False when client host is None."""
        req = Request(scope={"type": "http", "client": None})
        assert _is_localhost_request(req) is False


# ============================================
# verify_api_key
# ============================================

class TestVerifyApiKey:
    """Tests for verify_api_key async function."""

    @pytest.fixture(autouse=True)
    def reset_cache(self):
        """Clear API key cache before each test."""
        clear_api_key_cache()
        yield
        clear_api_key_cache()

    @pytest.mark.asyncio
    async def test_valid_key_returns_true(self):
        """Returns True for valid API key."""
        key = generate_api_key()
        set_api_key(key)
        req = Request(scope={"type": "http", "client": ("192.168.1.1", 12345)})
        result = await verify_api_key(req, key)
        assert result is True

    @pytest.mark.asyncio
    async def test_invalid_key_raises_403(self):
        """Raises 403 for invalid API key."""
        set_api_key("writer_valid_key")
        req = Request(scope={"type": "http", "client": ("192.168.1.1", 12345)})
        with pytest.raises(HTTPException) as exc_info:
            await verify_api_key(req, "wrong_key")
        assert exc_info.value.status_code == 403
        assert "Invalid API key" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_missing_key_raises_401(self):
        """Raises 401 when API key is missing."""
        set_api_key("writer_valid_key")
        req = Request(scope={"type": "http", "client": ("192.168.1.1", 12345)})
        with pytest.raises(HTTPException) as exc_info:
            await verify_api_key(req, None)
        assert exc_info.value.status_code == 401
        assert "Missing API key" in str(exc_info.value.detail)

    @pytest.mark.asyncio
    async def test_localhost_skips_auth(self):
        """Returns True for localhost without API key."""
        set_api_key("writer_valid_key")
        req = Request(scope={"type": "http", "client": ("127.0.0.1", 12345)})
        result = await verify_api_key(req, None)
        assert result is True

    @pytest.mark.asyncio
    async def test_localhost_skips_auth_with_invalid_key(self):
        """Returns True for localhost even with invalid key."""
        set_api_key("writer_valid_key")
        req = Request(scope={"type": "http", "client": ("127.0.0.1", 12345)})
        result = await verify_api_key(req, "wrong_key")
        assert result is True

    @pytest.mark.asyncio
    async def test_localhost_skip_disabled(self):
        """Requires auth when localhost skip is disabled."""
        with patch("backend.middleware.auth.settings") as mock_settings:
            mock_settings.auth_skip_localhost = False
            mock_settings.api_key = "writer_valid_key"
            clear_api_key_cache()
            req = Request(scope={"type": "http", "client": ("127.0.0.1", 12345)})
            with pytest.raises(HTTPException) as exc_info:
                await verify_api_key(req, None)
            assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_uses_secrets_compare_digest(self):
        """Uses timing-safe comparison for API keys."""
        key = generate_api_key()
        set_api_key(key)
        req = Request(scope={"type": "http", "client": ("192.168.1.1", 12345)})
        with patch("backend.middleware.auth.secrets.compare_digest") as mock_compare:
            mock_compare.return_value = True
            result = await verify_api_key(req, key)
            assert result is True
            mock_compare.assert_called_once()


# ============================================
# AuthConfig / AuthResponse Models
# ============================================

class TestAuthConfig:
    """Tests for AuthConfig Pydantic model."""

    def test_valid_config(self):
        """Accepts valid auth config."""
        config = AuthConfig(api_key="test_key")
        assert config.api_key == "test_key"
        assert config.allow_localhost_skip is True

    def test_config_with_localhost_disabled(self):
        """Accepts config with localhost skip disabled."""
        config = AuthConfig(api_key="test_key", allow_localhost_skip=False)
        assert config.allow_localhost_skip is False


class TestAuthResponse:
    """Tests for AuthResponse Pydantic model."""

    def test_valid_response(self):
        """Accepts valid auth response."""
        resp = AuthResponse(api_key="writer_test", message="Authentication successful")
        assert resp.api_key == "writer_test"
        assert resp.message == "Authentication successful"

    def test_response_requires_api_key(self):
        """Requires api_key field."""
        with pytest.raises(Exception):
            AuthResponse(message="missing key")

    def test_response_requires_message(self):
        """Requires message field."""
        with pytest.raises(Exception):
            AuthResponse(api_key="key")
