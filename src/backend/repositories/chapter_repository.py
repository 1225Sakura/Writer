# Auto Novel Writer - Chapter Repository
# Chapter-specific queries extending BaseRepository

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from repositories.base import BaseRepository
from core.domain.entities import Chapter, DraftVersion


class ChapterRepository(BaseRepository[Chapter]):
    """Repository for Chapter entity with chapter-specific operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, Chapter)

    async def get_by_outline(
        self, outline_id: int, skip: int = 0, limit: int = 100
    ) -> List[Chapter]:
        """Fetch chapters belonging to a specific outline."""
        stmt = (
            select(Chapter)
            .where(Chapter.outline_id == outline_id)
            .order_by(Chapter.chapter_order)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_draft_versions(self, chapter_id: int) -> List[DraftVersion]:
        """Fetch all draft versions for a given chapter."""
        stmt = (
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .order_by(DraftVersion.version_number.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
