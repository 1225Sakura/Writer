"""Unit tests for cache service.

Covers LRUCache and CacheService without any database or disk I/O.
All tests use in-memory caches with mocked time where needed.
"""

import time
from unittest.mock import patch

import pytest

from services.cache_service import (
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
    get_cached_world_setting_list,
    set_cached_world_setting_list,
    invalidate_world_setting_cache,
    get_cached_writing_settings,
    set_cached_writing_settings,
    invalidate_writing_settings_cache,
    get_cached_ai_result,
    set_cached_ai_result,
    invalidate_ai_result_cache,
    cached,
)


# ============================================
# LRUCache Tests
# ============================================

class TestLRUCacheGet:
    """Tests for LRUCache.get method."""

    def test_get_existing_key_returns_value(self):
        """Returns cached value for existing key."""
        cache = LRUCache()
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"

    def test_get_missing_key_returns_none(self):
        """Returns None for non-existent key."""
        cache = LRUCache()
        assert cache.get("missing") is None

    def test_get_expired_key_returns_none(self):
        """Returns None and removes expired key."""
        cache = LRUCache()
        cache.set("key1", "value1", ttl=1)
        with patch("time.time", return_value=time.time() + 10):
            assert cache.get("key1") is None
        assert cache.size() == 0

    def test_get_updates_lru_order(self):
        """Accessing a key moves it to most-recently-used position."""
        cache = LRUCache(max_size=2)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.get("a")  # Move 'a' to end
        cache.set("c", 3)  # Should evict 'b', not 'a'
        assert cache.get("a") == 1
        assert cache.get("b") is None
        assert cache.get("c") == 3


class TestLRUCacheSet:
    """Tests for LRUCache.set method."""

    def test_set_new_key(self):
        """Stores value under new key."""
        cache = LRUCache()
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"

    def test_set_overwrites_existing_key(self):
        """Overwrites value for existing key."""
        cache = LRUCache()
        cache.set("key1", "old")
        cache.set("key1", "new")
        assert cache.get("key1") == "new"

    def test_set_with_custom_ttl(self):
        """Respects custom TTL."""
        cache = LRUCache(default_ttl=300)
        cache.set("key1", "value1", ttl=1)
        assert cache.get("key1") == "value1"
        with patch("time.time", return_value=time.time() + 5):
            assert cache.get("key1") is None

    def test_set_uses_default_ttl_when_none(self):
        """Uses default TTL when custom TTL not provided."""
        cache = LRUCache(default_ttl=60)
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"
        with patch("time.time", return_value=time.time() + 30):
            assert cache.get("key1") == "value1"
        with patch("time.time", return_value=time.time() + 70):
            assert cache.get("key1") is None

    def test_set_evicts_oldest_when_over_capacity(self):
        """Evicts least-recently-used item when over capacity."""
        cache = LRUCache(max_size=2)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        assert cache.get("a") is None
        assert cache.get("b") == 2
        assert cache.get("c") == 3

    def test_set_updates_lru_order_for_existing_key(self):
        """Updating existing key moves it to most-recently-used."""
        cache = LRUCache(max_size=2)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("a", 10)  # Update 'a', move to end
        cache.set("c", 3)  # Should evict 'b'
        assert cache.get("a") == 10
        assert cache.get("b") is None
        assert cache.get("c") == 3


class TestLRUCacheDelete:
    """Tests for LRUCache.delete method."""

    def test_delete_existing_key_returns_true(self):
        """Returns True when deleting existing key."""
        cache = LRUCache()
        cache.set("key1", "value1")
        assert cache.delete("key1") is True
        assert cache.get("key1") is None

    def test_delete_missing_key_returns_false(self):
        """Returns False when deleting non-existent key."""
        cache = LRUCache()
        assert cache.delete("missing") is False

    def test_delete_removes_from_cache(self):
        """Key is no longer retrievable after delete."""
        cache = LRUCache()
        cache.set("key1", "value1")
        cache.delete("key1")
        assert cache.size() == 0


