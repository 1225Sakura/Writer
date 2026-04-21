# Event Bus - Async event publishing/subscription system
# Provides decoupled communication between backend components

import asyncio
import logging
from collections import defaultdict
from typing import Any, Callable, Dict, List

logger = logging.getLogger(__name__)

# Pre-defined event types
ENTITY_CREATED = "entity.created"
ENTITY_UPDATED = "entity.updated"
ENTITY_DELETED = "entity.deleted"
CACHE_INVALIDATE = "cache.invalidate"


class AsyncEventBus:
    """Async event bus for decoupled component communication.

    Supports subscribing handlers to event types and publishing events
    asynchronously to all registered handlers.
    """

    def __init__(self) -> None:
        self._handlers: Dict[str, List[Callable]] = defaultdict(list)
        self._lock = asyncio.Lock()

    def subscribe(self, event_type: str, handler: Callable) -> None:
        """Subscribe a handler to an event type.

        Args:
            event_type: The event type to listen for
            handler: Callable to invoke when the event is published.
                     May be sync or async; async handlers are awaited.
        """
        self._handlers[event_type].append(handler)
        logger.debug("Subscribed handler to event: %s", event_type)

    def unsubscribe(self, event_type: str, handler: Callable) -> bool:
        """Unsubscribe a handler from an event type.

        Args:
            event_type: The event type to unsubscribe from
            handler: The handler to remove

        Returns:
            True if handler was found and removed, False otherwise
        """
        handlers = self._handlers.get(event_type, [])
        if handler in handlers:
            handlers.remove(handler)
            logger.debug("Unsubscribed handler from event: %s", event_type)
            return True
        return False

    async def publish(self, event_type: str, payload: Dict[str, Any]) -> None:
        """Publish an event to all subscribed handlers.

        Args:
            event_type: The event type to publish
            payload: Event data dictionary passed to each handler
        """
        handlers = self._handlers.get(event_type, [])
        if not handlers:
            return

        tasks = []
        for handler in handlers:
            try:
                if asyncio.iscoroutinefunction(handler):
                    tasks.append(asyncio.create_task(handler(payload)))
                else:
                    # Run sync handlers in thread pool to avoid blocking
                    loop = asyncio.get_running_loop()
                    future = loop.run_in_executor(None, handler, payload)
                    tasks.append(asyncio.ensure_future(future))
            except Exception:
                logger.exception("Failed to schedule handler for event: %s", event_type)

        if tasks:
            results = await asyncio.gather(*tasks, return_exceptions=True)
            for i, result in enumerate(results):
                if isinstance(result, Exception):
                    logger.error(
                        "Handler %s failed for event %s: %s",
                        handlers[i].__name__,
                        event_type,
                        result,
                    )

    def get_subscribers(self, event_type: str) -> List[Callable]:
        """Get all handlers subscribed to an event type.

        Args:
            event_type: The event type to query

        Returns:
            List of subscribed handlers
        """
        return list(self._handlers.get(event_type, []))

    def list_event_types(self) -> List[str]:
        """List all event types that have at least one subscriber.

        Returns:
            List of event type strings
        """
        return [et for et, handlers in self._handlers.items() if handlers]
