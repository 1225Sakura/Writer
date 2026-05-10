# Auto Novel Writer - BackgroundTask Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of BackgroundTaskRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.background_task.interfaces import BackgroundTaskRepositoryInterface
from backend.core.domain.entities import BackgroundTask


class SQLAlchemyBackgroundTaskRepository(BackgroundTaskRepositoryInterface):
    """SQLAlchemy implementation of BackgroundTask repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: str) -> Optional[BackgroundTask]:
        result = await self.db.execute(
            select(BackgroundTask).where(BackgroundTask.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: int) -> List[BackgroundTask]:
        result = await self.db.execute(
            select(BackgroundTask).where(BackgroundTask.project_id == project_id)
        )
        return list(result.scalars().all())

    async def get_by_status(self, status: str) -> List[BackgroundTask]:
        result = await self.db.execute(
            select(BackgroundTask).where(BackgroundTask.status == status)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> BackgroundTask:
        instance = BackgroundTask(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: str, data: dict) -> Optional[BackgroundTask]:
        result = await self.db.execute(
            select(BackgroundTask).where(BackgroundTask.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return None
        for key, value in data.items():
            setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete(self, id: str) -> bool:
        result = await self.db.execute(
            select(BackgroundTask).where(BackgroundTask.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[BackgroundTask]:
        stmt = select(BackgroundTask)
        for column, value in filters.items():
            if hasattr(BackgroundTask, column) and value is not None:
                stmt = stmt.where(getattr(BackgroundTask, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
