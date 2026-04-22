# Auto Novel Writer - Character Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of CharacterRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.repositories.character.interfaces import CharacterRepositoryInterface
from core.domain.entities import Character, CharacterRelationship, CharacterStoryline


class SQLAlchemyCharacterRepository(CharacterRepositoryInterface):
    """SQLAlchemy implementation of Character repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[Character]:
        result = await self.db.execute(
            select(Character).where(Character.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: int) -> List[Character]:
        result = await self.db.execute(
            select(Character).where(Character.project_id == project_id)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> Character:
        instance = Character(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[Character]:
        result = await self.db.execute(
            select(Character).where(Character.id == id)
        )
        character = result.scalar_one_or_none()
        if character is None:
            return None
        for key, value in data.items():
            setattr(character, key, value)
        await self.db.flush()
        await self.db.refresh(character)
        return character

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(
            select(Character).where(Character.id == id)
        )
        character = result.scalar_one_or_none()
        if character is None:
            return False
        await self.db.delete(character)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Character]:
        stmt = select(Character)
        for column, value in filters.items():
            if hasattr(Character, column) and value is not None:
                stmt = stmt.where(getattr(Character, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

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