# Auto Novel Writer - AIInspectionResult Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of AIInspectionResultRepositoryInterface

from typing import List
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.ai_inspection_result.interfaces import AIInspectionResultRepositoryInterface
from backend.core.domain.entities import AIInspectionResult


class SQLAlchemyAIInspectionResultRepository(SQLAlchemyBaseRepository[AIInspectionResult], AIInspectionResultRepositoryInterface):
    """SQLAlchemy implementation of AIInspectionResult repository."""

    def __init__(self, db):
        super().__init__(db, AIInspectionResult)

    async def get_by_chapter(self, chapter_id: int) -> List[AIInspectionResult]:
        result = await self.db.execute(
            select(AIInspectionResult).where(AIInspectionResult.chapter_id == chapter_id)
        )
        return list(result.scalars().all())
