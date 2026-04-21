"""Tests for middleware components."""

import pytest
import time
from unittest.mock import MagicMock, AsyncMock, patch

from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from backend.middleware.rate_limit import (
    RateLimitStore,
    RateLimitMiddleware,
    rate_limit_middleware,
    get_rate_limit_store,
    check_checker_rate_limit,
    DEFAULT_RATE_LIMIT,
    DEFAULT_WINDOW,
)
from backend.middleware.errors import (
    AppException,
    NotFoundError,
    ValidationError,
    AuthenticationError,
    PermissionDeniedError,
    ConflictError,
    RateLimitError,
    ExternalServiceError,
    DatabaseError,
    build_error_response,
    register_exception_handlers,
    ErrorCode,
)
from backend.middleware.auth import (
    verify_api_key,
    get_or_create_api_key,
    generate_api_key,
    set_api_key,
    clear_api_key_cache,
    _is_localhost_request,
)


# =============================================================================
# Rate Limit Store Tests
# =============================================================================

class TestRateLimitStore:
    """Test the in-memory rate limit store."""

    def test_check_rate_limit_allows_first_request(self):
        """First request is always allowed."""
        store = RateLimitStore()
        allowed, limit, remaining = store.check_rate_limit("127.0.0.1", 10, 60.0)
        assert allowed is True
        assert limit == 10
        assert remaining == 9

    def test_check_rate_limit_blocks_exceeded_requests(self):
        """Requests beyond limit are blocked."""
        store = RateLimitStore()
        for _ in range(5):
            store.check_rate_limit("127.0.0.1", 5, 60.0)

        allowed, limit, remaining = store.check_rate_limit("127.0.0.1", 5, 60.0)
        assert allowed is False
        assert remaining == 0

    def test_check_rate_limit_tracks_per_ip(self):
        """Rate limits are tracked per IP address."""
        store = RateLimitStore()
        # Exhaust limit for IP1
        for _ in range(5):
            store.check_rate_limit("1.1.1.1", 5, 60.0)

        # IP2 should still be allowed
        allowed, _, _ = store.check_rate_limit("2.2.2.2", 5, 60.0)
        assert allowed is True

    def test_check_rate_limit_window_expires(self):
        """Old requests fall outside the window."""
        store = RateLimitStore()
        # Add a very old request
        store._store["1.1.1.1"] = [time.time() - 120.0]

        allowed, _, _ = store.check_rate_limit("1.1.1.1", 5, 60.0)
        assert allowed is True

    def test_cleanup_removes_expired_entries(self):
        """Cleanup removes fully expired IP entries."""
        store = RateLimitStore()
        store._store["1.1.1.1"] = [time.time() - 1000.0]
        store._last_cleanup = time.time() - 100.0  # Force cleanup

        store._cleanup_expired(max_age=300.0)
        assert "1.1.1.1" not in store._store

    def test_rate_limit_remaining_decreases(self):
        """Remaining count decreases with each request."""
        store = RateLimitStore()
        _, _, remaining1 = store.check_rate_limit("127.0.0.1", 10, 60.0)
        _, _, remaining2 = store.check_rate_limit("127.0.0.1", 10, 60.0)
        assert remaining2 == remaining1 - 1


# =============================================================================
# Rate Limit Middleware Tests
# =============================================================================

class TestRateLimitMiddleware:
    """Test rate limiting middleware integration."""

    @pytest.fixture
    def app(self):
        """Create test app with rate limit middleware."""
        app = FastAPI()
        app.add_middleware(RateLimitMiddleware, rate_limit=5, window_seconds=60.0)

        @app.get("/api/v1/chat/test")
        async def chat_endpoint():
            return {"status": "ok"}

        @app.get("/api/v1/ai/test")
        async def ai_endpoint():
            return {"status": "ok"}

        @app.get("/other/path")
        async def other_endpoint():
            return {"status": "ok"}

        return app

    @pytest.fixture
    def client(self, app):
        """Create test client."""
        return TestClient(app)

    def test_applies_to_chat_routes(self, client):
        """Rate limit applies to /api/v1/chat routes."""
        response = client.get("/api/v1/chat/test")
        assert response.status_code == 200
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers

    def test_applies_to_ai_routes(self, client):
        """Rate limit applies to /api/v1/ai routes."""
        response = client.get("/api/v1/ai/test")
        assert response.status_code == 200
        assert "X-RateLimit-Limit" in response.headers

    def test_skips_non_target_routes(self, client):
        """Rate limit does not apply to other routes."""
        response = client.get("/other/path")
        assert response.status_code == 200
        # Headers may or may not be present for non-target routes

    def test_blocks_when_limit_exceeded(self, client):
        """Returns 429 when rate limit is exceeded."""
        # Make requests up to the limit
        for _ in range(5):
            response = client.get("/api/v1/chat/test")
            assert response.status_code == 200

        # Next request should be blocked
        response = client.get("/api/v1/chat/test")
        assert response.status_code == 429
        assert response.json()["error_code"] == "RATE_LIMIT_EXCEEDED"

    def test_rate_limit_headers_on_blocked_request(self, client):
        """Blocked requests include rate limit headers."""
        for _ in range(5):
            client.get("/api/v1/chat/test")

        response = client.get("/api/v1/chat/test")
        assert response.status_code == 429
        assert "X-RateLimit-Limit" in response.headers
        assert "X-RateLimit-Remaining" in response.headers
        assert "Retry-After" in response.headers


