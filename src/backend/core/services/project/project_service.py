# Auto Novel Writer - Project Service
# Business logic layer for Project operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.project.sqlalchemy_repository import SQLAlchemyProjectRepository
from backend.core.domain.entities import Project
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class ProjectService:
    """Service for Project entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyProjectRepository(db)

    async def create_project(self, data: dict) -> Project:
        """Create a new project and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("projects")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "project", "id": instance.id, "data": data},
        )
        return instance

    async def update_project(self, id: int, data: dict) -> Optional[Project]:
        """Update a project and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("projects")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "project", "id": id, "data": data},
            )
        return instance

    async def get_project(self, id: int) -> Optional[Project]:
        """Get a project by ID."""
        return await self.repo.get_by_id(id)

    async def list_projects(self, skip: int = 0, limit: int = 100, **filters) -> List[Project]:
        """List all projects with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_project(self, id: int) -> bool:
        """Delete a project and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("projects")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "project", "id": id},
            )
        return deleted
