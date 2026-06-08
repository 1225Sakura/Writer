# Auto Novel Writer - Chapter Service
# Business logic layer for Chapter operations with event publishing

from typing import Optional, List
from datetime import datetime, timezone

from backend.core.services.base import BaseService
from backend.core.domain.entities import Chapter, DraftVersion, Snapshot
from backend.core.repositories.chapter.sqlalchemy_repository import SQLAlchemyChapterRepository

# Maximum number of unmarked (auto) snapshots to keep per chapter
MAX_AUTO_SNAPSHOTS = 20


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
        return await self.repo.get_draft_versions(chapter_id, skip=skip, limit=limit)

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

    async def delete_draft_version(self, chapter_id: int, version_number: int) -> bool:
        """Delete a specific draft version."""
        deleted = await self.repo.delete_draft_version(chapter_id, version_number)
        if deleted:
            await self.cache.ainvalidate_tag("drafts")
            await self.event_bus.publish(
                "entity.deleted",
                {"entity_type": "draft_version", "chapter_id": chapter_id, "version_number": version_number},
            )
        return deleted

    async def reorder_chapters(self, outline_id: int, chapter_orders: List[dict]) -> bool:
        """Reorder chapters within an outline."""
        result = await self.repo.reorder_chapters(outline_id, chapter_orders)
        if result:
            await self.cache.ainvalidate_tag("chapters")
            await self.event_bus.publish(
                "chapters.reordered",
                {"outline_id": outline_id, "chapter_orders": chapter_orders},
            )
        return result

    # -- Snapshot operations --

    async def create_snapshot(self, chapter_id: int, data: dict) -> Snapshot:
        """Create a snapshot for a chapter with auto-cleanup of old unmarked snapshots."""
        # Determine next version number
        existing = await self.repo.get_snapshots(chapter_id, limit=1)
        next_version = (existing[0].version_number + 1) if existing else 1

        data["chapter_id"] = chapter_id
        data["version_number"] = next_version

        # Auto-cleanup: if this is an unmarked snapshot, enforce the limit
        if not data.get("is_marked", False):
            unmarked_count = await self.repo.count_unmarked_snapshots(chapter_id)
            if unmarked_count >= MAX_AUTO_SNAPSHOTS:
                await self.repo.delete_oldest_unmarked_snapshot(chapter_id)

        instance = await self.repo.create_snapshot(data)
        await self.cache.ainvalidate_tag("snapshots")
        await self.event_bus.publish(
            "entity.created",
            {"entity_type": "snapshot", "id": instance.id},
        )
        return instance

    async def list_snapshots(self, chapter_id: int, skip: int = 0, limit: int = 100) -> List[Snapshot]:
        """List all snapshots for a chapter, newest first."""
        return await self.repo.get_snapshots(chapter_id, skip=skip, limit=limit)

    async def get_snapshot(self, snapshot_id: int) -> Optional[Snapshot]:
        """Get a snapshot by ID."""
        return await self.repo.get_snapshot(snapshot_id)

    async def delete_snapshot(self, snapshot_id: int) -> bool:
        """Delete a snapshot."""
        deleted = await self.repo.delete_snapshot(snapshot_id)
        if deleted:
            await self.cache.ainvalidate_tag("snapshots")
            await self.event_bus.publish(
                "entity.deleted",
                {"entity_type": "snapshot", "id": snapshot_id},
            )
        return deleted

    async def mark_snapshot(self, snapshot_id: int, is_marked: bool) -> Optional[Snapshot]:
        """Mark or unmark a snapshot."""
        instance = await self.repo.update(snapshot_id, {"is_marked": is_marked})
        if instance:
            await self.cache.ainvalidate_tag("snapshots")
            await self.event_bus.publish(
                "entity.updated",
                {"entity_type": "snapshot", "id": snapshot_id, "data": {"is_marked": is_marked}},
            )
        return instance

    # Backward-compatible aliases
    create_chapter = BaseService.create
    update_chapter = update
    get_chapter = BaseService.get
    delete_chapter = BaseService.delete