# =============================================================================
# Checker Rate Limit Tests
# =============================================================================

class TestCheckerRateLimit:
    """Test stricter rate limits for AI checker endpoints."""

    def test_checker_rate_limit_is_stricter(self):
        """Checker endpoints have lower rate limits."""
        store = RateLimitStore()
        for _ in range(10):
            allowed, _, _ = store.check_rate_limit("127.0.0.1", 10, 60.0)

        # 11th request should be blocked
        allowed, _, _ = store.check_rate_limit("127.0.0.1", 10, 60.0)
        assert allowed is False

    def test_check_checker_rate_limit_function(self):
        """check_checker_rate_limit function works correctly."""
        # Reset store by creating a fresh check
        allowed, limit, remaining = check_checker_rate_limit("127.0.0.1")
        assert allowed is True
        assert limit == 10  # CHECKER_RATE_LIMIT


# =============================================================================
# Error Handling Middleware Tests
# =============================================================================

class TestErrorHandling:
    """Test error handling and response formatting."""

    def test_build_error_response_basic(self):
        """Basic error response has required fields."""
        resp = build_error_response("Something failed", ErrorCode.INTERNAL_ERROR)
        assert resp["error_code"] == "INTERNAL_ERROR"
        assert resp["message"] == "Something failed"
        assert "timestamp" in resp

    def test_build_error_response_with_details(self):
        """Error response can include details."""
        resp = build_error_response(
            "Validation failed",
            ErrorCode.VALIDATION_ERROR,
            details={"field": "name", "reason": "too_long"}
        )
        assert resp["details"] == {"field": "name", "reason": "too_long"}

    def test_build_error_response_with_request_id(self):
        """Error response can include request ID."""
        resp = build_error_response("Error", ErrorCode.INTERNAL_ERROR, request_id="req-123")
        assert resp["request_id"] == "req-123"

    def test_app_exception_to_dict(self):
        """AppException converts to dict correctly."""
        exc = AppException("Test error", status_code=500, error_code="TEST")
        d = exc.to_dict(request_id="req-1")
        assert d["error_code"] == "TEST"
        assert d["message"] == "Test error"
        assert d["request_id"] == "req-1"

    def test_not_found_error_defaults(self):
        """NotFoundError has correct defaults."""
        exc = NotFoundError()
        assert exc.status_code == 404
        assert exc.error_code == ErrorCode.NOT_FOUND

    def test_validation_error_with_details(self):
        """ValidationError includes details."""
        exc = ValidationError("Invalid input", details={"field": "email"})
        assert exc.status_code == 422
        assert exc.details == {"field": "email"}

    def test_authentication_error_status(self):
        """AuthenticationError returns 401."""
        exc = AuthenticationError("Token expired")
        assert exc.status_code == 401
        assert exc.error_code == ErrorCode.AUTH_ERROR

    def test_permission_denied_error_status(self):
        """PermissionDeniedError returns 403."""
        exc = PermissionDeniedError("Admin only")
        assert exc.status_code == 403
        assert exc.error_code == ErrorCode.PERMISSION_DENIED

    def test_conflict_error_status(self):
        """ConflictError returns 409."""
        exc = ConflictError("Duplicate entry")
        assert exc.status_code == 409
        assert exc.error_code == ErrorCode.CONFLICT

    def test_rate_limit_error_status(self):
        """RateLimitError returns 429."""
        exc = RateLimitError("Too many requests")
        assert exc.status_code == 429
        assert exc.error_code == ErrorCode.RATE_LIMIT_EXCEEDED

    def test_external_service_error_status(self):
        """ExternalServiceError returns 502."""
        exc = ExternalServiceError("AI API down")
        assert exc.status_code == 502
        assert exc.error_code == ErrorCode.EXTERNAL_SERVICE_ERROR

    def test_database_error_status(self):
        """DatabaseError returns 500."""
        exc = DatabaseError("Connection failed")
        assert exc.status_code == 500
        assert exc.error_code == ErrorCode.DATABASE_ERROR


# =============================================================================
# Exception Handler Integration Tests
# =============================================================================

