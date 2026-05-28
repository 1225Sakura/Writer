# Auto Novel Writer - Faction Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of FactionRepositoryInterface

from typing import List, Optional
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.faction.interfaces import FactionRepositoryInterface
from backend.core.domain.entities import Faction


class SQLAlchemyFactionRepository(SQLAlchemyBaseRepository[Faction], FactionRepositoryInterface):
    """SQLAlchemy implementation of Faction repository."""

    def __init__(self, db):
        super().__init__(db, Faction)

    async def get_by_type(self, faction_type: str, project_id: Optional[int] = None) -> List[Faction]:
        stmt = select(Faction).where(Faction.type == faction_type)
        if project_id is not None:
            stmt = stmt.where(Faction.project_id == project_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_tag(self, tag: str, project_id: Optional[int] = None) -> List[Faction]:
        stmt = select(Faction)
        if project_id is not None:
            stmt = stmt.where(Faction.project_id == project_id)
        result = await self.db.execute(stmt)
        all_factions = list(result.scalars().all())
        return [f for f in all_factions if f.tags and tag in (f.tags or "")]
