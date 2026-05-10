# Auto Novel Writer - Item Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of ItemRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.item.interfaces import ItemRepositoryInterface
from backend.core.domain.entities import Item


class SQLAlchemyItemRepository(ItemRepositoryInterface):
    """SQLAlchemy implementation of Item repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[Item]:
        result = await self.db.execute(
            select(Item).where(Item.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: int) -> List[Item]:
        result = await self.db.execute(
            select(Item).where(Item.project_id == project_id)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> Item:
        instance = Item(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[Item]:
        result = await self.db.execute(
            select(Item).where(Item.id == id)
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
            select(Item).where(Item.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Item]:
        stmt = select(Item)
        for column, value in filters.items():
            if hasattr(Item, column) and value is not None:
                stmt = stmt.where(getattr(Item, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
