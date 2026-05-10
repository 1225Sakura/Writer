# Auto Novel Writer - AIInspectionResult Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of AIInspectionResultRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.ai_inspection_result.interfaces import AIInspectionResultRepositoryInterface
from backend.core.domain.entities import AIInspectionResult


class SQLAlchemyAIInspectionResultRepository(AIInspectionResultRepositoryInterface):
    """SQLAlchemy implementation of AIInspectionResult repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[AIInspectionResult]:
        result = await self.db.execute(
            select(AIInspectionResult).where(AIInspectionResult.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: int) -> List[AIInspectionResult]:
        result = await self.db.execute(
            select(AIInspectionResult).where(AIInspectionResult.project_id == project_id)
        )
        return list(result.scalars().all())

    async def get_by_chapter(self, chapter_id: int) -> List[AIInspectionResult]:
        result = await self.db.execute(
            select(AIInspectionResult).where(AIInspectionResult.chapter_id == chapter_id)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> AIInspectionResult:
        instance = AIInspectionResult(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[AIInspectionResult]:
        result = await self.db.execute(
            select(AIInspectionResult).where(AIInspectionResult.id == id)
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
            select(AIInspectionResult).where(AIInspectionResult.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[AIInspectionResult]:
        stmt = select(AIInspectionResult)
        for column, value in filters.items():
            if hasattr(AIInspectionResult, column) and value is not None:
                stmt = stmt.where(getattr(AIInspectionResult, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
