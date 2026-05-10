# Auto Novel Writer - IFLine Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of IFLineRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.if_line.interfaces import IFLineRepositoryInterface
from backend.core.domain.entities import IFLine


class SQLAlchemyIFLineRepository(IFLineRepositoryInterface):
    """SQLAlchemy implementation of IFLine repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[IFLine]:
        result = await self.db.execute(
            select(IFLine).where(IFLine.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: int) -> List[IFLine]:
        result = await self.db.execute(
            select(IFLine).where(IFLine.project_id == project_id)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> IFLine:
        instance = IFLine(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[IFLine]:
        result = await self.db.execute(
            select(IFLine).where(IFLine.id == id)
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
            select(IFLine).where(IFLine.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[IFLine]:
        stmt = select(IFLine)
        for column, value in filters.items():
            if hasattr(IFLine, column) and value is not None:
                stmt = stmt.where(getattr(IFLine, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
