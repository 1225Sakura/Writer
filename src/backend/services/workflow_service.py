# Auto Novel Writer - Workflow Execution Service
# Business logic for workflow execution persistence

import json
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from repositories.workflow_repository import WorkflowExecutionRepository, AgentExecutionLogRepository
from core.domain.entities import WorkflowExecution, AgentExecutionLog

logger = logging.getLogger(__name__)


class WorkflowExecutionService:
    """Service for managing workflow execution persistence.

    Provides high-level operations for creating, updating, and querying
    workflow execution records and agent execution logs.
    """

    def __init__(self, db: AsyncSession):
        """Initialize the service with a database session.

        Args:
            db: Async SQLAlchemy session
        """
        self.db = db
        self.workflow_repo = WorkflowExecutionRepository(db)
        self.agent_log_repo = AgentExecutionLogRepository(db)

    async def create_execution(self, workflow_name: str) -> WorkflowExecution:
        """Create a new workflow execution record.

        Args:
            workflow_name: Name of the workflow being executed

        Returns:
            The created WorkflowExecution instance
        """
        execution = await self.workflow_repo.create({
            "workflow_name": workflow_name,
            "status": "running",
            "started_at": datetime.utcnow(),
        })
        await self.db.commit()
        logger.info("Created workflow execution id=%s for '%s'", execution.id, workflow_name)
        return execution

    async def complete_execution(
        self,
        execution_id: int,
        results: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None,
    ) -> Optional[WorkflowExecution]:
        """Mark a workflow execution as completed or failed.

        Args:
            execution_id: ID of the workflow execution to update
            results: Optional execution results dict (serialized to JSON)
            error: Optional error message if the workflow failed

        Returns:
            Updated WorkflowExecution or None if not found
        """
        data: Dict[str, Any] = {
            "status": "failed" if error else "completed",
            "completed_at": datetime.utcnow(),
        }
        if results is not None:
            data["results_json"] = json.dumps(results, ensure_ascii=False, default=str)
        if error is not None:
            data["error_message"] = error

        execution = await self.workflow_repo.update(execution_id, data)
        if execution:
            await self.db.commit()
            logger.info(
                "Completed workflow execution id=%s status=%s",
                execution_id,
                data["status"],
            )
        return execution

    async def log_agent_execution(
        self,
        workflow_execution_id: int,
        agent_name: str,
        stage_name: str,
        result: Dict[str, Any],
    ) -> AgentExecutionLog:
        """Record an agent execution log entry.

        Args:
            workflow_execution_id: Parent workflow execution ID
            agent_name: Name of the agent that executed
            stage_name: Name of the workflow stage
            result: Agent execution result dict

        Returns:
            The created AgentExecutionLog instance
        """
        status = result.get("status", "completed")
        result_json = json.dumps(result, ensure_ascii=False, default=str)

        log_entry = await self.agent_log_repo.create({
            "workflow_execution_id": workflow_execution_id,
            "agent_name": agent_name,
            "stage_name": stage_name,
            "status": status,
            "result_json": result_json,
            "started_at": datetime.utcnow(),
            "completed_at": datetime.utcnow(),
        })
        await self.db.commit()
        logger.debug(
            "Logged agent execution id=%s agent='%s' stage='%s' status=%s",
            log_entry.id,
            agent_name,
            stage_name,
            status,
        )
        return log_entry

    async def get_execution_history(self, limit: int = 50) -> List[WorkflowExecution]:
        """Get recent workflow execution history.

        Args:
            limit: Maximum number of records to return

        Returns:
            List of WorkflowExecution records ordered by start time desc
        """
        return await self.workflow_repo.get_recent_executions(limit=limit)

    async def get_execution_logs(self, workflow_execution_id: int) -> List[AgentExecutionLog]:
        """Get agent execution logs for a specific workflow execution.

        Args:
            workflow_execution_id: ID of the workflow execution

        Returns:
            List of AgentExecutionLog records
        """
        return await self.agent_log_repo.get_by_workflow_execution_id(workflow_execution_id)
