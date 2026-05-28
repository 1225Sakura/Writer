# Auto Novel Writer - Outline Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of OutlineRepositoryInterface

from typing import Optional, List
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.outline.interfaces import OutlineRepositoryInterface
from backend.core.domain.entities import Outline


class SQLAlchemyOutlineRepository(SQLAlchemyBaseRepository[Outline], OutlineRepositoryInterface):
    """SQLAlchemy implementation of Outline repository."""

    def __init__(self, db):
        super().__init__(db, Outline)

    async def get_with_chapters(self, id: int) -> Optional[Outline]:
        result = await self.db.execute(
            select(Outline)
            .where(Outline.id == id)
            .options(selectinload(Outline.chapters))
        )
        return result.scalar_one_or_none()

    async def get_active_outline(self, project_id: int) -> Optional[Outline]:
        """Fetch the most recently created outline for a project."""
        result = await self.db.execute(
            select(Outline)
            .where(Outline.project_id == project_id)
            .order_by(Outline.id.desc())
            .limit(1)
        )
        return result.scalar_one_or_none()
