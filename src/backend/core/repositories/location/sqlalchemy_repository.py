# Auto Novel Writer - Location Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of LocationRepositoryInterface

from typing import List, Optional
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.location.interfaces import LocationRepositoryInterface
from backend.core.domain.entities import Location


class SQLAlchemyLocationRepository(SQLAlchemyBaseRepository[Location], LocationRepositoryInterface):
    """SQLAlchemy implementation of Location repository."""

    def __init__(self, db):
        super().__init__(db, Location)

    async def get_by_importance(self, importance: str, project_id: Optional[int] = None) -> List[Location]:
        stmt = select(Location).where(Location.importance == importance)
        if project_id is not None:
            stmt = stmt.where(Location.project_id == project_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_tag(self, tag: str, project_id: Optional[int] = None) -> List[Location]:
        stmt = select(Location)
        if project_id is not None:
            stmt = stmt.where(Location.project_id == project_id)
        result = await self.db.execute(stmt)
        all_locations = list(result.scalars().all())
        # Filter by tag in JSON-encoded tags field
        return [loc for loc in all_locations if loc.tags and tag in (loc.tags or "")]
