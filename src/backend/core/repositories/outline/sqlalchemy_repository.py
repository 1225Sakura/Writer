# Auto Novel Writer - Outline Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of OutlineRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.core.repositories.outline.interfaces import OutlineRepositoryInterface
from backend.core.domain.entities import Outline


class SQLAlchemyOutlineRepository(OutlineRepositoryInterface):
    """SQLAlchemy implementation of Outline repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[Outline]:
        result = await self.db.execute(
            select(Outline).where(Outline.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: int) -> List[Outline]:
        result = await self.db.execute(
            select(Outline).where(Outline.project_id == project_id)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> Outline:
        instance = Outline(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[Outline]:
        result = await self.db.execute(
            select(Outline).where(Outline.id == id)
        )
        outline = result.scalar_one_or_none()
        if outline is None:
            return None
        for key, value in data.items():
            setattr(outline, key, value)
        await self.db.flush()
        await self.db.refresh(outline)
        return outline

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(
            select(Outline).where(Outline.id == id)
        )
        outline = result.scalar_one_or_none()
        if outline is None:
            return False
        await self.db.delete(outline)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Outline]:
        stmt = select(Outline)
        for column, value in filters.items():
            if hasattr(Outline, column) and value is not None:
                stmt = stmt.where(getattr(Outline, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_with_chapters(self, id: int) -> Optional[Outline]:
        result = await self.db.execute(
            select(Outline)
            .where(Outline.id == id)
            .options(selectinload(Outline.chapters))
        )
        return result.scalar_one_or_none()
