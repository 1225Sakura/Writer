"""Shared FastAPI dependencies for API v1 endpoints."""

from typing import Optional

from backend.utils.event_bus import AsyncEventBus

_event_bus: Optional[AsyncEventBus] = None


def get_event_bus() -> AsyncEventBus:
    """Get or create the shared AsyncEventBus singleton."""
    global _event_bus
    if _event_bus is None:
        _event_bus = AsyncEventBus()
    return _event_bus
