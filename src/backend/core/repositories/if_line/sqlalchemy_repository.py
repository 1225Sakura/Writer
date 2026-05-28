# Auto Novel Writer - IFLine Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of IFLineRepositoryInterface

from typing import List
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.if_line.interfaces import IFLineRepositoryInterface
from backend.core.domain.entities import IFLine


class SQLAlchemyIFLineRepository(SQLAlchemyBaseRepository[IFLine], IFLineRepositoryInterface):
    """SQLAlchemy implementation of IFLine repository."""

    def __init__(self, db):
        super().__init__(db, IFLine)

    async def get_by_character(self, character_id: int) -> List[IFLine]:
        result = await self.db.execute(
            select(IFLine).where(IFLine.linked_character_id == character_id)
        )
        return list(result.scalars().all())

    async def get_parallel_lines(self, project_id: int, sync_mode: str = "auto") -> List[IFLine]:
        result = await self.db.execute(
            select(IFLine)
            .where(IFLine.project_id == project_id)
            .where(IFLine.sync_mode == sync_mode)
        )
        return list(result.scalars().all())
