# Auto Novel Writer - PlotThread Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of PlotThreadRepositoryInterface

from typing import List, Optional
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.plot_thread.interfaces import PlotThreadRepositoryInterface
from backend.core.domain.entities import PlotThread


class SQLAlchemyPlotThreadRepository(SQLAlchemyBaseRepository[PlotThread], PlotThreadRepositoryInterface):
    """SQLAlchemy implementation of PlotThread repository."""

    def __init__(self, db):
        super().__init__(db, PlotThread)

    async def get_active_threads(self, project_id: Optional[int] = None) -> List[PlotThread]:
        stmt = select(PlotThread).where(PlotThread.status == "active")
        if project_id is not None:
            stmt = stmt.where(PlotThread.project_id == project_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_unresolved(self, project_id: Optional[int] = None) -> List[PlotThread]:
        stmt = select(PlotThread).where(PlotThread.reveal_chapter_id.is_(None))
        if project_id is not None:
            stmt = stmt.where(PlotThread.project_id == project_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def link_to_chapter(self, thread_id: int, chapter_id: int, link_type: str = "reveal") -> Optional[PlotThread]:
        thread = await self.get_by_id(thread_id)
        if thread is None:
            return None
        if link_type == "reveal":
            thread.reveal_chapter_id = chapter_id
        elif link_type == "created":
            thread.created_chapter_id = chapter_id
        else:
            raise ValueError(f"Invalid link_type: {link_type}. Must be 'created' or 'reveal'.")
        await self.db.flush()
        await self.db.refresh(thread)
        return thread
