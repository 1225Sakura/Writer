# Auto Novel Writer - IFLine Service
# Business logic layer for IFLine operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.if_line.sqlalchemy_repository import SQLAlchemyIFLineRepository
from backend.core.domain.entities import IFLine
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class IFLineService:
    """Service for IFLine entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyIFLineRepository(db)

    async def create_if_line(self, data: dict) -> IFLine:
        """Create a new IF line and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("if_lines")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "if_line", "id": instance.id, "data": data},
        )
        return instance

    async def update_if_line(self, id: int, data: dict) -> Optional[IFLine]:
        """Update an IF line and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("if_lines")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "if_line", "id": id, "data": data},
            )
        return instance

    async def get_if_line(self, id: int) -> Optional[IFLine]:
        """Get an IF line by ID."""
        return await self.repo.get_by_id(id)

    async def list_if_lines(self, skip: int = 0, limit: int = 100, **filters) -> List[IFLine]:
        """List all IF lines with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_if_line(self, id: int) -> bool:
        """Delete an IF line and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("if_lines")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "if_line", "id": id},
            )
        return deleted
