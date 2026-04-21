# Event Handlers - Default handlers for the async event bus

import logging
from typing import Any, Dict

from backend.services.cache_service import cache_service
from backend.utils.event_bus import (
    CACHE_INVALIDATE,
    ENTITY_DELETED,
    ENTITY_UPDATED,
)

logger = logging.getLogger(__name__)

# Simple in-memory statistics counters
_stats_counters: Dict[str, int] = {
    "entity_updated": 0,
    "entity_deleted": 0,
    "entity_created": 0,
    "cache_invalidate": 0,
}


def _get_entity_type(payload: Dict[str, Any]) -> str:
    """Extract entity_type from payload, defaulting to empty string."""
    return payload.get("entity_type", "")


async def cache_invalidation_handler(payload: Dict[str, Any]) -> None:
    """Invalidate cache entries when entities are updated or deleted.

    Listens for ENTITY_UPDATED and ENTITY_DELETED events and calls
    cache_service.clear_entity_cache() for the affected entity type.
    """
    entity_type = _get_entity_type(payload)
    if not entity_type:
        logger.warning("Cache invalidation event missing entity_type: %s", payload)
        return

    try:
        cache_service.clear_entity_cache(entity_type)
        logger.debug("Cleared cache for entity type: %s", entity_type)
    except Exception:
        logger.exception("Failed to clear cache for entity type: %s", entity_type)


async def stats_update_handler(payload: Dict[str, Any]) -> None:
    """Update simple statistics counters for entity events.

    Increments counters based on event type for basic observability.
    Expects payload to contain 'event_kind' matching the event type constant.
    """
    event_kind = payload.get("event_kind", "")
    counter_key = event_kind.replace(".", "_")
    if counter_key in _stats_counters:
        _stats_counters[counter_key] += 1
        logger.debug("Stats counter '%s' -> %d", counter_key, _stats_counters[counter_key])


def get_stats() -> Dict[str, int]:
    """Return current statistics counters.

    Returns:
        Dict mapping counter names to their values
    """
    return dict(_stats_counters)


def reset_stats() -> None:
    """Reset all statistics counters to zero."""
    for key in _stats_counters:
        _stats_counters[key] = 0


def register_handlers(event_bus: Any) -> None:
    """Register all default event handlers on the given event bus.

    Args:
        event_bus: An AsyncEventBus instance
    """
    event_bus.subscribe(ENTITY_UPDATED, cache_invalidation_handler)
    event_bus.subscribe(ENTITY_DELETED, cache_invalidation_handler)
    event_bus.subscribe(CACHE_INVALIDATE, cache_invalidation_handler)

    event_bus.subscribe(ENTITY_UPDATED, stats_update_handler)
    event_bus.subscribe(ENTITY_DELETED, stats_update_handler)
    event_bus.subscribe("entity.created", stats_update_handler)
    event_bus.subscribe(CACHE_INVALIDATE, stats_update_handler)

    logger.info("Registered default event handlers")
