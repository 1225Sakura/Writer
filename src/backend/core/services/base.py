# Auto Novel Writer - Generic Base Service
# Provides common CRUD operations with event publishing and cache invalidation

from typing import TypeVar, Generic, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService
from backend.core.repositories.base import SQLAlchemyBaseRepository

T = TypeVar('T')


class BaseService(Generic[T]):
    """Generic base service with event publishing and cache invalidation.

    Subclasses must set:
        _cache_tag: str = "entities"  # plural form, matching cache_service tag_map
        _entity_type: str = "entity"  # singular form, for event payload
    """

    _cache_tag: str = ""
    _entity_type: str = ""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService, model: type):
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyBaseRepository(db, model)

    async def create(self, data: dict) -> T:
        """Create a new entity and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag(self._cache_tag)
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": self._entity_type, "id": instance.id, "data": data},
        )
        return instance

    async def update(self, id: int, data: dict) -> Optional[T]:
        """Update an entity and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag(self._cache_tag)
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": self._entity_type, "id": id, "data": data},
            )
        return instance

    async def get(self, id: int) -> Optional[T]:
        """Get an entity by ID."""
        return await self.repo.get_by_id(id)

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[T]:
        """List all entities with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete(self, id: int) -> bool:
        """Delete an entity and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag(self._cache_tag)
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": self._entity_type, "id": id},
            )
        return deleted

    async def get_by_project(self, project_id: int) -> List[T]:
        """Get all entities belonging to a project."""
        return await self.repo.get_by_project(project_id)
