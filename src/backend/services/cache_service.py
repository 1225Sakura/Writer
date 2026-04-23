# Auto Novel Writer - Cache Service
# Hybrid in-memory LRU + disk-backed cache for local desktop app

import functools
import hashlib
import json
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any, Callable, Optional, TypeVar

try:
    from diskcache import Cache
    DISKCACHE_AVAILABLE = True
except ImportError:
    DISKCACHE_AVAILABLE = False

from backend.config import settings

F = TypeVar("F", bound=Callable[..., Any])


class LRUCache:
    """In-memory LRU cache with TTL-based expiration.

    Suitable for hot data that needs fast access without disk I/O.
    """

    def __init__(self, max_size: int = 128, default_ttl: int = 300):
        """Initialize LRU cache.

        Args:
            max_size: Maximum number of items in cache
            default_ttl: Default time-to-live in seconds
        """
        self.max_size = max_size
        self.default_ttl = default_ttl
        self._cache: OrderedDict[str, tuple[Any, float]] = OrderedDict()

    def _is_expired(self, timestamp: float) -> bool:
        """Check if a cache entry has expired."""
        return time.time() > timestamp

    def get(self, key: str) -> Any:
        """Get value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found or expired
        """
        if key not in self._cache:
            return None

        value, expire_at = self._cache[key]
        if self._is_expired(expire_at):
            del self._cache[key]
            return None

        # Move to end (most recently used)
        self._cache.move_to_end(key)
        return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (uses default if not specified)
        """
        ttl = ttl if ttl is not None else self.default_ttl
        expire_at = time.time() + ttl

        # If key exists, update and move to end
        if key in self._cache:
            self._cache.move_to_end(key)

        self._cache[key] = (value, expire_at)

        # Evict oldest if over capacity
        while len(self._cache) > self.max_size:
            self._cache.popitem(last=False)

    def delete(self, key: str) -> bool:
        """Delete a key from cache.

        Args:
            key: Cache key

        Returns:
            True if key was found and deleted, False otherwise
        """
        if key in self._cache:
            del self._cache[key]
            return True
        return False

    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern (substring match).

        Args:
            pattern: Substring to match in keys

        Returns:
            Number of keys deleted
        """
        keys_to_delete = [k for k in self._cache if pattern in k]
        for key in keys_to_delete:
            del self._cache[key]
        return len(keys_to_delete)

    def clear(self) -> None:
        """Clear all cache entries."""
        self._cache.clear()

    def keys(self) -> list[str]:
        """Get all non-expired cache keys."""
        now = time.time()
        return [k for k, (_, expire_at) in self._cache.items() if expire_at > now]

    def size(self) -> int:
        """Get current cache size."""
        return len(self._cache)

    def stats(self) -> dict:
        """Get cache statistics."""
        now = time.time()
        expired = sum(1 for _, expire_at in self._cache.values() if expire_at <= now)
        return {
            "size": len(self._cache),
            "max_size": self.max_size,
            "default_ttl": self.default_ttl,
            "expired_entries": expired,
        }


