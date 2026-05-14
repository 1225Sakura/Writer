"""
Tests for middleware integration: CORS, logging, error handling.
Verifies request_id is preserved across the middleware chain.
"""

import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import sys
import os

# Add src/backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


class TestMiddlewareIntegration:
    """Test middleware chain integration."""

    @pytest.fixture
    def client(self):
        """Create test client with mocked dependencies."""
        with patch('backend.config.settings') as mock_settings:
            mock_settings.app_name = "Writer API Test"
            mock_settings.app_version = "1.0.0"
            mock_settings.cors_origins = ["http://localhost:5173"]
            mock_settings.database_url = "sqlite+aiosqlite:///./test.db"

            from backend.interface.web.main import app
            yield TestClient(app)

    def test_request_id_generated_when_missing(self, client):
        """Test that request_id is generated when X-Request-ID header is missing."""
        response = client.get("/")
        assert response.status_code == 200
        assert "X-Request-ID" in response.headers
        assert len(response.headers["X-Request-ID"]) > 0

    def test_request_id_preserved_from_header(self, client):
        """Test that request_id from X-Request-ID header is preserved."""
        test_id = "test-request-id-12345"
        response = client.get("/", headers={"X-Request-ID": test_id})
        assert response.status_code == 200
        assert response.headers["X-Request-ID"] == test_id

    def test_cors_headers_present(self, client):
        """Test that CORS headers are present when Origin header is sent."""
        response = client.get("/", headers={"Origin": "http://localhost:5173"})
        assert "access-control-allow-origin" in response.headers
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"

    def test_cors_preflight_request(self, client):
        """Test CORS preflight (OPTIONS) request."""
        response = client.options(
            "/",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            }
        )
        assert response.status_code == 200
        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers

    def test_health_check_has_request_id(self, client):
        """Test that health check endpoint includes request_id."""
        response = client.get("/health")
        assert response.status_code == 200
        assert "X-Request-ID" in response.headers

    def test_root_endpoint(self, client):
        """Test root endpoint returns correct response."""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Writer API"
        assert "version" in data


class TestErrorHandlingMiddleware:
    """Test error handling middleware integration."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        with patch('backend.config.settings') as mock_settings:
            mock_settings.app_name = "Writer API Test"
            mock_settings.app_version = "1.0.0"
            mock_settings.cors_origins = ["http://localhost:5173"]
            mock_settings.database_url = "sqlite+aiosqlite:///./test.db"

            from backend.interface.web.main import app
            yield TestClient(app)

    def test_404_returns_json_error(self, client):
        """Test that 404 returns JSON error response."""
        response = client.get("/nonexistent-endpoint")
        assert response.status_code == 404
        data = response.json()
        # FastAPI default 404 returns {"detail": "Not Found"}
        assert "detail" in data or "error_code" in data

    def test_error_response_includes_request_id(self, client):
        """Test that error responses include request_id for tracing."""
        response = client.get("/nonexistent-endpoint")
        # The request_id should be in the response headers
        assert "X-Request-ID" in response.headers

    def test_error_response_is_json(self, client):
        """Test that error responses are valid JSON."""
        response = client.get("/nonexistent-endpoint")
        assert response.status_code == 404
        data = response.json()
        assert isinstance(data, dict)


class TestLoggingMiddleware:
    """Test logging middleware functionality."""

    @pytest.fixture
    def client(self):
        """Create test client with logging capture."""
        with patch('backend.config.settings') as mock_settings:
            mock_settings.app_name = "Writer API Test"
            mock_settings.app_version = "1.0.0"
            mock_settings.cors_origins = ["http://localhost:5173"]
            mock_settings.database_url = "sqlite+aiosqlite:///./test.db"

            from backend.interface.web.main import app
            yield TestClient(app)

    def test_successful_request_logged(self, client, caplog):
        """Test that successful requests are logged with correct level."""
        import logging
        caplog.set_level(logging.INFO)

        response = client.get("/health")
        assert response.status_code == 200

        # Check that logs contain request information
        log_messages = [record.message for record in caplog.records]
        assert any("request_start" in msg or "Request started" in msg for msg in log_messages)

    def test_request_id_in_logs(self, client, caplog):
        """Test that request_id appears in log records."""
        import logging
        caplog.set_level(logging.DEBUG)

        test_id = "log-test-id-999"
        response = client.get("/health", headers={"X-Request-ID": test_id})
        assert response.status_code == 200

        # Check that the request_id appears in log extra data
        for record in caplog.records:
            if hasattr(record, "request_id"):
                assert record.request_id == test_id


class TestMiddlewareOrder:
    """Test that middlewares execute in correct order."""

    @pytest.fixture
    def client(self):
        """Create test client."""
        with patch('backend.config.settings') as mock_settings:
            mock_settings.app_name = "Writer API Test"
            mock_settings.app_version = "1.0.0"
            mock_settings.cors_origins = ["http://localhost:5173"]
            mock_settings.database_url = "sqlite+aiosqlite:///./test.db"

            from backend.interface.web.main import app
            yield TestClient(app)

    def test_cors_before_logging(self, client):
        """Verify CORS headers are set even on logged requests."""
        response = client.get("/", headers={"Origin": "http://localhost:5173"})
        assert response.status_code == 200
        # CORS headers should be present
        assert "access-control-allow-origin" in response.headers
        # Request ID should also be present
        assert "X-Request-ID" in response.headers

    def test_error_handler_does_not_conflict_with_logging(self, client):
        """Test that error responses still get request_id from logging middleware."""
        response = client.get("/nonexistent")
        # Both error handler and logging middleware should work together
        assert "X-Request-ID" in response.headers
        assert response.status_code == 404
