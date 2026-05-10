# Auto Novel Writer - WorldSetting Service
# Business logic layer for WorldSetting operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.world_setting.sqlalchemy_repository import SQLAlchemyWorldSettingRepository
from backend.core.domain.entities import WorldSetting
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class WorldSettingService:
    """Service for WorldSetting entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyWorldSettingRepository(db)

    async def create_world_setting(self, data: dict) -> WorldSetting:
        """Create a new world setting and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("world_settings")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "world_setting", "id": instance.id, "data": data},
        )
        return instance

    async def update_world_setting(self, id: int, data: dict) -> Optional[WorldSetting]:
        """Update a world setting and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("world_settings")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "world_setting", "id": id, "data": data},
            )
        return instance

    async def get_world_setting(self, id: int) -> Optional[WorldSetting]:
        """Get a world setting by ID."""
        return await self.repo.get_by_id(id)

    async def list_world_settings(self, skip: int = 0, limit: int = 100, **filters) -> List[WorldSetting]:
        """List all world settings with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_world_setting(self, id: int) -> bool:
        """Delete a world setting and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("world_settings")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "world_setting", "id": id},
            )
        return deleted