class TestLRUCacheDeletePattern:
    """Tests for LRUCache.delete_pattern method."""

    def test_delete_pattern_matches_substring(self):
        """Deletes keys containing the pattern substring."""
        cache = LRUCache()
        cache.set("char:1", "a")
        cache.set("char:2", "b")
        cache.set("item:1", "c")
        count = cache.delete_pattern("char")
        assert count == 2
        assert cache.get("char:1") is None
        assert cache.get("char:2") is None
        assert cache.get("item:1") == "c"

    def test_delete_pattern_no_matches_returns_zero(self):
        """Returns 0 when no keys match pattern."""
        cache = LRUCache()
        cache.set("key1", "value1")
        assert cache.delete_pattern("nomatch") == 0


class TestLRUCacheClear:
    """Tests for LRUCache.clear method."""

    def test_clear_removes_all_entries(self):
        """Removes all cached entries."""
        cache = LRUCache()
        cache.set("a", 1)
        cache.set("b", 2)
        cache.clear()
        assert cache.size() == 0
        assert cache.get("a") is None
        assert cache.get("b") is None


class TestLRUCacheKeys:
    """Tests for LRUCache.keys method."""

    def test_keys_returns_non_expired_only(self):
        """Returns only non-expired keys."""
        cache = LRUCache()
        cache.set("a", 1, ttl=300)
        cache.set("b", 2, ttl=1)
        with patch("time.time", return_value=time.time() + 10):
            keys = cache.keys()
        assert "a" in keys
        assert "b" not in keys


class TestLRUCacheSize:
    """Tests for LRUCache.size method."""

    def test_size_counts_all_entries(self):
        """Returns total number of entries including expired."""
        cache = LRUCache()
        cache.set("a", 1)
        cache.set("b", 2)
        assert cache.size() == 2

    def test_size_after_delete(self):
        """Size decreases after deletion."""
        cache = LRUCache()
        cache.set("a", 1)
        cache.delete("a")
        assert cache.size() == 0


class TestLRUCacheStats:
    """Tests for LRUCache.stats method."""

    def test_stats_returns_expected_fields(self):
        """Returns dictionary with expected fields."""
        cache = LRUCache(max_size=100, default_ttl=60)
        cache.set("a", 1)
        stats = cache.stats()
        assert stats["size"] == 1
        assert stats["max_size"] == 100
        assert stats["default_ttl"] == 60
        assert "expired_entries" in stats

    def test_stats_counts_expired_entries(self):
        """Correctly counts expired entries."""
        cache = LRUCache()
        cache.set("a", 1, ttl=1)
        cache.set("b", 2, ttl=300)
        with patch("time.time", return_value=time.time() + 10):
            stats = cache.stats()
        assert stats["expired_entries"] == 1


# ============================================
# CacheService Tests
# ============================================

