# Auto Novel Writer - Item Service
# Business logic layer for Item operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.item.sqlalchemy_repository import SQLAlchemyItemRepository
from backend.core.domain.entities import Item
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class ItemService:
    """Service for Item entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyItemRepository(db)

    async def create_item(self, data: dict) -> Item:
        """Create a new item and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("items")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "item", "id": instance.id, "data": data},
        )
        return instance

    async def update_item(self, id: int, data: dict) -> Optional[Item]:
        """Update an item and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("items")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "item", "id": id, "data": data},
            )
        return instance

    async def get_item(self, id: int) -> Optional[Item]:
        """Get an item by ID."""
        return await self.repo.get_by_id(id)

    async def list_items(self, skip: int = 0, limit: int = 100, **filters) -> List[Item]:
        """List all items with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_item(self, id: int) -> bool:
        """Delete an item and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("items")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "item", "id": id},
            )
        return deleted
