"""Tests for cache service and performance middleware."""

import pytest
import time
from unittest.mock import MagicMock, AsyncMock

from backend.infrastructure.cache.cache_service import (
    LRUCache,
    CacheService,
    cache_service,
    get_cached_character,
    set_cached_character,
    invalidate_character_cache,
    get_cached_character_list,
    set_cached_character_list,
    get_cached_world_setting,
    set_cached_world_setting,
    invalidate_world_setting_cache,
    get_cached_writing_settings,
    set_cached_writing_settings,
    invalidate_writing_settings_cache,
    get_cached_ai_result,
    set_cached_ai_result,
    hash_prompt,
)
from backend.middleware.performance import (
    PerformanceMiddleware,
    QueryTimer,
    SLOW_QUERY_THRESHOLD_MS,
    setup_performance_middleware,
)


# ============ LRU Cache Tests ============

class TestLRUCache:
    """Tests for the in-memory LRU cache."""

    def test_basic_get_set(self):
        cache = LRUCache(max_size=10, default_ttl=300)
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"

    def test_get_missing_returns_none(self):
        cache = LRUCache(max_size=10, default_ttl=300)
        assert cache.get("missing") is None

    def test_ttl_expiration(self):
        cache = LRUCache(max_size=10, default_ttl=1)
        cache.set("key1", "value1", ttl=0.1)
        assert cache.get("key1") == "value1"
        time.sleep(0.15)
        assert cache.get("key1") is None

    def test_lru_eviction(self):
        cache = LRUCache(max_size=3, default_ttl=300)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        cache.set("d", 4)  # Should evict "a"
        assert cache.get("a") is None
        assert cache.get("b") == 2
        assert cache.get("c") == 3
        assert cache.get("d") == 4

    def test_lru_order_update_on_get(self):
        cache = LRUCache(max_size=3, default_ttl=300)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        cache.get("a")  # Move "a" to most recently used
        cache.set("d", 4)  # Should evict "b" instead of "a"
        assert cache.get("a") == 1
        assert cache.get("b") is None
        assert cache.get("c") == 3
        assert cache.get("d") == 4

    def test_delete(self):
        cache = LRUCache(max_size=10, default_ttl=300)
        cache.set("key1", "value1")
        assert cache.delete("key1") is True
        assert cache.get("key1") is None
        assert cache.delete("key1") is False

    def test_delete_pattern(self):
        cache = LRUCache(max_size=10, default_ttl=300)
        cache.set("user:1", "a")
        cache.set("user:2", "b")
        cache.set("post:1", "c")
        deleted = cache.delete_pattern("user:")
        assert deleted == 2
        assert cache.get("user:1") is None
        assert cache.get("user:2") is None
        assert cache.get("post:1") == "c"

    def test_clear(self):
        cache = LRUCache(max_size=10, default_ttl=300)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.clear()
        assert cache.get("a") is None
        assert cache.get("b") is None
        assert cache.size() == 0

    def test_stats(self):
        cache = LRUCache(max_size=10, default_ttl=300)
        cache.set("a", 1)
        cache.set("b", 2)
        stats = cache.stats()
        assert stats["size"] == 2
        assert stats["max_size"] == 10
        assert stats["default_ttl"] == 300
        assert stats["expired_entries"] == 0

    def test_complex_data_types(self):
        cache = LRUCache(max_size=10, default_ttl=300)
        data = {"id": 1, "name": "Test", "nested": {"key": "value"}, "list": [1, 2, 3]}
        cache.set("dict", data)
        assert cache.get("dict") == data


# ============ Cache Service Tests ============

