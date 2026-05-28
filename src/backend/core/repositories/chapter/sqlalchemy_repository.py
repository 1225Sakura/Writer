# Auto Novel Writer - Chapter Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of ChapterRepositoryInterface

from typing import Optional, List
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.chapter.interfaces import ChapterRepositoryInterface
from backend.core.domain.entities import Chapter, DraftVersion


class SQLAlchemyChapterRepository(SQLAlchemyBaseRepository[Chapter], ChapterRepositoryInterface):
    """SQLAlchemy implementation of Chapter repository."""

    def __init__(self, db):
        super().__init__(db, Chapter)

    async def get_by_outline(self, outline_id: int, skip: int = 0, limit: int = 100) -> List[Chapter]:
        result = await self.db.execute(
            select(Chapter)
            .where(Chapter.outline_id == outline_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_draft_versions(self, chapter_id: int) -> List[DraftVersion]:
        result = await self.db.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
        )
        return list(result.scalars().all())

    async def create_draft_version(self, data: dict) -> DraftVersion:
        instance = DraftVersion(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def get_draft_version(self, chapter_id: int, version_number: int) -> Optional[DraftVersion]:
        result = await self.db.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .where(DraftVersion.version_number == version_number)
        )
        return result.scalar_one_or_none()

    async def delete_draft_version(self, chapter_id: int, version_number: int) -> bool:
        draft = await self.get_draft_version(chapter_id, version_number)
        if draft is None:
            return False
        await self.db.delete(draft)
        await self.db.flush()
        return True

    async def get_chapters_with_word_count(self, min_word_count: int, project_id: Optional[int] = None) -> List[Chapter]:
        stmt = select(Chapter).where(Chapter.word_count >= min_word_count)
        if project_id is not None:
            stmt = stmt.where(Chapter.project_id == project_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def reorder_chapters(self, outline_id: int, chapter_orders: List[dict]) -> bool:
        chapters = await self.get_by_outline(outline_id)
        chapter_map = {c.id: c for c in chapters}
        for entry in chapter_orders:
            ch = chapter_map.get(entry["id"])
            if ch:
                ch.chapter_order = entry["chapter_order"]
        await self.db.flush()
        return True
