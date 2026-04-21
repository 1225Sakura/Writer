# Auto Novel Writer - Base Repository
# Generic async CRUD operations using SQLAlchemy 2.0 syntax

from typing import TypeVar, Generic, Optional, List, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func

T = TypeVar("T")


class BaseRepository(Generic[T]):
    """Generic async repository with standard CRUD operations."""

    def __init__(self, db: AsyncSession, model: type[T]):
        self.db = db
        self.model = model

    async def get_by_id(self, id: int) -> Optional[T]:
        """Fetch a single record by primary key."""
        result = await self.db.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()

    async def list(
        self, skip: int = 0, limit: int = 100, **filters: Any
    ) -> List[T]:
        """List records with optional pagination and column filters."""
        stmt = select(self.model)
        for column, value in filters.items():
            if hasattr(self.model, column) and value is not None:
                stmt = stmt.where(getattr(self.model, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def create(self, data: dict) -> T:
        """Create and persist a new record."""
        instance = self.model(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[T]:
        """Partially update a record by primary key."""
        stmt = (
            update(self.model)
            .where(self.model.id == id)
            .values(**data)
            .execution_options(synchronize_session="fetch")
        )
        await self.db.execute(stmt)
        await self.db.flush()
        return await self.get_by_id(id)

    async def delete(self, id: int) -> bool:
        """Delete a record by primary key. Returns True if found and deleted."""
        stmt = delete(self.model).where(self.model.id == id)
        result = await self.db.execute(stmt)
        await self.db.flush()
        return result.rowcount > 0

    async def count(self, **filters: Any) -> int:
        """Count records, optionally filtered by column values."""
        stmt = select(func.count()).select_from(self.model)
        for column, value in filters.items():
            if hasattr(self.model, column) and value is not None:
                stmt = stmt.where(getattr(self.model, column) == value)
        result = await self.db.execute(stmt)
        return result.scalar_one()
