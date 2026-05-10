# Auto Novel Writer - Project Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of ProjectRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.project.interfaces import ProjectRepositoryInterface
from backend.core.domain.entities import Project


class SQLAlchemyProjectRepository(ProjectRepositoryInterface):
    """SQLAlchemy implementation of Project repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[Project]:
        result = await self.db.execute(
            select(Project).where(Project.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_name(self, name: str) -> Optional[Project]:
        result = await self.db.execute(
            select(Project).where(Project.name == name)
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> Project:
        instance = Project(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[Project]:
        result = await self.db.execute(
            select(Project).where(Project.id == id)
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
            select(Project).where(Project.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Project]:
        stmt = select(Project)
        for column, value in filters.items():
            if hasattr(Project, column) and value is not None:
                stmt = stmt.where(getattr(Project, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
