"""Tests for events/handlers, middleware/error_handling, middleware/logging_middleware."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch
import asyncio


# ── events/handlers.py ───────────────────────────────────────────────

from backend.events.handlers import (
    cache_invalidation_handler,
    stats_update_handler,
    get_stats,
    reset_stats,
    register_handlers,
    _get_entity_type,
)


class TestGetEntityType:
    def test_with_entity_type(self):
        assert _get_entity_type({"entity_type": "character"}) == "character"

    def test_missing(self):
        assert _get_entity_type({}) == ""

    def test_none_value(self):
        assert _get_entity_type({"entity_type": None}) is None


class TestCacheInvalidationHandler:
    @pytest.mark.asyncio
    async def test_calls_clear_entity_cache(self):
        with patch("backend.events.handlers.get_cache_service") as mock_get:
            mock_service = MagicMock()
            mock_get.return_value = mock_service
            await cache_invalidation_handler({"entity_type": "character"})
            mock_service.clear_entity_cache.assert_called_once_with("character")

    @pytest.mark.asyncio
    async def test_missing_entity_type(self):
        await cache_invalidation_handler({})  # Should not raise

    @pytest.mark.asyncio
    async def test_cache_service_error(self):
        with patch("backend.events.handlers.get_cache_service") as mock_get:
            mock_get.return_value.clear_entity_cache.side_effect = Exception("cache error")
            await cache_invalidation_handler({"entity_type": "character"})  # Should not raise


class TestStatsUpdateHandler:
    def setup_method(self):
        reset_stats()

    @pytest.mark.asyncio
    async def test_entity_updated(self):
        await stats_update_handler({"event_kind": "entity.updated"})
        assert get_stats()["entity_updated"] == 1

    @pytest.mark.asyncio
    async def test_entity_deleted(self):
        await stats_update_handler({"event_kind": "entity.deleted"})
        assert get_stats()["entity_deleted"] == 1

    @pytest.mark.asyncio
    async def test_entity_created(self):
        await stats_update_handler({"event_kind": "entity.created"})
        assert get_stats()["entity_created"] == 1

    @pytest.mark.asyncio
    async def test_cache_invalidate(self):
        await stats_update_handler({"event_kind": "cache.invalidate"})
        assert get_stats()["cache_invalidate"] == 1

    @pytest.mark.asyncio
    async def test_unknown_event(self):
        await stats_update_handler({"event_kind": "unknown.event"})
        # No counter should change
        assert all(v == 0 for v in get_stats().values())

    @pytest.mark.asyncio
    async def test_missing_event_kind(self):
        await stats_update_handler({})
        assert all(v == 0 for v in get_stats().values())


class TestGetResetStats:
    def test_get_returns_copy(self):
        reset_stats()
        s = get_stats()
        s["entity_updated"] = 999
        assert get_stats()["entity_updated"] == 0

    def test_reset(self):
        reset_stats()
        assert all(v == 0 for v in get_stats().values())


class TestRegisterHandlers:
    def test_registers_all_handlers(self):
        mock_bus = MagicMock()
        register_handlers(mock_bus)
        assert mock_bus.subscribe.call_count == 7


# ── middleware/error_handling.py ──────────────────────────────────────

from backend.middleware.error_handling import ErrorHandlingMiddleware, setup_error_handling_middleware


class TestErrorHandlingMiddleware:
    @pytest.mark.asyncio
    async def test_passes_through_success(self):
        app = MagicMock()
        middleware = ErrorHandlingMiddleware(app)

        mock_request = MagicMock()
        mock_request.state.request_id = "test-1234"
        mock_response = MagicMock()

        async def call_next(req):
            return mock_response

        result = await middleware.dispatch(mock_request, call_next)
        assert result == mock_response

    @pytest.mark.asyncio
    async def test_handles_generic_error(self):
        app = MagicMock()
        middleware = ErrorHandlingMiddleware(app)

        mock_request = MagicMock()
        mock_request.state.request_id = "test-1234"
        mock_request.method = "GET"
        mock_request.url.path = "/test"

        async def call_next(req):
            raise RuntimeError("something broke")

        result = await middleware.dispatch(mock_request, call_next)
        assert result.status_code == 500


class TestSetupErrorHandling:
    def test_adds_middleware(self):
        mock_app = MagicMock()
        setup_error_handling_middleware(mock_app)
        mock_app.add_middleware.assert_called_once_with(ErrorHandlingMiddleware)


# ── middleware/logging_middleware.py ──────────────────────────────────

from backend.middleware.logging_middleware import logging_middleware, request_logging_middleware


class TestLoggingMiddleware:
    @pytest.mark.asyncio
    async def test_sets_request_id(self):
        mock_request = MagicMock()
        mock_request.method = "GET"
        mock_request.url.path = "/test"
        mock_request.client.host = "127.0.0.1"
        mock_request.state = MagicMock()

        mock_response = MagicMock()
        mock_response.status_code = 200

        async def call_next(req):
            return mock_response

        result = await logging_middleware(mock_request, call_next)
        assert result == mock_response
        assert mock_request.state.request_id is not None

    @pytest.mark.asyncio
    async def test_error_re_raises(self):
        mock_request = MagicMock()
        mock_request.method = "POST"
        mock_request.url.path = "/fail"
        mock_request.client.host = "127.0.0.1"
        mock_request.state = MagicMock()

        async def call_next(req):
            raise ValueError("bad input")

        with pytest.raises(ValueError):
            await logging_middleware(mock_request, call_next)


class TestRequestLoggingMiddleware:
    @pytest.mark.asyncio
    async def test_logs_request(self):
        mock_request = MagicMock()
        mock_request.method = "GET"
        mock_request.url.path = "/test"

        mock_response = MagicMock()
        mock_response.status_code = 200

        async def call_next(req):
            return mock_response

        result = await request_logging_middleware(mock_request, call_next)
        assert result == mock_response
