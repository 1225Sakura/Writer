# Extended tests for event_bus.py - Phase 5 Tier 3
# Covers edge cases, async patterns, error handling, and event constants

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

from backend.utils.event_bus import (
    AsyncEventBus,
    ENTITY_CREATED,
    ENTITY_UPDATED,
    ENTITY_DELETED,
    CACHE_INVALIDATE,
    AGENT_EXECUTED,
)


# ── Event constants ───────────────────────────────────────────────────

class TestEventConstants:
    def test_entity_created_value(self):
        assert ENTITY_CREATED == "entity.created"

    def test_entity_updated_value(self):
        assert ENTITY_UPDATED == "entity.updated"

    def test_entity_deleted_value(self):
        assert ENTITY_DELETED == "entity.deleted"

    def test_cache_invalidate_value(self):
        assert CACHE_INVALIDATE == "cache.invalidate"

    def test_agent_executed_value(self):
        assert AGENT_EXECUTED == "agent.executed"


# ── subscribe / unsubscribe edge cases ────────────────────────────────

class TestSubscribeUnsubscribe:
    def test_subscribe_multiple_handlers(self):
        bus = AsyncEventBus()
        h1 = lambda d: None
        h2 = lambda d: None
        bus.subscribe("ev", h1)
        bus.subscribe("ev", h2)
        assert len(bus.get_subscribers("ev")) == 2

    def test_unsubscribe_only_removes_target(self):
        bus = AsyncEventBus()
        h1 = lambda d: None
        h2 = lambda d: None
        bus.subscribe("ev", h1)
        bus.subscribe("ev", h2)
        bus.unsubscribe("ev", h1)
        subs = bus.get_subscribers("ev")
        assert h1 not in subs
        assert h2 in subs

    def test_get_subscribers_unknown_event(self):
        bus = AsyncEventBus()
        assert bus.get_subscribers("nonexistent") == []

    def test_unsubscribe_from_unknown_event(self):
        bus = AsyncEventBus()
        assert bus.unsubscribe("nonexistent", lambda d: None) is False

    def test_same_handler_subscribed_twice(self):
        bus = AsyncEventBus()
        h = lambda d: None
        bus.subscribe("ev", h)
        bus.subscribe("ev", h)
        assert len(bus.get_subscribers("ev")) == 2

    def test_unsubscribe_removes_first_occurrence(self):
        bus = AsyncEventBus()
        h = lambda d: None
        bus.subscribe("ev", h)
        bus.subscribe("ev", h)
        bus.unsubscribe("ev", h)
        # One should remain
        assert len(bus.get_subscribers("ev")) == 1


# ── list_event_types ──────────────────────────────────────────────────

class TestListEventTypes:
    def test_empty_bus(self):
        bus = AsyncEventBus()
        assert bus.list_event_types() == []

    def test_after_unsubscribe_all(self):
        bus = AsyncEventBus()
        h = lambda d: None
        bus.subscribe("ev", h)
        bus.unsubscribe("ev", h)
        # Empty handlers list should not appear
        assert "ev" not in bus.list_event_types()

    def test_multiple_event_types(self):
        bus = AsyncEventBus()
        bus.subscribe("a", lambda d: None)
        bus.subscribe("b", lambda d: None)
        bus.subscribe("c", lambda d: None)
        assert set(bus.list_event_types()) == {"a", "b", "c"}


# ── publish async patterns ────────────────────────────────────────────

class TestPublishAsync:
    @pytest.mark.asyncio
    async def test_publish_with_empty_payload(self):
        bus = AsyncEventBus()
        results = []
        async def handler(data):
            results.append(data)
        bus.subscribe("ev", handler)
        await bus.publish("ev", {})
        assert results == [{}]

    @pytest.mark.asyncio
    async def test_publish_with_none_payload(self):
        bus = AsyncEventBus()
        results = []
        async def handler(data):
            results.append(data)
        bus.subscribe("ev", handler)
        await bus.publish("ev", None)
        assert results == [None]

    @pytest.mark.asyncio
    async def test_multiple_async_handlers(self):
        bus = AsyncEventBus()
        results = []
        async def h1(data):
            results.append("h1")
        async def h2(data):
            results.append("h2")
        bus.subscribe("ev", h1)
        bus.subscribe("ev", h2)
        await bus.publish("ev", {})
        assert set(results) == {"h1", "h2"}

    @pytest.mark.asyncio
    async def test_mixed_sync_async_handlers(self):
        bus = AsyncEventBus()
        results = []
        async def async_h(data):
            results.append("async")
        def sync_h(data):
            results.append("sync")
        bus.subscribe("ev", async_h)
        bus.subscribe("ev", sync_h)
        await bus.publish("ev", {})
        assert set(results) == {"async", "sync"}

    @pytest.mark.asyncio
    async def test_handler_exception_logged_not_raised(self):
        bus = AsyncEventBus()
        async def failing_handler(data):
            raise ValueError("boom")
        bus.subscribe("ev", failing_handler)
        # Should not raise
        await bus.publish("ev", {})

    @pytest.mark.asyncio
    async def test_sync_handler_exception_isolated(self):
        bus = AsyncEventBus()
        results = []
        def bad_sync(data):
            raise RuntimeError("sync boom")
        async def good_async(data):
            results.append("ok")
        bus.subscribe("ev", bad_sync)
        bus.subscribe("ev", good_async)
        await bus.publish("ev", {})
        assert results == ["ok"]

    @pytest.mark.asyncio
    async def test_publish_to_different_events(self):
        bus = AsyncEventBus()
        results = {}
        async def handler_a(data):
            results["a"] = data
        async def handler_b(data):
            results["b"] = data
        bus.subscribe("ev_a", handler_a)
        bus.subscribe("ev_b", handler_b)
        await bus.publish("ev_a", {"from": "a"})
        assert "a" in results
        assert "b" not in results

    @pytest.mark.asyncio
    async def test_handler_receives_correct_payload(self):
        bus = AsyncEventBus()
        received = []
        async def handler(data):
            received.append(data)
        bus.subscribe("ev", handler)
        payload = {"key": "value", "nested": {"a": 1}}
        await bus.publish("ev", payload)
        assert received[0] == payload