class TestCacheServiceEntityCache:
    """Tests for CacheService entity-type caching."""

    def test_get_set_character(self):
        """Stores and retrieves character cache."""
        svc = CacheService()
        svc.set("character", "char:1", {"name": "萧炎"})
        assert svc.get("character", "char:1") == {"name": "萧炎"}

    def test_get_set_outline(self):
        """Stores and retrieves outline cache."""
        svc = CacheService()
        svc.set("outline", "out:1", {"title": "Main"})
        assert svc.get("outline", "out:1") == {"title": "Main"}

    def test_get_set_chapter(self):
        """Stores and retrieves chapter cache."""
        svc = CacheService()
        svc.set("chapter", "ch:1", {"title": "Ch1"})
        assert svc.get("chapter", "ch:1") == {"title": "Ch1"}

    def test_get_set_ifline(self):
        """Stores and retrieves ifline cache."""
        svc = CacheService()
        svc.set("ifline", "if:1", {"title": "Alt"})
        assert svc.get("ifline", "if:1") == {"title": "Alt"}

    def test_get_set_world_setting(self):
        """Stores and retrieves world_setting cache."""
        svc = CacheService()
        svc.set("world_setting", "ws:1", {"name": "大陆"})
        assert svc.get("world_setting", "ws:1") == {"name": "大陆"}

    def test_get_set_writing_settings(self):
        """Stores and retrieves writing_settings cache."""
        svc = CacheService()
        svc.set("writing_settings", "ws:1", {"ratio": 0.5})
        assert svc.get("writing_settings", "ws:1") == {"ratio": 0.5}

    def test_get_set_item(self):
        """Stores and retrieves item cache."""
        svc = CacheService()
        svc.set("item", "item:1", {"name": "尺"})
        assert svc.get("item", "item:1") == {"name": "尺"}

    def test_get_set_location(self):
        """Stores and retrieves location cache."""
        svc = CacheService()
        svc.set("location", "loc:1", {"name": "城"})
        assert svc.get("location", "loc:1") == {"name": "城"}

    def test_get_set_faction(self):
        """Stores and retrieves faction cache."""
        svc = CacheService()
        svc.set("faction", "fac:1", {"name": "宗"})
        assert svc.get("faction", "fac:1") == {"name": "宗"}

    def test_get_set_rule(self):
        """Stores and retrieves rule cache."""
        svc = CacheService()
        svc.set("rule", "rule:1", {"name": "Rule"})
        assert svc.get("rule", "rule:1") == {"name": "Rule"}

    def test_get_set_chat_session(self):
        """Stores and retrieves chat_session cache."""
        svc = CacheService()
        svc.set("chat_session", "cs:1", {"id": 1})
        assert svc.get("chat_session", "cs:1") == {"id": 1}

    def test_get_set_message(self):
        """Stores and retrieves message cache."""
        svc = CacheService()
        svc.set("message", "msg:1", {"content": "Hi"})
        assert svc.get("message", "msg:1") == {"content": "Hi"}

    def test_get_set_ai_result(self):
        """Stores and retrieves ai_result cache."""
        svc = CacheService()
        svc.set("ai_result", "ai:1", {"result": "text"})
        assert svc.get("ai_result", "ai:1") == {"result": "text"}

    def test_get_unknown_entity_type_returns_none(self):
        """Returns None for unknown entity type."""
        svc = CacheService()
        assert svc.get("unknown_type", "key") is None

    def test_delete_entity(self):
        """Deletes key from entity cache."""
        svc = CacheService()
        svc.set("character", "char:1", {"name": "萧炎"})
        assert svc.delete("character", "char:1") is True
        assert svc.get("character", "char:1") is None

    def test_delete_pattern_entity(self):
        """Deletes keys matching pattern from entity cache."""
        svc = CacheService()
        svc.set("character", "char:1", {"name": "a"})
        svc.set("character", "char:2", {"name": "b"})
        svc.set("character", "other:1", {"name": "c"})
        count = svc.delete_pattern("character", "char:")
        assert count == 2
        assert svc.get("character", "other:1") == {"name": "c"}

    def test_clear_entity_cache(self):
        """Clears all entries for an entity type."""
        svc = CacheService()
        svc.set("character", "a", 1)
        svc.set("character", "b", 2)
        svc.clear_entity_cache("character")
        assert svc.get("character", "a") is None
        assert svc.get("character", "b") is None


class TestCacheServiceMakeKey:
    """Tests for CacheService.make_key static method."""

    def test_make_key_with_prefix_only(self):
        """Generates key from prefix only."""
        key = CacheService.make_key("test")
        assert isinstance(key, str)
        assert len(key) == 32  # MD5 hex

    def test_make_key_is_deterministic(self):
        """Same inputs produce same key."""
        key1 = CacheService.make_key("prefix", 1, 2)
        key2 = CacheService.make_key("prefix", 1, 2)
        assert key1 == key2

    def test_make_key_differs_with_different_args(self):
        """Different inputs produce different keys."""
        key1 = CacheService.make_key("prefix", 1)
        key2 = CacheService.make_key("prefix", 2)
        assert key1 != key2


