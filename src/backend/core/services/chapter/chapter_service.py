# Auto Novel Writer - Chapter Service
# Business logic layer for Chapter operations with event publishing

from typing import Optional, List
from datetime import datetime, timezone

from backend.core.services.base import BaseService
from backend.core.domain.entities import Chapter, DraftVersion
from backend.core.repositories.chapter.sqlalchemy_repository import SQLAlchemyChapterRepository


class ChapterService(BaseService[Chapter]):
    """Service for Chapter operations with event publishing."""

    _cache_tag = "chapters"
    _entity_type = "chapter"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, Chapter)
        self.repo = SQLAlchemyChapterRepository(db)

    async def update(self, id: int, data: dict) -> Optional[Chapter]:
        """Update a chapter, automatically setting updated_at."""
        data["updated_at"] = datetime.now(timezone.utc)
        return await super().update(id, data)

    async def list_chapters(
        self, skip: int = 0, limit: int = 100, outline_id: Optional[int] = None, status: Optional[str] = None
    ) -> List[Chapter]:
        """List chapters with optional outline and status filter."""
        if outline_id is not None:
            return await self.repo.get_by_outline(outline_id, skip=skip, limit=limit)
        if status is not None:
            return await self.repo.list(skip=skip, limit=limit, status=status)
        return await self.repo.list(skip=skip, limit=limit)

    async def list_draft_versions(self, chapter_id: int, skip: int = 0, limit: int = 20) -> List[DraftVersion]:
        """List all draft versions for a chapter."""
        return await self.repo.get_draft_versions(chapter_id)

    async def create_draft_version(self, data: dict) -> DraftVersion:
        """Create a new draft version for a chapter."""
        instance = await self.repo.create_draft_version(data)
        await self.cache.ainvalidate_tag("drafts")
        await self.event_bus.publish(
            "entity.created",
            {"entity_type": "draft_version", "id": instance.id},
        )
        return instance

    async def get_draft_version(self, chapter_id: int, version_number: int) -> Optional[DraftVersion]:
        """Get a specific draft version."""
        return await self.repo.get_draft_version(chapter_id, version_number)

    # Backward-compatible aliases
    create_chapter = BaseService.create
    update_chapter = update
    get_chapter = BaseService.get
    delete_chapter = BaseService.delete
