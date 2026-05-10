# Auto Novel Writer - WritingSettings Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of WritingSettingsRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.writing_settings.interfaces import WritingSettingsRepositoryInterface
from backend.core.domain.entities import WritingSettings


class SQLAlchemyWritingSettingsRepository(WritingSettingsRepositoryInterface):
    """SQLAlchemy implementation of WritingSettings repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[WritingSettings]:
        result = await self.db.execute(
            select(WritingSettings).where(WritingSettings.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: int) -> List[WritingSettings]:
        result = await self.db.execute(
            select(WritingSettings).where(WritingSettings.project_id == project_id)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> WritingSettings:
        instance = WritingSettings(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[WritingSettings]:
        result = await self.db.execute(
            select(WritingSettings).where(WritingSettings.id == id)
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
            select(WritingSettings).where(WritingSettings.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[WritingSettings]:
        stmt = select(WritingSettings)
        for column, value in filters.items():
            if hasattr(WritingSettings, column) and value is not None:
                stmt = stmt.where(getattr(WritingSettings, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
