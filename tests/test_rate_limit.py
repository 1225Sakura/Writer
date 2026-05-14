"""
Tests for rate limiting middleware.
"""

import pytest
import time
from unittest.mock import AsyncMock, MagicMock, Mock, patch

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src', 'backend'))

from backend.middleware.rate_limit import (
    RateLimitStore,
    rate_limit_middleware,
    RateLimitMiddleware,
    get_rate_limit_store,
    DEFAULT_RATE_LIMIT,
    DEFAULT_WINDOW,
)


class TestRateLimitStore:
    """Test RateLimitStore functionality."""

    @pytest.fixture
    def store(self):
        """Create a fresh RateLimitStore."""
        return RateLimitStore()

    def test_init(self, store):
        """Test store initialization."""
        assert store._store == {}
        assert store._cleanup_interval == 60.0

    @pytest.mark.asyncio
    async def test_check_rate_limit_new_ip(self, store):
        """Test new IP is allowed."""
        allowed, limit, remaining = await store.check_rate_limit("192.168.1.1", 10, 60.0)

        assert allowed is True
        assert limit == 10
        assert remaining == 9

    @pytest.mark.asyncio
    async def test_check_rate_limit_multiple_requests(self, store):
        """Test multiple requests decrement remaining."""
        await store.check_rate_limit("192.168.1.1", 5, 60.0)
        await store.check_rate_limit("192.168.1.1", 5, 60.0)

        allowed, limit, remaining = await store.check_rate_limit("192.168.1.1", 5, 60.0)

        assert allowed is True
        assert remaining == 2

    @pytest.mark.asyncio
    async def test_check_rate_limit_exceeded(self, store):
        """Test rate limit is enforced."""
        for _ in range(5):
            await store.check_rate_limit("192.168.1.1", 5, 60.0)

        allowed, limit, remaining = await store.check_rate_limit("192.168.1.1", 5, 60.0)

        assert allowed is False
        assert remaining == 0

    @pytest.mark.asyncio
    async def test_check_rate_limit_window_expires(self, store):
        """Test old requests outside window are removed."""
        await store.check_rate_limit("192.168.1.1", 1, 0.1)

        time.sleep(0.15)

        allowed, _, _ = await store.check_rate_limit("192.168.1.1", 1, 0.1)
        assert allowed is True

    @pytest.mark.asyncio
    async def test_check_rate_limit_different_ips(self, store):
        """Test rate limiting is per-IP."""
        await store.check_rate_limit("192.168.1.1", 2, 60.0)
        await store.check_rate_limit("192.168.1.1", 2, 60.0)

        allowed, _, remaining = await store.check_rate_limit("192.168.1.2", 2, 60.0)

        assert allowed is True
        assert remaining == 1

    @pytest.mark.asyncio
    async def test_cleanup_expired(self, store):
        """Test cleanup removes expired entries."""
        await store.check_rate_limit("192.168.1.1", 10, 0.1)

        time.sleep(0.15)

        # Reset last_cleanup to allow cleanup to run
        store._last_cleanup = 0
        await store._cleanup_expired(max_age=0.05)

        assert "192.168.1.1" not in store._store

    @pytest.mark.asyncio
    async def test_cleanup_not_called_too_often(self, store):
        """Test cleanup respects interval."""
        await store.check_rate_limit("192.168.1.1", 10, 60.0)
        store._last_cleanup = time.time()

        await store._cleanup_expired()

        assert "192.168.1.1" in store._store

    @pytest.mark.asyncio
    async def test_remaining_zero_at_limit(self, store):
        """Test remaining is exactly 0 at limit."""
        for i in range(10):
            allowed, limit, remaining = await store.check_rate_limit("ip", 10, 60.0)
            if i == 9:
                assert remaining == 0
                assert allowed is True

        allowed, _, remaining = await store.check_rate_limit("ip", 10, 60.0)
        assert allowed is False
        assert remaining == 0


