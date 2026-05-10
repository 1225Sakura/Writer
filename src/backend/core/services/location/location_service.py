# Auto Novel Writer - Location Service
# Business logic layer for Location operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.location.sqlalchemy_repository import SQLAlchemyLocationRepository
from backend.core.domain.entities import Location
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class LocationService:
    """Service for Location entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyLocationRepository(db)

    async def create_location(self, data: dict) -> Location:
        """Create a new location and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("locations")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "location", "id": instance.id, "data": data},
        )
        return instance

    async def update_location(self, id: int, data: dict) -> Optional[Location]:
        """Update a location and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("locations")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "location", "id": id, "data": data},
            )
        return instance

    async def get_location(self, id: int) -> Optional[Location]:
        """Get a location by ID."""
        return await self.repo.get_by_id(id)

    async def list_locations(self, skip: int = 0, limit: int = 100, **filters) -> List[Location]:
        """List all locations with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_location(self, id: int) -> bool:
        """Delete a location and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("locations")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "location", "id": id},
            )
        return deleted
