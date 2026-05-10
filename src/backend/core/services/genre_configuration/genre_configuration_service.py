# Auto Novel Writer - GenreConfiguration Service
# Business logic layer for GenreConfiguration operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.genre_configuration.sqlalchemy_repository import SQLAlchemyGenreConfigurationRepository
from backend.core.domain.entities import GenreConfiguration
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class GenreConfigurationService:
    """Service for GenreConfiguration entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyGenreConfigurationRepository(db)

    async def create_genre_configuration(self, data: dict) -> GenreConfiguration:
        """Create a new genre configuration and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("genre_configurations")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "genre_configuration", "id": instance.id, "data": data},
        )
        return instance

    async def update_genre_configuration(self, id: int, data: dict) -> Optional[GenreConfiguration]:
        """Update a genre configuration and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("genre_configurations")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "genre_configuration", "id": id, "data": data},
            )
        return instance

    async def get_genre_configuration(self, id: int) -> Optional[GenreConfiguration]:
        """Get a genre configuration by ID."""
        return await self.repo.get_by_id(id)

    async def get_by_genre(self, genre: str) -> Optional[GenreConfiguration]:
        """Get a genre configuration by genre name."""
        return await self.repo.get_by_genre(genre)

    async def list_genre_configurations(self, skip: int = 0, limit: int = 100, **filters) -> List[GenreConfiguration]:
        """List all genre configurations with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_genre_configuration(self, id: int) -> bool:
        """Delete a genre configuration and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("genre_configurations")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "genre_configuration", "id": id},
            )
        return deleted