class TestRateLimitMiddleware:
    """Test rate limit middleware function."""

    @pytest.mark.asyncio
    async def test_middleware_allows_non_limited_routes(self):
        """Test middleware allows routes outside /api/v1/chat and /api/v1/ai."""
        request = MagicMock()
        request.url.path = "/api/v1/settings"
        request.client.host = "192.168.1.1"

        call_next = AsyncMock()
        mock_response = MagicMock()
        mock_response.headers = {}
        call_next.return_value = mock_response

        response = await rate_limit_middleware(request, call_next)

        call_next.assert_called_once_with(request)
        assert response == mock_response

    @pytest.mark.asyncio
    async def test_middleware_applies_to_chat_routes(self):
        """Test middleware applies to chat routes."""
        request = MagicMock()
        request.url.path = "/api/v1/chat/sessions"
        request.client.host = "192.168.1.1"

        call_next = AsyncMock()
        mock_response = MagicMock()
        mock_response.headers = {}
        call_next.return_value = mock_response

        with patch('backend.middleware.rate_limit._rate_limit_store', RateLimitStore()):
            response = await rate_limit_middleware(request, call_next)

        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers

    @pytest.mark.asyncio
    async def test_middleware_applies_to_ai_routes(self):
        """Test middleware applies to AI routes."""
        request = MagicMock()
        request.url.path = "/api/v1/ai/generate"
        request.client.host = "192.168.1.1"

        call_next = AsyncMock()
        mock_response = MagicMock()
        mock_response.headers = {}
        call_next.return_value = mock_response

        with patch('backend.middleware.rate_limit._rate_limit_store', RateLimitStore()):
            response = await rate_limit_middleware(request, call_next)

        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers

    @pytest.mark.asyncio
    async def test_middleware_blocks_when_limit_exceeded(self):
        """Test middleware returns 429 when limit exceeded."""
        request = MagicMock()
        request.url.path = "/api/v1/chat/sessions"
        request.client.host = "192.168.1.1"

        call_next = AsyncMock()

        store = RateLimitStore()
        for _ in range(DEFAULT_RATE_LIMIT):
            await store.check_rate_limit("192.168.1.1", DEFAULT_RATE_LIMIT, DEFAULT_WINDOW)

        with patch('backend.middleware.rate_limit._rate_limit_store', store):
            response = await rate_limit_middleware(request, call_next)

        assert response.status_code == 429
        assert response.headers["X-RateLimit-Remaining"] == "0"
        assert "Retry-After" in response.headers
        call_next.assert_not_called()

    @pytest.mark.asyncio
    async def test_middleware_unknown_client(self):
        """Test middleware handles unknown client."""
        request = MagicMock()
        request.url.path = "/api/v1/chat/sessions"
        request.client = None

        call_next = AsyncMock()
        mock_response = MagicMock()
        mock_response.headers = {}
        call_next.return_value = mock_response

        with patch('backend.middleware.rate_limit._rate_limit_store', RateLimitStore()):
            response = await rate_limit_middleware(request, call_next)

        assert response == mock_response

    @pytest.mark.asyncio
    async def test_middleware_rate_limit_response_content(self):
        """Test 429 response has correct content."""
        request = MagicMock()
        request.url.path = "/api/v1/ai/generate"
        request.client.host = "192.168.1.1"

        call_next = AsyncMock()

        store = RateLimitStore()
        for _ in range(DEFAULT_RATE_LIMIT):
            await store.check_rate_limit("192.168.1.1", DEFAULT_RATE_LIMIT, DEFAULT_WINDOW)

        with patch('backend.middleware.rate_limit._rate_limit_store', store):
            response = await rate_limit_middleware(request, call_next)

        body = response.body
        assert b"Too many requests" in body
        assert b"RATE_LIMIT_EXCEEDED" in body


class TestRateLimitMiddlewareClass:
    """Test RateLimitMiddleware Starlette class."""

    def test_init_defaults(self):
        """Test middleware class initialization with defaults."""
        app = MagicMock()
        middleware = RateLimitMiddleware(app)

        assert middleware.rate_limit == DEFAULT_RATE_LIMIT
        assert middleware.window_seconds == DEFAULT_WINDOW

    def test_init_custom(self):
        """Test middleware class initialization with custom values."""
        app = MagicMock()
        middleware = RateLimitMiddleware(app, rate_limit=100, window_seconds=120.0)

        assert middleware.rate_limit == 100
        assert middleware.window_seconds == 120.0

    @pytest.mark.asyncio
    async def test_dispatch_delegates(self):
        """Test dispatch method delegates to rate_limit_middleware."""
        app = MagicMock()
        middleware = RateLimitMiddleware(app)

        request = MagicMock()
        request.url.path = "/health"
        request.client.host = "127.0.0.1"

        call_next = AsyncMock()
        mock_response = MagicMock()
        mock_response.headers = {}
        call_next.return_value = mock_response

        response = await middleware.dispatch(request, call_next)

        assert response == mock_response


class TestGetRateLimitStore:
    """Test get_rate_limit_store function."""

    def test_returns_singleton(self):
        """Test function returns the global store instance."""
        store1 = get_rate_limit_store()
        store2 = get_rate_limit_store()

        assert store1 is store2

    def test_returns_rate_limit_store(self):
        """Test function returns a RateLimitStore."""
        store = get_rate_limit_store()

        assert isinstance(store, RateLimitStore)


class TestDefaultConstants:
    """Test default constants."""

    def test_default_rate_limit(self):
        """Test default rate limit value."""
        assert DEFAULT_RATE_LIMIT == 60

    def test_default_window(self):
        """Test default window value."""
        assert DEFAULT_WINDOW == 60.0