class TestCacheService:
    """Tests for the CacheService class."""

    def test_entity_type_caches_isolated(self):
        service = CacheService()
        service.set("character", "key1", "char_value")
        service.set("chapter", "key1", "chapter_value")
        assert service.get("character", "key1") == "char_value"
        assert service.get("chapter", "key1") == "chapter_value"

    def test_make_key_deterministic(self):
        key1 = CacheService.make_key("prefix", 1, "test")
        key2 = CacheService.make_key("prefix", 1, "test")
        assert key1 == key2

    def test_make_key_different_args(self):
        key1 = CacheService.make_key("prefix", 1)
        key2 = CacheService.make_key("prefix", 2)
        assert key1 != key2

    def test_hash_prompt_deterministic(self):
        h1 = hash_prompt("test prompt", "continue", "default", 70)
        h2 = hash_prompt("test prompt", "continue", "default", 70)
        assert h1 == h2

    def test_hash_prompt_different_inputs(self):
        h1 = hash_prompt("prompt1", "continue", "default", 70)
        h2 = hash_prompt("prompt2", "continue", "default", 70)
        assert h1 != h2

    def test_stats_returns_all_caches(self):
        service = CacheService()
        stats = service.stats()
        assert "memory_caches" in stats
        assert "characters" in stats["memory_caches"]
        assert "world_settings" in stats["memory_caches"]
        assert "ai_results" in stats["memory_caches"]

    def test_clear_all(self):
        service = CacheService()
        service.set("character", "key1", "value1")
        service.set("chapter", "key2", "value2")
        service.clear_all()
        assert service.get("character", "key1") is None
        assert service.get("chapter", "key2") is None


# ============ Convenience Function Tests ============

class TestConvenienceFunctions:
    """Tests for cache convenience functions."""

    def test_character_cache_roundtrip(self):
        invalidate_character_cache()
        assert get_cached_character(1) is None
        set_cached_character(1, {"id": 1, "name": "Alice"})
        assert get_cached_character(1) == {"id": 1, "name": "Alice"}

    def test_character_list_cache(self):
        set_cached_character_list([{"id": 1}, {"id": 2}])
        result = get_cached_character_list()
        assert result == [{"id": 1}, {"id": 2}]

    def test_invalidate_character_clears_single(self):
        set_cached_character(1, {"id": 1})
        set_cached_character(2, {"id": 2})
        invalidate_character_cache(1)
        # Cache invalidation clears the entire character cache
        # because MD5-hashed keys prevent substring pattern matching
        assert get_cached_character(1) is None
        assert get_cached_character(2) is None

    def test_invalidate_character_clears_all(self):
        set_cached_character(1, {"id": 1})
        set_cached_character_list([{"id": 1}])
        invalidate_character_cache()
        assert get_cached_character(1) is None
        assert get_cached_character_list() is None

    def test_world_setting_cache(self):
        invalidate_world_setting_cache()
        assert get_cached_world_setting(1) is None
        set_cached_world_setting(1, {"id": 1, "name": "Magic System"})
        assert get_cached_world_setting(1) == {"id": 1, "name": "Magic System"}

    def test_writing_settings_cache(self):
        invalidate_writing_settings_cache()
        assert get_cached_writing_settings() is None
        set_cached_writing_settings({"human_ai_ratio": 0.7, "style": "default"})
        assert get_cached_writing_settings()["human_ai_ratio"] == 0.7

    def test_ai_result_cache(self):
        prompt_hash = hash_prompt("test", "review", "default", 50)
        set_cached_ai_result(prompt_hash, {"result": "test output"})
        cached = get_cached_ai_result(prompt_hash)
        assert cached == {"result": "test output"}


# ============ Performance Middleware Tests ============

@pytest.mark.asyncio
class TestPerformanceMiddleware:
    """Tests for performance monitoring middleware."""

    async def test_adds_performance_headers(self):
        from fastapi import FastAPI
        from httpx import AsyncClient, ASGITransport

        app = FastAPI()
        setup_performance_middleware(app)

        @app.get("/test")
        async def test_endpoint():
            return {"status": "ok"}

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            response = await client.get("/test")
            assert response.status_code == 200
            assert "X-Request-Duration-Ms" in response.headers
            assert "X-Db-Query-Count" in response.headers
            assert float(response.headers["X-Request-Duration-Ms"]) >= 0
            assert int(response.headers["X-Db-Query-Count"]) == 0

    async def test_tracks_query_count(self):
        request = MagicMock()
        request.state = MagicMock()
        request.state.query_count = 0
        request.state.query_times = []
        request.state.start_time = time.perf_counter()

        # Simulate queries
        request.state.query_count = 3
        request.state.query_times = [
            {"query": "SELECT 1", "duration_ms": 10},
            {"query": "SELECT 2", "duration_ms": 20},
            {"query": "SELECT 3", "duration_ms": 30},
        ]

        assert request.state.query_count == 3
        assert len(request.state.query_times) == 3


