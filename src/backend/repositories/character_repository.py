# Auto Novel Writer - Character Repository
# Character-specific queries extending BaseRepository

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from repositories.base import BaseRepository
from core.domain.entities import Character, CharacterRelationship, CharacterStoryline


class CharacterRepository(BaseRepository[Character]):
    """Repository for Character entity with character-specific operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, Character)

    async def get_by_tier(self, tier: str, skip: int = 0, limit: int = 100) -> List[Character]:
        """Fetch characters filtered by cultivation tier."""
        stmt = (
            select(Character)
            .where(Character.tier == tier)
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_relationships(self, character_id: int) -> List[CharacterRelationship]:
        """Fetch all relationships for a given character."""
        stmt = (
            select(CharacterRelationship)
            .where(CharacterRelationship.character_id == character_id)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_storylines(self, character_id: int) -> List[CharacterStoryline]:
        """Fetch all storylines for a given character."""
        stmt = (
            select(CharacterStoryline)
            .where(CharacterStoryline.character_id == character_id)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
