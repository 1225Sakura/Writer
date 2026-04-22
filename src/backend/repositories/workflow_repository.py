# Auto Novel Writer - Workflow Execution Repository
# Persistence layer for workflow execution tracking

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from repositories.base import BaseRepository
from core.domain.entities import WorkflowExecution, AgentExecutionLog


class WorkflowExecutionRepository(BaseRepository[WorkflowExecution]):
    """Repository for WorkflowExecution entity with workflow-specific operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, WorkflowExecution)

    async def get_by_workflow_name(self, name: str, skip: int = 0, limit: int = 100) -> List[WorkflowExecution]:
        """Fetch workflow executions filtered by workflow name, ordered by start time desc."""
        stmt = (
            select(WorkflowExecution)
            .where(WorkflowExecution.workflow_name == name)
            .order_by(desc(WorkflowExecution.started_at))
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_recent_executions(self, limit: int = 50) -> List[WorkflowExecution]:
        """Fetch the most recent workflow executions across all workflows."""
        stmt = (
            select(WorkflowExecution)
            .order_by(desc(WorkflowExecution.started_at))
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update_status(self, id: int, status: str) -> Optional[WorkflowExecution]:
        """Update the status of a workflow execution."""
        return await self.update(id, {"status": status})


class AgentExecutionLogRepository(BaseRepository[AgentExecutionLog]):
    """Repository for AgentExecutionLog entity with agent log-specific operations."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, AgentExecutionLog)

    async def get_by_workflow_execution_id(self, wf_id: int) -> List[AgentExecutionLog]:
        """Fetch all agent execution logs for a given workflow execution."""
        stmt = (
            select(AgentExecutionLog)
            .where(AgentExecutionLog.workflow_execution_id == wf_id)
            .order_by(AgentExecutionLog.started_at)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_agent_name(self, name: str, skip: int = 0, limit: int = 100) -> List[AgentExecutionLog]:
        """Fetch agent execution logs filtered by agent name."""
        stmt = (
            select(AgentExecutionLog)
            .where(AgentExecutionLog.agent_name == name)
            .order_by(desc(AgentExecutionLog.started_at))
            .offset(skip)
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        return list(result.scalars().all())