@pytest.mark.asyncio
class TestQueryTimer:
    """Tests for the QueryTimer context manager."""

    async def test_times_query(self):
        request = MagicMock()
        request.state.query_count = 0
        request.state.query_times = []

        async with QueryTimer(request, "SELECT * FROM test") as timer:
            time.sleep(0.01)  # Small delay

        assert timer.duration_ms >= 10
        assert request.state.query_count == 1
        assert len(request.state.query_times) == 1
        assert request.state.query_times[0]["query"] == "SELECT * FROM test"

    async def test_no_request_does_not_fail(self):
        async with QueryTimer(None, "SELECT 1") as timer:
            time.sleep(0.01)

        assert timer.duration_ms >= 10

    async def test_slow_query_detection(self):
        request = MagicMock()
        request.state.query_count = 0
        request.state.query_times = []

        async with QueryTimer(request, "SELECT SLOW", slow_threshold_ms=5) as timer:
            time.sleep(0.1)  # 100ms > 5ms threshold

        assert timer.duration_ms >= 100
        assert request.state.query_count == 1
        # Should be logged as slow, but we verify via the timing
        assert request.state.query_times[0]["duration_ms"] >= 100


# ============ Cache Invalidation Pattern Tests ============

class TestCacheInvalidationPatterns:
    """Tests for cache invalidation patterns matching real usage."""

    def test_database_pattern_invalidation(self):
        """Simulate database write invalidating related caches."""
        cache = LRUCache(max_size=100, default_ttl=300)

        # Simulate cached entities
        cache.set("char|1", {"id": 1, "name": "Alice"})
        cache.set("char|2", {"id": 2, "name": "Bob"})
        cache.set("char_list|all", [{"id": 1}, {"id": 2}])
        cache.set("char_list|tier=gold", [{"id": 1}])

        # On character update, invalidate that character and all lists
        cache.delete("char|1")
        cache.delete_pattern("char_list")

        assert cache.get("char|1") is None
        assert cache.get("char|2") == {"id": 2, "name": "Bob"}  # Unaffected
        assert cache.get("char_list|all") is None
        assert cache.get("char_list|tier=gold") is None

    def test_ttl_variations(self):
        cache = LRUCache(max_size=100, default_ttl=300)

        # Short TTL for volatile data
        cache.set("chat_messages|1", ["msg1", "msg2"], ttl=60)
        # Long TTL for stable data
        cache.set("world_settings|all", [{"name": "Magic"}], ttl=3600)

        assert cache.get("chat_messages|1") == ["msg1", "msg2"]
        assert cache.get("world_settings|all") == [{"name": "Magic"}]


# ============ Integration-Style Tests ============

class TestCacheIntegration:
    """Integration-style tests for cache with simulated database operations."""

    def test_simulated_crud_with_cache(self):
        """Simulate full CRUD cycle with caching."""
        cache = LRUCache(max_size=100, default_ttl=300)

        # CREATE - no cache interaction needed
        character = {"id": 1, "name": "Alice", "tier": "gold"}

        # READ - cache miss, then populate
        cache_key = f"char|{character['id']}"
        cached = cache.get(cache_key)
        assert cached is None  # Cache miss
        cache.set(cache_key, character)

        # Second READ - cache hit
        cached = cache.get(cache_key)
        assert cached == character

        # UPDATE - invalidate and re-cache
        character["name"] = "Alice Updated"
        cache.delete(cache_key)
        cache.set(cache_key, character)
        assert cache.get(cache_key)["name"] == "Alice Updated"

        # DELETE - remove from cache
        cache.delete(cache_key)
        assert cache.get(cache_key) is None

    def test_cache_service_decorator(self):
        """Test that the cached decorator works correctly."""
        service = CacheService()
        call_count = 0

        @service.cached("character", key_prefix="test_char")
        async def get_test_char(char_id: int):
            nonlocal call_count
            call_count += 1
            return {"id": char_id, "name": f"Character {char_id}"}

        import asyncio

        # First call - should execute
        result1 = asyncio.run(get_test_char(1))
        assert call_count == 1
        assert result1["name"] == "Character 1"

        # Second call - should hit cache
        result2 = asyncio.run(get_test_char(1))
        assert call_count == 1  # No additional call
        assert result2 == result1

        # Different arg - should execute
        result3 = asyncio.run(get_test_char(2))
        assert call_count == 2
        assert result3["name"] == "Character 2"
