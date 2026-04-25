# Auto Novel Writer - Item Repository
# Item-specific queries extending BaseRepository

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from repositories.base import BaseRepository
from core.domain.entities import Item


class ItemRepository(BaseRepository[Item]):
    """Repository for Item entity with item-specific operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, Item)

    async def get_by_owner(self, owner: str, skip: int = 0, limit: int = 100) -> List[Item]:
        """Fetch items filtered by owner."""
        stmt = (
            select(Item)
            .where(Item.owner == owner)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
