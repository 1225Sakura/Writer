# Auto Novel Writer - Generic Base Repository
# Provides common CRUD operations for all entity repositories

from abc import ABC, abstractmethod
from typing import TypeVar, Generic, Optional, List, Type
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

T = TypeVar('T')


class BaseRepositoryInterface(ABC, Generic[T]):
    """Abstract base interface for all repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[T]:
        """Fetch an entity by primary key."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> T:
        """Create and persist a new entity."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[T]:
        """Update an entity by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete an entity by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[T]:
        """List entities with optional pagination and filters."""
        ...

    async def get_by_project(self, project_id: int) -> List[T]:
        """Fetch all entities belonging to a project. Override if entity has project_id."""
        raise NotImplementedError(f"{self.model.__name__} does not support get_by_project")


class SQLAlchemyBaseRepository(BaseRepositoryInterface[T]):
    """Generic SQLAlchemy implementation of repository operations."""

    def __init__(self, db: AsyncSession, model: Type[T]):
        self.db = db
        self.model = model

    async def get_by_id(self, id: int) -> Optional[T]:
        result = await self.db.execute(
            select(self.model).where(self.model.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: int) -> List[T]:
        """Override in subclasses whose entity has project_id column."""
        if not hasattr(self.model, 'project_id'):
            raise NotImplementedError(f"{self.model.__name__} does not have project_id column")
        result = await self.db.execute(
            select(self.model).where(self.model.project_id == project_id)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> T:
        instance = self.model(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[T]:
        result = await self.db.execute(
            select(self.model).where(self.model.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return None
        for key, value in data.items():
            if hasattr(obj, key) and key not in ('id', 'created_at'):
                setattr(obj, key, value)
        await self.db.flush()
        await self.db.refresh(obj)
        return obj

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(
            select(self.model).where(self.model.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[T]:
        stmt = select(self.model)
        for column, value in filters.items():
            if hasattr(self.model, column) and value is not None:
                stmt = stmt.where(getattr(self.model, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
