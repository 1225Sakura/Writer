# Auto Novel Writer - Outline Repository
# Outline-specific queries extending BaseRepository

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from repositories.base import BaseRepository
from models.entities import Outline


class OutlineRepository(BaseRepository[Outline]):
    """Repository for Outline entity with outline-specific operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, Outline)

    async def get_with_chapters(self, outline_id: int) -> Optional[Outline]:
        """Fetch an outline eagerly loading its associated chapters."""
        stmt = (
            select(Outline)
            .where(Outline.id == outline_id)
            .options(selectinload(Outline.chapters))
        )
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()
