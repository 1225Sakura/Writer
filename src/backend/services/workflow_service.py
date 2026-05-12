# Auto Novel Writer - Workflow Execution Service
# Business logic for workflow execution persistence

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.workflow_execution.sqlalchemy_repository import SQLAlchemyWorkflowExecutionRepository
from backend.core.repositories.agent_execution_log.sqlalchemy_repository import SQLAlchemyAgentExecutionLogRepository
from backend.core.domain.entities import WorkflowExecution, AgentExecutionLog

logger = logging.getLogger(__name__)


class WorkflowExecutionService:
    """Service for managing workflow execution persistence.

    Provides high-level operations for creating, updating, and querying
    workflow execution records and agent execution logs.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.workflow_repo = SQLAlchemyWorkflowExecutionRepository(db)
        self.agent_log_repo = SQLAlchemyAgentExecutionLogRepository(db)

    async def create_execution(self, workflow_name: str) -> WorkflowExecution:
        """Create a new workflow execution record."""
        execution = await self.workflow_repo.create({
            "workflow_name": workflow_name,
            "status": "running",
            "started_at": datetime.now(timezone.utc),
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
        """Mark a workflow execution as completed or failed."""
        data: Dict[str, Any] = {
            "status": "failed" if error else "completed",
            "completed_at": datetime.now(timezone.utc),
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
        """Record an agent execution log entry."""
        status = result.get("status", "completed")
        result_json = json.dumps(result, ensure_ascii=False, default=str)

        log_entry = await self.agent_log_repo.create({
            "workflow_execution_id": workflow_execution_id,
            "agent_name": agent_name,
            "stage_name": stage_name,
            "status": status,
            "result_json": result_json,
            "started_at": datetime.now(timezone.utc),
            "completed_at": datetime.now(timezone.utc),
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
        """Get recent workflow execution history."""
        return await self.workflow_repo.list(limit=limit)

    async def get_execution_logs(self, workflow_execution_id: int) -> List[AgentExecutionLog]:
        """Get agent execution logs for a specific workflow execution."""
        return await self.agent_log_repo.get_by_workflow(workflow_execution_id)
