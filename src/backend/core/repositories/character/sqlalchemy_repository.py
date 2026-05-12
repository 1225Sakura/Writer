# Auto Novel Writer - Character Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of CharacterRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.character.interfaces import CharacterRepositoryInterface
from backend.core.domain.entities import Character, CharacterRelationship, CharacterStoryline


class SQLAlchemyCharacterRepository(SQLAlchemyBaseRepository[Character], CharacterRepositoryInterface):
    """SQLAlchemy implementation of Character repository."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, Character)

    async def get_by_tier(self, tier: str, skip: int = 0, limit: int = 100) -> List[Character]:
        result = await self.db.execute(
            select(Character)
            .where(Character.tier == tier)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_relationships(self, character_id: int) -> List[CharacterRelationship]:
        result = await self.db.execute(
            select(CharacterRelationship)
            .where(CharacterRelationship.character_id == character_id)
        )
        return list(result.scalars().all())

    async def get_storylines(self, character_id: int) -> List[CharacterStoryline]:
        result = await self.db.execute(
            select(CharacterStoryline)
            .where(CharacterStoryline.character_id == character_id)
        )
        return list(result.scalars().all())

    async def create_relationship(self, data: dict) -> CharacterRelationship:
        instance = CharacterRelationship(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def delete_relationship(self, character_id: int, relationship_id: int) -> bool:
        result = await self.db.execute(
            select(CharacterRelationship).where(
                CharacterRelationship.id == relationship_id,
                CharacterRelationship.character_id == character_id,
            )
        )
        relationship = result.scalar_one_or_none()
        if not relationship:
            return False
        await self.db.delete(relationship)
        await self.db.flush()
        return True

    async def create_storyline(self, data: dict) -> CharacterStoryline:
        instance = CharacterStoryline(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update_storyline(self, character_id: int, storyline_id: int, data: dict) -> Optional[CharacterStoryline]:
        result = await self.db.execute(
            select(CharacterStoryline).where(
                CharacterStoryline.id == storyline_id,
                CharacterStoryline.character_id == character_id,
            )
        )
        storyline = result.scalar_one_or_none()
        if not storyline:
            return None
        for key, value in data.items():
            if hasattr(storyline, key) and key not in ('id', 'created_at'):
                setattr(storyline, key, value)
        await self.db.flush()
        await self.db.refresh(storyline)
        return storyline

    async def delete_storyline(self, character_id: int, storyline_id: int) -> bool:
        result = await self.db.execute(
            select(CharacterStoryline).where(
                CharacterStoryline.id == storyline_id,
                CharacterStoryline.character_id == character_id,
            )
        )
        storyline = result.scalar_one_or_none()
        if not storyline:
            return False
        await self.db.delete(storyline)
        await self.db.flush()
        return True

    async def list_all_relationships(self) -> List[CharacterRelationship]:
        result = await self.db.execute(select(CharacterRelationship))
        return list(result.scalars().all())

    async def list_all_storylines(self) -> List[CharacterStoryline]:
        result = await self.db.execute(select(CharacterStoryline))
        return list(result.scalars().all())
