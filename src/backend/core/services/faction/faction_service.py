# Auto Novel Writer - Faction Service
# Business logic layer for Faction operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.faction.sqlalchemy_repository import SQLAlchemyFactionRepository
from backend.core.domain.entities import Faction
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class FactionService:
    """Service for Faction entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyFactionRepository(db)

    async def create_faction(self, data: dict) -> Faction:
        """Create a new faction and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("factions")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "faction", "id": instance.id, "data": data},
        )
        return instance

    async def update_faction(self, id: int, data: dict) -> Optional[Faction]:
        """Update a faction and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("factions")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "faction", "id": id, "data": data},
            )
        return instance

    async def get_faction(self, id: int) -> Optional[Faction]:
        """Get a faction by ID."""
        return await self.repo.get_by_id(id)

    async def list_factions(self, skip: int = 0, limit: int = 100, **filters) -> List[Faction]:
        """List all factions with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_faction(self, id: int) -> bool:
        """Delete a faction and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("factions")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "faction", "id": id},
            )
        return deleted