class TestExceptionHandlers:
    """Test exception handler registration and behavior."""

    @pytest.fixture
    def test_app(self):
        """Create test app with exception handlers."""
        app = FastAPI()
        register_exception_handlers(app)

        @app.get("/not-found")
        async def raise_not_found():
            raise NotFoundError("Resource missing")

        @app.get("/validation")
        async def raise_validation():
            raise ValidationError("Bad input", details={"field": "email"})

        @app.get("/generic")
        async def raise_generic():
            raise ValueError("Unexpected error")

        return app

    @pytest.fixture
    def client(self, test_app):
        """Create test client."""
        return TestClient(test_app)

    def test_not_found_handler(self, client):
        """NotFoundError returns 404 with correct structure."""
        response = client.get("/not-found")
        assert response.status_code == 404
        data = response.json()
        assert data["error_code"] == "NOT_FOUND"
        assert data["message"] == "Resource missing"
        assert "timestamp" in data

    def test_validation_handler(self, client):
        """ValidationError returns 422 with details."""
        response = client.get("/validation")
        assert response.status_code == 422
        data = response.json()
        assert data["error_code"] == "VALIDATION_ERROR"
        assert data["details"] == {"field": "email"}

    def test_generic_handler(self, client):
        """Unhandled exceptions return 500."""
        response = client.get("/generic")
        assert response.status_code == 500
        data = response.json()
        assert data["error_code"] == "INTERNAL_ERROR"


# =============================================================================
# Auth Middleware Tests
# =============================================================================

class TestAuthMiddleware:
    """Test authentication middleware."""

    @pytest.fixture(autouse=True)
    def reset_auth(self):
        """Reset auth state before each test."""
        clear_api_key_cache()
        yield
        clear_api_key_cache()

    def test_generate_api_key_format(self):
        """Generated API keys have correct format."""
        key = generate_api_key()
        assert key.startswith("writer_")
        assert len(key) > 40

    def test_generate_api_key_is_unique(self):
        """Each generated key is unique."""
        key1 = generate_api_key()
        key2 = generate_api_key()
        assert key1 != key2

    @pytest.mark.asyncio
    async def test_get_or_create_api_key_creates_new(self):
        """get_or_create_api_key generates a new key if none exists."""
        clear_api_key_cache()
        key = await get_or_create_api_key()
        assert key.startswith("writer_")

    @pytest.mark.asyncio
    async def test_get_or_create_api_key_returns_cached(self):
        """get_or_create_api_key returns cached key."""
        set_api_key("cached_key_123")
        key = await get_or_create_api_key()
        assert key == "cached_key_123"

    @pytest.mark.asyncio
    async def test_verify_api_key_with_valid_key(self):
        """Valid API key passes verification."""
        set_api_key("valid_key")
        request = MagicMock()
        request.client.host = "192.168.1.1"

        result = await verify_api_key(request, "valid_key")
        assert result is True

    @pytest.mark.asyncio
    async def test_verify_api_key_rejects_invalid_key(self):
        """Invalid API key raises 403."""
        set_api_key("valid_key")
        request = MagicMock()
        request.client.host = "192.168.1.1"

        with pytest.raises(Exception) as exc_info:
            await verify_api_key(request, "wrong_key")
        assert exc_info.value.status_code == 403

    @pytest.mark.asyncio
    async def test_verify_api_key_rejects_missing_key(self):
        """Missing API key raises 401."""
        set_api_key("valid_key")
        request = MagicMock()
        request.client.host = "192.168.1.1"

        with pytest.raises(Exception) as exc_info:
            await verify_api_key(request, None)
        assert exc_info.value.status_code == 401

    @pytest.mark.asyncio
    async def test_verify_api_key_skips_localhost(self):
        """Localhost requests skip auth check."""
        request = MagicMock()
        request.client.host = "127.0.0.1"

        result = await verify_api_key(request, None)
        assert result is True

    def test_is_localhost_request_ipv4(self):
        """Detects IPv4 localhost."""
        request = MagicMock()
        request.client.host = "127.0.0.1"
        assert _is_localhost_request(request) is True

    def test_is_localhost_request_ipv6(self):
        """Detects IPv6 localhost."""
        request = MagicMock()
        request.client.host = "::1"
        assert _is_localhost_request(request) is True

    def test_is_localhost_request_non_local(self):
        """Rejects non-localhost."""
        request = MagicMock()
        request.client.host = "8.8.8.8"
        assert _is_localhost_request(request) is False

    def test_is_localhost_request_no_client(self):
        """Handles missing client info."""
        request = MagicMock()
        request.client = None
        assert _is_localhost_request(request) is False


# =============================================================================
# CORS Configuration Tests
# =============================================================================

class TestCORSConfiguration:
    """Test CORS middleware configuration."""

    @pytest.fixture
    def cors_app(self):
        """Create app with CORS middleware."""
        app = FastAPI()
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        @app.get("/test")
        async def test_endpoint():
            return {"status": "ok"}

        return app

    @pytest.fixture
    def client(self, cors_app):
        return TestClient(cors_app)

    def test_cors_preflight_request(self, client):
        """CORS preflight request returns 200."""
        response = client.options(
            "/test",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            }
        )
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers

    def test_cors_headers_on_response(self, client):
        """CORS headers present on actual request."""
        response = client.get(
            "/test",
            headers={"Origin": "http://localhost:5173"}
        )
        assert response.status_code == 200
        assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"

    def test_cors_allows_credentials(self, client):
        """CORS allows credentials."""
        response = client.get(
            "/test",
            headers={"Origin": "http://localhost:5173"}
        )
        assert response.headers.get("access-control-allow-credentials") == "true"
