# Auto Novel Writer - Rule Repository
# Rule-specific queries extending BaseRepository

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from repositories.base import BaseRepository
from core.domain.entities import Rule


class RuleRepository(BaseRepository[Rule]):
    """Repository for Rule entity with rule-specific operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, Rule)

    async def get_by_type(
        self, type: str, skip: int = 0, limit: int = 100
    ) -> List[Rule]:
        """Fetch rules filtered by type."""
        stmt = (
            select(Rule)
            .where(Rule.type == type)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
