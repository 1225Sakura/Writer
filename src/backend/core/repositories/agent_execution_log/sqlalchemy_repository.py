# Auto Novel Writer - AgentExecutionLog Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of AgentExecutionLogRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.agent_execution_log.interfaces import AgentExecutionLogRepositoryInterface
from backend.core.domain.entities import AgentExecutionLog


class SQLAlchemyAgentExecutionLogRepository(AgentExecutionLogRepositoryInterface):
    """SQLAlchemy implementation of AgentExecutionLog repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[AgentExecutionLog]:
        result = await self.db.execute(
            select(AgentExecutionLog).where(AgentExecutionLog.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_workflow(self, workflow_execution_id: int) -> List[AgentExecutionLog]:
        result = await self.db.execute(
            select(AgentExecutionLog).where(AgentExecutionLog.workflow_execution_id == workflow_execution_id)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> AgentExecutionLog:
        instance = AgentExecutionLog(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[AgentExecutionLog]:
        result = await self.db.execute(
            select(AgentExecutionLog).where(AgentExecutionLog.id == id)
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
            select(AgentExecutionLog).where(AgentExecutionLog.id == id)
        )
        obj = result.scalar_one_or_none()
        if obj is None:
            return False
        await self.db.delete(obj)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[AgentExecutionLog]:
        stmt = select(AgentExecutionLog)
        for column, value in filters.items():
            if hasattr(AgentExecutionLog, column) and value is not None:
                stmt = stmt.where(getattr(AgentExecutionLog, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