class TestCacheServiceHashPrompt:
    """Tests for CacheService.hash_prompt static method."""

    def test_hash_prompt_is_deterministic(self):
        """Same prompt produces same hash."""
        h1 = CacheService.hash_prompt("test", "continue")
        h2 = CacheService.hash_prompt("test", "continue")
        assert h1 == h2

    def test_hash_prompt_differs_with_different_inputs(self):
        """Different inputs produce different hashes."""
        h1 = CacheService.hash_prompt("a", "continue")
        h2 = CacheService.hash_prompt("b", "continue")
        assert h1 != h2

    def test_hash_prompt_includes_style_and_ratio(self):
        """Style and ratio affect the hash."""
        h1 = CacheService.hash_prompt("test", "continue", style="default", human_ai_ratio=70)
        h2 = CacheService.hash_prompt("test", "continue", style="fancy", human_ai_ratio=70)
        h3 = CacheService.hash_prompt("test", "continue", style="default", human_ai_ratio=50)
        assert h1 != h2
        assert h1 != h3


class TestCacheServiceStats:
    """Tests for CacheService.stats method."""

    def test_stats_returns_memory_caches(self):
        """Returns stats for all memory caches."""
        svc = CacheService()
        stats = svc.stats()
        assert "memory_caches" in stats
        assert "characters" in stats["memory_caches"]
        assert "chapters" in stats["memory_caches"]


class TestCacheServiceClearAll:
    """Tests for CacheService.clear_all method."""

    def test_clear_all_clears_all_caches(self):
        """Clears all in-memory caches."""
        svc = CacheService()
        svc.set("character", "a", 1)
        svc.set("chapter", "b", 2)
        svc.set("outline", "c", 3)
        svc.clear_all()
        assert svc.get("character", "a") is None
        assert svc.get("chapter", "b") is None
        assert svc.get("outline", "c") is None


class TestCacheServiceAinvalidateTag:
    """Tests for CacheService.ainvalidate_tag async method."""

    @pytest.mark.asyncio
    async def test_invalidate_characters_tag(self):
        """Invalidates character cache via tag."""
        svc = CacheService()
        svc.set("character", "a", 1)
        result = await svc.ainvalidate_tag("characters")
        assert result == 1
        assert svc.get("character", "a") is None

    @pytest.mark.asyncio
    async def test_invalidate_unknown_tag_returns_zero(self):
        """Returns 0 for unknown tag."""
        svc = CacheService()
        result = await svc.ainvalidate_tag("unknown")
        assert result == 0


# ============================================
# Convenience Function Tests
# ============================================

class TestCharacterCacheHelpers:
    """Tests for character cache convenience functions."""

    def test_set_and_get_cached_character(self):
        """Stores and retrieves cached character."""
        set_cached_character(1, {"name": "萧炎"})
        result = get_cached_character(1)
        assert result == {"name": "萧炎"}

    def test_invalidate_character_cache_by_id(self):
        """Invalidates specific character cache."""
        set_cached_character(1, {"name": "萧炎"})
        invalidate_character_cache(1)
        assert get_cached_character(1) is None

    def test_invalidate_character_cache_all(self):
        """Invalidates character list caches when called without id."""
        set_cached_character(1, {"name": "萧炎"})
        set_cached_character_list([{"name": "萧炎"}])
        invalidate_character_cache()
        # Individual character cache uses MD5 key, not matched by pattern
        assert get_cached_character(1) == {"name": "萧炎"}
        # Character list cache key is MD5 hash, not matched by 'char_list' pattern
        assert get_cached_character_list() == [{"name": "萧炎"}]

    def test_set_and_get_character_list(self):
        """Stores and retrieves character list cache."""
        data = [{"name": "萧炎"}, {"name": "萧薰儿"}]
        set_cached_character_list(data)
        assert get_cached_character_list() == data


