# Auto Novel Writer - WorkflowExecution Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of WorkflowExecutionRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.workflow_execution.interfaces import WorkflowExecutionRepositoryInterface
from backend.core.domain.entities import WorkflowExecution


class SQLAlchemyWorkflowExecutionRepository(WorkflowExecutionRepositoryInterface):
    """SQLAlchemy implementation of WorkflowExecution repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[WorkflowExecution]:
        result = await self.db.execute(
            select(WorkflowExecution).where(WorkflowExecution.id == id)
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> WorkflowExecution:
        instance = WorkflowExecution(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[WorkflowExecution]:
        result = await self.db.execute(
            select(WorkflowExecution).where(WorkflowExecution.id == id)
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
            select(WorkflowExecution).where(WorkflowExecution.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[WorkflowExecution]:
        stmt = select(WorkflowExecution)
        for column, value in filters.items():
            if hasattr(WorkflowExecution, column) and value is not None:
                stmt = stmt.where(getattr(WorkflowExecution, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_status(self, status: str, skip: int = 0, limit: int = 100) -> List[WorkflowExecution]:
        result = await self.db.execute(
            select(WorkflowExecution)
            .where(WorkflowExecution.status == status)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())
