# Auto Novel Writer - Item Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of ItemRepositoryInterface

from typing import List, Optional
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.item.interfaces import ItemRepositoryInterface
from backend.core.domain.entities import Item


class SQLAlchemyItemRepository(SQLAlchemyBaseRepository[Item], ItemRepositoryInterface):
    """SQLAlchemy implementation of Item repository."""

    def __init__(self, db):
        super().__init__(db, Item)

    async def get_by_owner(self, owner: str, project_id: Optional[int] = None) -> List[Item]:
        stmt = select(Item).where(Item.owner == owner)
        if project_id is not None:
            stmt = stmt.where(Item.project_id == project_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_location(self, location: str, project_id: Optional[int] = None) -> List[Item]:
        stmt = select(Item).where(Item.location == location)
        if project_id is not None:
            stmt = stmt.where(Item.project_id == project_id)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
