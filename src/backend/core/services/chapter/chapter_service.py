# Auto Novel Writer - Chapter Service
# Business logic layer for Chapter operations with event publishing

from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from repositories.chapter_repository import ChapterRepository
from core.domain.entities import Chapter, DraftVersion
from utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.services.cache_service import CacheService, get_cache_service


class ChapterService:
    """Service for Chapter entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = ChapterRepository(db)

    async def create_chapter(self, data: dict) -> Chapter:
        """Create a new chapter and publish creation event."""
        chapter = await self.repo.create(data)
        await self.cache.ainvalidate_tag("chapters")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "chapter", "id": chapter.id, "data": data},
        )
        return chapter

    async def update_chapter(self, id: int, data: dict) -> Optional[Chapter]:
        """Update a chapter and publish update event."""
        data["updated_at"] = datetime.utcnow()
        chapter = await self.repo.update(id, data)
        if chapter:
            await self.cache.ainvalidate_tag("chapters")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "chapter", "id": id, "data": data},
            )
        return chapter

    async def get_chapter(self, id: int) -> Optional[Chapter]:
        """Get a chapter by ID."""
        return await self.repo.get_by_id(id)

    async def list_chapters(
        self, skip: int = 0, limit: int = 100, outline_id: Optional[int] = None, status: Optional[str] = None
    ) -> List[Chapter]:
        """List chapters with optional outline and status filter."""
        if outline_id is not None:
            return await self.repo.get_by_outline(outline_id, skip=skip, limit=limit)
        if status is not None:
            return await self.repo.list(skip=skip, limit=limit, status=status)
        return await self.repo.list(skip=skip, limit=limit)

    async def delete_chapter(self, id: int) -> bool:
        """Delete a chapter and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("chapters")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "chapter", "id": id},
            )
        return deleted

    async def list_draft_versions(self, chapter_id: int, skip: int = 0, limit: int = 20) -> List[DraftVersion]:
        """List all draft versions for a chapter."""
        return await self.repo.get_draft_versions(chapter_id)

    async def create_draft_version(self, data: dict) -> DraftVersion:
        """Create a new draft version for a chapter."""
        instance = DraftVersion(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        await self.cache.ainvalidate_tag("drafts")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "draft_version", "id": instance.id},
        )
        return instance

    async def get_draft_version(self, chapter_id: int, version_number: int) -> Optional[DraftVersion]:
        """Get a specific draft version."""
        stmt = (
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .where(DraftVersion.version_number == version_number)
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