class CacheService:
    """Hybrid cache service with in-memory LRU + disk-backed persistence.

    - In-memory LRU for hot data (characters, world settings, writing settings)
    - Disk cache for larger/persistent data (AI results, export data)
    """

    def __init__(self, cache_dir: Optional[Path] = None) -> None:
        self._cache_dir = cache_dir or settings.cache_dir

        # In-memory LRU caches for hot data
        self._character_cache = LRUCache(max_size=256, default_ttl=300)
        self._world_setting_cache = LRUCache(max_size=64, default_ttl=600)
        self._writing_settings_cache = LRUCache(max_size=16, default_ttl=300)
        self._chapter_cache = LRUCache(max_size=128, default_ttl=180)
        self._item_cache = LRUCache(max_size=128, default_ttl=300)
        self._location_cache = LRUCache(max_size=128, default_ttl=300)
        self._faction_cache = LRUCache(max_size=128, default_ttl=300)
        self._rule_cache = LRUCache(max_size=64, default_ttl=300)
        self._outline_cache = LRUCache(max_size=32, default_ttl=300)
        self._ifline_cache = LRUCache(max_size=64, default_ttl=300)
        self._chat_session_cache = LRUCache(max_size=64, default_ttl=180)
        self._message_cache = LRUCache(max_size=128, default_ttl=120)
        self._ai_result_cache = LRUCache(max_size=100, default_ttl=3600)

        # Disk cache for persistent/large data
        if DISKCACHE_AVAILABLE:
            self._disk_cache: Optional[Cache] = Cache(str(self._cache_dir))
        else:
            self._disk_cache = None

    # ------------------------------------------------------------------
    # In-memory cache accessors by entity type
    # ------------------------------------------------------------------

    def _get_cache(self, entity_type: str) -> LRUCache:
        """Get the appropriate in-memory cache for an entity type."""
        cache_map = {
            "character": self._character_cache,
            "world_setting": self._world_setting_cache,
            "writing_settings": self._writing_settings_cache,
            "chapter": self._chapter_cache,
            "item": self._item_cache,
            "location": self._location_cache,
            "faction": self._faction_cache,
            "rule": self._rule_cache,
            "outline": self._outline_cache,
            "ifline": self._ifline_cache,
            "chat_session": self._chat_session_cache,
            "message": self._message_cache,
            "ai_result": self._ai_result_cache,
        }
        return cache_map.get(entity_type, self._character_cache)

    def get(self, entity_type: str, key: str) -> Any:
        """Get value from in-memory cache by entity type."""
        cache = self._get_cache(entity_type)
        return cache.get(key)

    def set(self, entity_type: str, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set value in in-memory cache by entity type."""
        cache = self._get_cache(entity_type)
        cache.set(key, value, ttl=ttl)

    def delete(self, entity_type: str, key: str) -> bool:
        """Delete a key from in-memory cache."""
        cache = self._get_cache(entity_type)
        return cache.delete(key)

    def delete_pattern(self, entity_type: str, pattern: str) -> int:
        """Delete keys matching pattern from in-memory cache."""
        cache = self._get_cache(entity_type)
        return cache.delete_pattern(pattern)

    def clear_entity_cache(self, entity_type: str) -> None:
        """Clear all entries for an entity type."""
        cache = self._get_cache(entity_type)
        cache.clear()

    # ------------------------------------------------------------------
    # Disk cache operations
    # ------------------------------------------------------------------

    def disk_get(self, key: str, default: Any = None) -> Any:
        """Retrieve a value from disk cache."""
        if self._disk_cache:
            return self._disk_cache.get(key, default=default)
        return default

    def disk_set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Store a value in disk cache with optional TTL."""
        if self._disk_cache:
            self._disk_cache.set(key, value, expire=ttl)

    def disk_delete(self, key: str) -> bool:
        """Delete a single key from disk cache."""
        if self._disk_cache:
            return self._disk_cache.delete(key)
        return False

    def disk_flush(self) -> None:
        """Clear the entire disk cache."""
        if self._disk_cache:
            self._disk_cache.clear()

    # ------------------------------------------------------------------
    # Cache key helpers
    # ------------------------------------------------------------------

    @staticmethod
    def make_key(prefix: str, *args: Any, **kwargs: Any) -> str:
        """Create a deterministic cache key."""
        key_parts = [prefix]
        if args:
            key_parts.append(json.dumps(args, sort_keys=True, default=str))
        if kwargs:
            key_parts.append(json.dumps(kwargs, sort_keys=True, default=str))
        raw_key = "|".join(key_parts)
        return hashlib.md5(raw_key.encode()).hexdigest()

    @staticmethod
    def hash_prompt(prompt: str, operation: str, style: str = "default", human_ai_ratio: int = 70) -> str:
        """Create a hash key for an AI prompt."""
        key_data = f"{operation}|{style}|{human_ai_ratio}|{prompt}"
        return hashlib.md5(key_data.encode()).hexdigest()

    # ------------------------------------------------------------------
    # Decorators
    # ------------------------------------------------------------------

    def cached(
        self,
        entity_type: str,
        ttl: Optional[int] = None,
        key_prefix: Optional[str] = None,
    ) -> Callable[[F], F]:
        """Decorator that caches async function results in memory.

        Args:
            entity_type: Type of entity (determines which cache to use)
            ttl: Time-to-live in seconds
            key_prefix: Static prefix for the cache key
        """
        def decorator(func: F) -> F:
            prefix = key_prefix or func.__qualname__

            @functools.wraps(func)
            async def wrapper(*args: Any, **kwargs: Any) -> Any:
                # Build deterministic cache key
                key_parts = [prefix]
                # Include positional args (skip 'self' / class instances)
                for i, arg in enumerate(args):
                    try:
                        key_parts.append(f"arg{i}={json.dumps(arg, sort_keys=True, default=str)}")
                    except (TypeError, ValueError):
                        key_parts.append(f"arg{i}={str(arg)}")
                skip_names = {"db", "request", "session"}
                for k, v in sorted(kwargs.items()):
                    if k in skip_names:
                        continue
                    try:
                        key_parts.append(f"{k}={json.dumps(v, sort_keys=True)}")
                    except (TypeError, ValueError):
                        key_parts.append(f"{k}={str(v)}")
                cache_key = "|".join(key_parts)
                cache_key = hashlib.md5(cache_key.encode()).hexdigest()

                # Try cache
                cache = self._get_cache(entity_type)
                cached_val = cache.get(cache_key)
                if cached_val is not None:
                    return cached_val

                # Execute and store
                result = await func(*args, **kwargs)
                cache.set(cache_key, result, ttl=ttl)
                return result

            return wrapper  # type: ignore[return-value]

        return decorator

    # ------------------------------------------------------------------
    # Statistics
    # ------------------------------------------------------------------

    def stats(self) -> dict[str, Any]:
        """Return cache statistics for all caches."""
        stats = {
            "memory_caches": {
                "characters": self._character_cache.stats(),
                "world_settings": self._world_setting_cache.stats(),
                "writing_settings": self._writing_settings_cache.stats(),
                "chapters": self._chapter_cache.stats(),
                "items": self._item_cache.stats(),
                "locations": self._location_cache.stats(),
                "factions": self._faction_cache.stats(),
                "rules": self._rule_cache.stats(),
                "outlines": self._outline_cache.stats(),
                "iflines": self._ifline_cache.stats(),
                "chat_sessions": self._chat_session_cache.stats(),
                "messages": self._message_cache.stats(),
                "ai_results": self._ai_result_cache.stats(),
            },
        }
        if self._disk_cache:
            stats["disk_cache"] = {
                "size": len(self._disk_cache),
                "directory": str(self._cache_dir),
            }
        return stats

    def clear_all(self) -> None:
        """Clear all in-memory caches."""
        self._character_cache.clear()
        self._world_setting_cache.clear()
        self._writing_settings_cache.clear()
        self._chapter_cache.clear()
        self._item_cache.clear()
        self._location_cache.clear()
        self._faction_cache.clear()
        self._rule_cache.clear()
        self._outline_cache.clear()
        self._ifline_cache.clear()
        self._chat_session_cache.clear()
        self._message_cache.clear()
        self._ai_result_cache.clear()

    # ------------------------------------------------------------------
    # Backward-compatible async helpers (used by routes/settings.py)
    # ------------------------------------------------------------------

    async def ainvalidate_tag(self, tag: str) -> int:
        """Invalidate all cache entries associated with a tag (async wrapper)."""
        # For in-memory caches, pattern-based invalidation on the entity type
        # This is a simplified tag-based invalidation
        tag_map = {
            "characters": "character",
            "items": "item",
            "locations": "location",
            "factions": "faction",
            "world": "world_setting",
            "rules": "rule",
            "writing_settings": "writing_settings",
            "chapters": "chapter",
            "outlines": "outline",
            "iflines": "ifline",
            "chat_sessions": "chat_session",
            "messages": "message",
        }
        entity_type = tag_map.get(tag)
        if entity_type:
            self.clear_entity_cache(entity_type)
            return 1
        return 0


# Singleton instance - kept for backward compatibility with module-level convenience functions
_cache_service_instance: Optional[CacheService] = None


def get_cache_service() -> CacheService:
    """Get the global CacheService instance (for dependency injection).

    Returns:
        The singleton CacheService instance
    """
    global _cache_service_instance
    if _cache_service_instance is None:
        _cache_service_instance = CacheService()
    return _cache_service_instance


def _set_cache_service_instance(cache: CacheService) -> None:
    """Set the global CacheService instance (for testing or custom configurations)."""
    global _cache_service_instance
    _cache_service_instance = cache


# Backward-compatible module-level cached decorator
# (used by routes/settings.py)
def cached(
    ttl: Optional[int] = None,
    key_prefix: Optional[str] = None,
    invalidate_on: Optional[list[str]] = None,
) -> Callable[[F], F]:
    """Backward-compatible cached decorator using the global cache_service.

    Args:
        ttl: Time-to-live in seconds.
        key_prefix: Static prefix for the cache key.
        invalidate_on: List of tag strings for invalidation (ignored in simple implementation).
    """
    return get_cache_service().cached(
        entity_type="character",  # Default entity type
        ttl=ttl,
        key_prefix=key_prefix,
    )


# Convenience functions for common patterns (use get_cache_service() for DI)
def get_cached_character(character_id: int) -> Optional[dict]:
    """Get character from cache."""
    cache = get_cache_service()
    key = cache.make_key("char", character_id)
    return cache.get("character", key)


def set_cached_character(character_id: int, data: dict, ttl: Optional[int] = None) -> None:
    """Cache a character."""
    cache = get_cache_service()
    key = cache.make_key("char", character_id)
    cache.set("character", key, data, ttl=ttl)


def invalidate_character_cache(character_id: Optional[int] = None) -> None:
    """Invalidate character cache entries."""
    cache = get_cache_service()
    if character_id is not None:
        key = cache.make_key("char", character_id)
        cache.delete("character", key)
    cache.delete_pattern("character", "char_list")
    cache.delete_pattern("character", "char")


def get_cached_character_list() -> Optional[list]:
    """Get character list from cache."""
    cache = get_cache_service()
    key = cache.make_key("char_list")
    return cache.get("character", key)


def set_cached_character_list(data: list, ttl: Optional[int] = None) -> None:
    """Cache character list."""
    cache = get_cache_service()
    key = cache.make_key("char_list")
    cache.set("character", key, data, ttl=ttl)


def get_cached_world_setting(setting_id: int) -> Optional[dict]:
    """Get world setting from cache."""
    cache = get_cache_service()
    key = cache.make_key("world", setting_id)
    return cache.get("world_setting", key)


def set_cached_world_setting(setting_id: int, data: dict, ttl: Optional[int] = None) -> None:
    """Cache a world setting."""
    cache = get_cache_service()
    key = cache.make_key("world", setting_id)
    cache.set("world_setting", key, data, ttl=ttl)


def invalidate_world_setting_cache(setting_id: Optional[int] = None) -> None:
    """Invalidate world setting cache."""
    cache = get_cache_service()
    if setting_id is not None:
        key = cache.make_key("world", setting_id)
        cache.delete("world_setting", key)
    cache.delete_pattern("world_setting", "world")


def get_cached_world_setting_list() -> Optional[list]:
    """Get world setting list from cache."""
    cache = get_cache_service()
    key = cache.make_key("world_list")
    return cache.get("world_setting", key)


def set_cached_world_setting_list(data: list, ttl: Optional[int] = None) -> None:
    """Cache world setting list."""
    cache = get_cache_service()
    key = cache.make_key("world_list")
    cache.set("world_setting", key, data, ttl=ttl)


def get_cached_writing_settings() -> Optional[dict]:
    """Get writing settings from cache."""
    cache = get_cache_service()
    key = cache.make_key("write_settings")
    return cache.get("writing_settings", key)


def set_cached_writing_settings(data: dict, ttl: Optional[int] = None) -> None:
    """Cache writing settings."""
    cache = get_cache_service()
    key = cache.make_key("write_settings")
    cache.set("writing_settings", key, data, ttl=ttl)


def invalidate_writing_settings_cache() -> None:
    """Invalidate writing settings cache."""
    cache = get_cache_service()
    key = cache.make_key("write_settings")
    cache.delete("writing_settings", key)


def get_cached_ai_result(prompt_hash: str) -> Optional[dict]:
    """Get cached AI result."""
    cache = get_cache_service()
    key = cache.make_key("ai", prompt_hash)
    return cache.get("ai_result", key)


def set_cached_ai_result(prompt_hash: str, data: dict, ttl: Optional[int] = None) -> None:
    """Cache AI result."""
    cache = get_cache_service()
    key = cache.make_key("ai", prompt_hash)
    cache.set("ai_result", key, data, ttl=ttl)


def invalidate_ai_result_cache(prompt_hash: Optional[str] = None) -> None:
    """Invalidate AI result cache."""
    cache = get_cache_service()
    if prompt_hash:
        key = cache.make_key("ai", prompt_hash)
        cache.delete("ai_result", key)
    else:
        cache.clear_entity_cache("ai_result")


# Backward-compatible alias for module-level cache_service
# (legacy code imports this as: from services.cache_service import cache_service)
cache_service = get_cache_service()
