# Auto Novel Writer - WritingSettings Service
# Business logic layer for WritingSettings operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.writing_settings.sqlalchemy_repository import SQLAlchemyWritingSettingsRepository
from backend.core.domain.entities import WritingSettings
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class WritingSettingsService:
    """Service for WritingSettings entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyWritingSettingsRepository(db)

    async def create_writing_settings(self, data: dict) -> WritingSettings:
        """Create a new writing settings and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("writing_settings")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "writing_settings", "id": instance.id, "data": data},
        )
        return instance

    async def update_writing_settings(self, id: int, data: dict) -> Optional[WritingSettings]:
        """Update a writing settings and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("writing_settings")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "writing_settings", "id": id, "data": data},
            )
        return instance

    async def get_writing_settings(self, id: int) -> Optional[WritingSettings]:
        """Get a writing settings by ID."""
        return await self.repo.get_by_id(id)

    async def list_writing_settings(self, skip: int = 0, limit: int = 100, **filters) -> List[WritingSettings]:
        """List all writing settings with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_writing_settings(self, id: int) -> bool:
        """Delete a writing settings and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("writing_settings")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "writing_settings", "id": id},
            )
        return deleted
