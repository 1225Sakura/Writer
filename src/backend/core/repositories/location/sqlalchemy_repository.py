# Auto Novel Writer - Location Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of LocationRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.location.interfaces import LocationRepositoryInterface
from backend.core.domain.entities import Location


class SQLAlchemyLocationRepository(LocationRepositoryInterface):
    """SQLAlchemy implementation of Location repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[Location]:
        result = await self.db.execute(
            select(Location).where(Location.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: int) -> List[Location]:
        result = await self.db.execute(
            select(Location).where(Location.project_id == project_id)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> Location:
        instance = Location(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[Location]:
        result = await self.db.execute(
            select(Location).where(Location.id == id)
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
            select(Location).where(Location.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Location]:
        stmt = select(Location)
        for column, value in filters.items():
            if hasattr(Location, column) and value is not None:
                stmt = stmt.where(getattr(Location, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
