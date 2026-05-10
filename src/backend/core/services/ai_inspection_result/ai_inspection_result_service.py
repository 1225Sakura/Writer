# Auto Novel Writer - AIInspectionResult Service
# Business logic layer for AIInspectionResult operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.ai_inspection_result.sqlalchemy_repository import SQLAlchemyAIInspectionResultRepository
from backend.core.domain.entities import AIInspectionResult
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class AIInspectionResultService:
    """Service for AIInspectionResult entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyAIInspectionResultRepository(db)

    async def create_ai_inspection_result(self, data: dict) -> AIInspectionResult:
        """Create a new AI inspection result and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("ai_inspections")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "ai_inspection_result", "id": instance.id, "data": data},
        )
        return instance

    async def update_ai_inspection_result(self, id: int, data: dict) -> Optional[AIInspectionResult]:
        """Update an AI inspection result and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("ai_inspections")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "ai_inspection_result", "id": id, "data": data},
            )
        return instance

    async def get_ai_inspection_result(self, id: int) -> Optional[AIInspectionResult]:
        """Get an AI inspection result by ID."""
        return await self.repo.get_by_id(id)

    async def get_by_chapter(self, chapter_id: int) -> List[AIInspectionResult]:
        """Get all AI inspection results for a chapter."""
        return await self.repo.get_by_chapter(chapter_id)

    async def list_ai_inspection_results(self, skip: int = 0, limit: int = 100, **filters) -> List[AIInspectionResult]:
        """List all AI inspection results with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_ai_inspection_result(self, id: int) -> bool:
        """Delete an AI inspection result and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("ai_inspections")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "ai_inspection_result", "id": id},
            )
        return deleted
