# Auto Novel Writer - BackgroundTask Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of BackgroundTaskRepositoryInterface

from typing import Optional, List
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.background_task.interfaces import BackgroundTaskRepositoryInterface
from backend.core.domain.entities import BackgroundTask


class SQLAlchemyBackgroundTaskRepository(SQLAlchemyBaseRepository[BackgroundTask], BackgroundTaskRepositoryInterface):
    """SQLAlchemy implementation of BackgroundTask repository.

    Overrides get_by_id, update, delete to use str instead of int for primary key.
    """

    def __init__(self, db):
        super().__init__(db, BackgroundTask)

    async def get_by_id(self, id: str) -> Optional[BackgroundTask]:
        result = await self.db.execute(
            select(BackgroundTask).where(BackgroundTask.id == id)
        )
        return result.scalar_one_or_none()

    async def update(self, id: str, data: dict) -> Optional[BackgroundTask]:
        result = await self.db.execute(
            select(BackgroundTask).where(BackgroundTask.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return None
        for key, value in data.items():
            if hasattr(obj, key) and key not in ('id', 'created_at'):
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

    async def get_by_status(self, status: str) -> List[BackgroundTask]:
        result = await self.db.execute(
            select(BackgroundTask).where(BackgroundTask.status == status)
        )
        return list(result.scalars().all())
