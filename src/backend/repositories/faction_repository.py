# Auto Novel Writer - Faction Repository
# Faction-specific queries extending BaseRepository

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from repositories.base import BaseRepository
from core.domain.entities import Faction


class FactionRepository(BaseRepository[Faction]):
    """Repository for Faction entity with faction-specific operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, Faction)

    async def get_by_type(
        self, type: str, skip: int = 0, limit: int = 100
    ) -> List[Faction]:
        """Fetch factions filtered by type."""
        stmt = (
            select(Faction)
            .where(Faction.type == type)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
