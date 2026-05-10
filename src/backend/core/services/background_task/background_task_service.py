# Auto Novel Writer - BackgroundTask Service
# Business logic layer for BackgroundTask operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.background_task.sqlalchemy_repository import SQLAlchemyBackgroundTaskRepository
from backend.core.domain.entities import BackgroundTask
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class BackgroundTaskService:
    """Service for BackgroundTask entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyBackgroundTaskRepository(db)

    async def create_background_task(self, data: dict) -> BackgroundTask:
        """Create a new background task and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("background_tasks")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "background_task", "id": instance.id, "data": data},
        )
        return instance

    async def update_background_task(self, id: int, data: dict) -> Optional[BackgroundTask]:
        """Update a background task and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("background_tasks")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "background_task", "id": id, "data": data},
            )
        return instance

    async def get_background_task(self, id: str) -> Optional[BackgroundTask]:
        """Get a background task by ID."""
        return await self.repo.get_by_id(id)

    async def get_by_status(self, status: str) -> List[BackgroundTask]:
        """Get background tasks by status."""
        return await self.repo.get_by_status(status)

    async def list_background_tasks(self, skip: int = 0, limit: int = 100, **filters) -> List[BackgroundTask]:
        """List all background tasks with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_background_task(self, id: str) -> bool:
        """Delete a background task and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("background_tasks")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "background_task", "id": id},
            )
        return deleted
