# Auto Novel Writer - PlotThread Service
# Business logic layer for PlotThread operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.plot_thread.sqlalchemy_repository import SQLAlchemyPlotThreadRepository
from backend.core.domain.entities import PlotThread
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class PlotThreadService:
    """Service for PlotThread entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyPlotThreadRepository(db)

    async def create_plot_thread(self, data: dict) -> PlotThread:
        """Create a new plot thread and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("plot_threads")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "plot_thread", "id": instance.id, "data": data},
        )
        return instance

    async def update_plot_thread(self, id: int, data: dict) -> Optional[PlotThread]:
        """Update a plot thread and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("plot_threads")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "plot_thread", "id": id, "data": data},
            )
        return instance

    async def get_plot_thread(self, id: int) -> Optional[PlotThread]:
        """Get a plot thread by ID."""
        return await self.repo.get_by_id(id)

    async def list_plot_threads(self, skip: int = 0, limit: int = 100, **filters) -> List[PlotThread]:
        """List all plot threads with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_plot_thread(self, id: int) -> bool:
        """Delete a plot thread and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("plot_threads")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "plot_thread", "id": id},
            )
        return deleted