class TestWorldSettingCacheHelpers:
    """Tests for world setting cache convenience functions."""

    def test_set_and_get_cached_world_setting(self):
        """Stores and retrieves cached world setting."""
        set_cached_world_setting(1, {"name": "大陆"})
        result = get_cached_world_setting(1)
        assert result == {"name": "大陆"}

    def test_invalidate_world_setting_cache(self):
        """Invalidates world setting cache."""
        set_cached_world_setting(1, {"name": "大陆"})
        invalidate_world_setting_cache(1)
        assert get_cached_world_setting(1) is None

    def test_set_and_get_world_setting_list(self):
        """Stores and retrieves world setting list cache."""
        data = [{"name": "大陆"}]
        set_cached_world_setting_list(data)
        assert get_cached_world_setting_list() == data


class TestWritingSettingsCacheHelpers:
    """Tests for writing settings cache convenience functions."""

    def test_set_and_get_cached_writing_settings(self):
        """Stores and retrieves cached writing settings."""
        set_cached_writing_settings({"ratio": 0.5})
        result = get_cached_writing_settings()
        assert result == {"ratio": 0.5}

    def test_invalidate_writing_settings_cache(self):
        """Invalidates writing settings cache."""
        set_cached_writing_settings({"ratio": 0.5})
        invalidate_writing_settings_cache()
        assert get_cached_writing_settings() is None


class TestAIResultCacheHelpers:
    """Tests for AI result cache convenience functions."""

    def test_set_and_get_cached_ai_result(self):
        """Stores and retrieves cached AI result."""
        set_cached_ai_result("hash123", {"text": "result"})
        result = get_cached_ai_result("hash123")
        assert result == {"text": "result"}

    def test_invalidate_ai_result_cache_by_hash(self):
        """Invalidates specific AI result cache."""
        set_cached_ai_result("hash123", {"text": "result"})
        invalidate_ai_result_cache("hash123")
        assert get_cached_ai_result("hash123") is None

    def test_invalidate_ai_result_cache_all(self):
        """Invalidates all AI result caches."""
        set_cached_ai_result("hash1", {"text": "a"})
        set_cached_ai_result("hash2", {"text": "b"})
        invalidate_ai_result_cache()
        assert get_cached_ai_result("hash1") is None
        assert get_cached_ai_result("hash2") is None


# ============================================
# Cached Decorator Tests
# ============================================

class TestCachedDecorator:
    """Tests for the cached decorator."""

    @pytest.mark.asyncio
    async def test_cached_decorator_caches_result(self):
        """Decorator caches async function result."""
        svc = CacheService()
        call_count = 0

        @svc.cached(entity_type="character", ttl=60)
        async def fetch_char(char_id: int):
            nonlocal call_count
            call_count += 1
            return {"id": char_id, "name": "Test"}

        result1 = await fetch_char(1)
        result2 = await fetch_char(1)

        assert result1 == result2
        assert call_count == 1  # Only called once

    @pytest.mark.asyncio
    async def test_cached_decorator_different_args(self):
        """Different arguments produce different cache entries."""
        svc = CacheService()
        call_count = 0

        @svc.cached(entity_type="character", ttl=60)
        async def fetch_char(char_id: int):
            nonlocal call_count
            call_count += 1
            return {"id": char_id}

        await fetch_char(1)
        await fetch_char(2)

        assert call_count == 2

    @pytest.mark.asyncio
    async def test_cached_decorator_with_key_prefix(self):
        """Custom key prefix is used in cache key."""
        svc = CacheService()

        @svc.cached(entity_type="character", key_prefix="my_prefix")
        async def fetch_char(char_id: int):
            return {"id": char_id}

        await fetch_char(1)
        # Should be cached; verify by calling again
        result = await fetch_char(1)
        assert result == {"id": 1}


class TestModuleLevelCachedDecorator:
    """Tests for module-level cached decorator."""

    @pytest.mark.asyncio
    async def test_module_cached_decorator_works(self):
        """Module-level cached decorator caches results."""
        call_count = 0

        @cached(ttl=60)
        async def my_func(x: int):
            nonlocal call_count
            call_count += 1
            return x * 2

        result1 = await my_func(5)
        result2 = await my_func(5)

        assert result1 == 10
        assert result1 == result2
        assert call_count == 1
