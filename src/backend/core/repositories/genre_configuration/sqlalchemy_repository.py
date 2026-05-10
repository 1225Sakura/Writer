# Auto Novel Writer - GenreConfiguration Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of GenreConfigurationRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.genre_configuration.interfaces import GenreConfigurationRepositoryInterface
from backend.core.domain.entities import GenreConfiguration


class SQLAlchemyGenreConfigurationRepository(GenreConfigurationRepositoryInterface):
    """SQLAlchemy implementation of GenreConfiguration repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[GenreConfiguration]:
        result = await self.db.execute(
            select(GenreConfiguration).where(GenreConfiguration.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: int) -> List[GenreConfiguration]:
        result = await self.db.execute(
            select(GenreConfiguration).where(GenreConfiguration.project_id == project_id)
        )
        return list(result.scalars().all())

    async def get_by_genre(self, genre: str) -> Optional[GenreConfiguration]:
        result = await self.db.execute(
            select(GenreConfiguration).where(GenreConfiguration.genre == genre)
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> GenreConfiguration:
        instance = GenreConfiguration(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[GenreConfiguration]:
        result = await self.db.execute(
            select(GenreConfiguration).where(GenreConfiguration.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return None
        for key, value in data.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(
            select(GenreConfiguration).where(GenreConfiguration.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[GenreConfiguration]:
        stmt = select(GenreConfiguration)
        for column, value in filters.items():
            if hasattr(GenreConfiguration, column) and value is not None:
                stmt = stmt.where(getattr(GenreConfiguration, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
