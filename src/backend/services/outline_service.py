# Auto Novel Writer - Outline Service
# Business logic layer for Outline operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from repositories.outline_repository import OutlineRepository
from models.entities import Outline
from utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from services.cache_service import cache_service


class OutlineService:
    """Service for Outline entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus) -> None:
        self.db = db
        self.event_bus = event_bus
        self.repo = OutlineRepository(db)

    async def create_outline(self, data: dict) -> Outline:
        """Create a new outline and publish creation event."""
        outline = await self.repo.create(data)
        await cache_service.ainvalidate_tag("outlines")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "outline", "id": outline.id, "data": data},
        )
        return outline

    async def update_outline(self, id: int, data: dict) -> Optional[Outline]:
        """Update an outline and publish update event."""
        outline = await self.repo.update(id, data)
        if outline:
            await cache_service.ainvalidate_tag("outlines")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "outline", "id": id, "data": data},
            )
        return outline

    async def get_outline(self, id: int) -> Optional[Outline]:
        """Get an outline by ID."""
        return await self.repo.get_by_id(id)

    async def get_outline_with_chapters(self, id: int) -> Optional[Outline]:
        """Get an outline with its chapters eagerly loaded."""
        return await self.repo.get_with_chapters(id)

    async def list_outlines(
        self, skip: int = 0, limit: int = 50
    ) -> List[Outline]:
        """List all outlines with pagination."""
        return await self.repo.list(skip=skip, limit=limit)

    async def delete_outline(self, id: int) -> bool:
        """Delete an outline and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await cache_service.ainvalidate_tag("outlines")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "outline", "id": id},
            )
        return deleted
