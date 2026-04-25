# Auto Novel Writer - Location Repository
# Location-specific queries extending BaseRepository

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from repositories.base import BaseRepository
from core.domain.entities import Location


class LocationRepository(BaseRepository[Location]):
    """Repository for Location entity with location-specific operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, Location)

    async def get_by_importance(
        self, importance: str, skip: int = 0, limit: int = 100
    ) -> List[Location]:
        """Fetch locations filtered by importance level."""
        stmt = (
            select(Location)
            .where(Location.importance == importance)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
