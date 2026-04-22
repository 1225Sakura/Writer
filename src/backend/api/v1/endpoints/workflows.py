"""Workflow API routes.

Endpoints for executing, monitoring, and listing agent workflows.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from backend.agents.orchestrator import AgentOrchestrator, StageConfig
from backend.agents.workflows import WORKFLOW_REGISTRY
from backend.database import get_db
from backend.middleware.auth import require_auth
from backend.services.workflow_service import WorkflowExecutionService

router = APIRouter(prefix="/workflows", tags=["workflows"])

# Shared orchestrator instance (initialized at app startup)
_orchestrator: AgentOrchestrator | None = None


def set_orchestrator(orch: AgentOrchestrator) -> None:
    """Set the global orchestrator instance (called during app startup)."""
    global _orchestrator
    _orchestrator = orch


def get_orchestrator() -> AgentOrchestrator:
    """Get the global orchestrator instance."""
    if _orchestrator is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Workflow orchestrator not initialized",
        )
    return _orchestrator


# ---------------------------------------------------------------------------
# Request/Response models
# ---------------------------------------------------------------------------

class ExecuteWorkflowRequest(BaseModel):
    """Request body for workflow execution."""
    model_config = {"json_schema_extra": {
        "example": {
            "context": {"genre": "修仙", "protagonist": "废柴少年", "style": "热血"}
        }
    }}

    context: dict[str, Any] = Field(default_factory=dict, description="Workflow input data")


class ExecuteWorkflowResponse(BaseModel):
    """Response for workflow execution start."""
    model_config = {"json_schema_extra": {
        "example": {
            "execution_id": "exec-001",
            "workflow_name": "initialization",
            "status": "completed",
            "message": "Workflow execution completed"
        }
    }}

    execution_id: str = Field(..., description="Unique execution identifier")
    workflow_name: str = Field(..., description="Executed workflow name")
    status: str = Field(..., description="Execution status")
    message: str = Field(..., description="Status message")


class WorkflowStatusResponse(BaseModel):
    """Response for workflow status query."""
    model_config = {"json_schema_extra": {
        "example": {
            "execution_id": "exec-001",
            "workflow_name": "initialization",
            "status": "completed",
            "stage_results": {},
            "input_data": {}
        }
    }}

    execution_id: str = Field(..., description="Execution identifier")
    workflow_name: str = Field(..., description="Workflow name")
    status: str = Field(..., description="Current status")
    stage_results: dict[str, Any] = Field(..., description="Results from completed stages")
    input_data: dict[str, Any] = Field(..., description="Original input data")


class WorkflowInfo(BaseModel):
    """Workflow metadata."""
    model_config = {"json_schema_extra": {
        "example": {
            "name": "initialization",
            "description": "Initialize novel project",
            "stage_count": 3,
            "stages": []
        }
    }}

    name: str = Field(..., description="Workflow identifier")
    description: str = Field(..., description="Workflow description")
    stage_count: int = Field(..., description="Number of stages")
    stages: list[dict[str, Any]] = Field(..., description="Stage definitions")


class WorkflowListResponse(BaseModel):
    """Response for listing workflows."""
    model_config = {"json_schema_extra": {
        "example": {"workflows": []}
    }}

    workflows: list[WorkflowInfo] = Field(..., description="Available workflows")


class ExecutionSummary(BaseModel):
    """Summary of a workflow execution."""
    model_config = {"json_schema_extra": {
        "example": {
            "execution_id": "exec-001",
            "workflow_name": "initialization",
            "status": "completed",
            "stage_count": 3
        }
    }}

    execution_id: str = Field(..., description="Execution identifier")
    workflow_name: str = Field(..., description="Workflow name")
    status: str = Field(..., description="Execution status")
    stage_count: int = Field(..., description="Number of stages")


class ExecutionListResponse(BaseModel):
    """Response for listing executions."""
    model_config = {"json_schema_extra": {
        "example": {"executions": []}
    }}

    executions: list[ExecutionSummary] = Field(..., description="List of executions")


class AgentLogEntry(BaseModel):
    """Single agent execution log entry."""
    model_config = {"json_schema_extra": {
        "example": {
            "id": 1,
            "agent_name": "ChatAgent",
            "stage_name": "collect_settings",
            "status": "completed",
            "result_json": None,
            "started_at": "2026-04-21T10:00:00",
            "completed_at": "2026-04-21T10:05:00"
        }
    }}

    id: int = Field(..., description="Log entry ID")
    agent_name: str = Field(..., description="Agent name")
    stage_name: str = Field(..., description="Stage name")
    status: str = Field(..., description="Execution status")
    result_json: str | None = Field(None, description="JSON result data")
    started_at: str | None = Field(None, description="Start timestamp")
    completed_at: str | None = Field(None, description="Completion timestamp")


class ExecutionLogsResponse(BaseModel):
    """Response for agent execution logs."""
    model_config = {"json_schema_extra": {
        "example": {
            "workflow_execution_id": 1,
            "logs": []
        }
    }}

    workflow_execution_id: int = Field(..., description="Workflow execution ID")
    logs: list[AgentLogEntry] = Field(..., description="Agent execution logs")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post(
    "/{name}/execute",
    response_model=ExecuteWorkflowResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[require_auth],
    summary="执行工作流",
    description="启动指定名称的工作流执行。工作流名称如: initialization, writing, review。",
)
async def execute_workflow(
    name: str,
    request: ExecuteWorkflowRequest,
    orchestrator: AgentOrchestrator = Depends(get_orchestrator),
) -> dict[str, Any]:
    """Start executing a named workflow.

    Args:
        name: Workflow identifier (e.g. "initialization", "writing", "review")
        request: Execution context data
        orchestrator: AgentOrchestrator instance

    Returns:
        Execution start confirmation with execution_id

    Raises:
        HTTPException: 404 if workflow not found, 503 if orchestrator unavailable
    """
    if name not in WORKFLOW_REGISTRY:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow '{name}' not found. Available: {list(WORKFLOW_REGISTRY.keys())}",
        )

    # Execute workflow (runs synchronously; for long workflows consider background tasks)
    result = await orchestrator.execute_workflow(name, request.context)

    status_value = result.get("status", "unknown")
    if status_value == "failed":
        return {
            "execution_id": result["execution_id"],
            "workflow_name": name,
            "status": status_value,
            "message": f"Workflow failed: {result.get('error', 'Unknown error')}",
        }

    return {
        "execution_id": result["execution_id"],
        "workflow_name": name,
        "status": status_value,
        "message": "Workflow execution completed",
    }


@router.get(
    "/{name}/status/{execution_id}",
    response_model=WorkflowStatusResponse,
    dependencies=[require_auth],
    summary="获取工作流执行状态",
    description="查询指定工作流执行的当前状态和已完成的阶段结果。",
)
async def get_workflow_status(
    name: str,
    execution_id: str,
    orchestrator: AgentOrchestrator = Depends(get_orchestrator),
) -> dict[str, Any]:
    """Get the status of a workflow execution.

    Args:
        name: Workflow identifier
        execution_id: Execution identifier returned by execute
        orchestrator: AgentOrchestrator instance

    Returns:
        Current execution status and accumulated results

    Raises:
        HTTPException: 404 if execution not found
    """
    status_info = orchestrator.get_execution_status(execution_id)
    if status_info is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execution '{execution_id}' not found",
        )

    return {
        "execution_id": status_info["execution_id"],
        "workflow_name": status_info["workflow_name"],
        "status": status_info["status"],
        "stage_results": status_info["stage_results"],
        "input_data": status_info["input_data"],
    }


@router.get(
    "/",
    response_model=WorkflowListResponse,
    dependencies=[require_auth],
    summary="列出所有工作流",
    description="获取所有可用工作流及其阶段配置的列表。",
)
async def list_workflows(
    orchestrator: AgentOrchestrator = Depends(get_orchestrator),
) -> dict[str, Any]:
    """List all available workflows and their configurations.

    Returns:
        List of workflow metadata including stage definitions
    """
    workflows = orchestrator.list_workflows()
    return {"workflows": workflows}


@router.get(
    "/executions",
    response_model=ExecutionListResponse,
    dependencies=[require_auth],
    summary="列出工作流执行记录",
    description="获取所有工作流执行记录的摘要列表，可按工作流名称过滤。",
)
async def list_executions(
    workflow_name: str | None = None,
    orchestrator: AgentOrchestrator = Depends(get_orchestrator),
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """List workflow executions.

    Args:
        workflow_name: Optional filter by workflow name
        orchestrator: AgentOrchestrator instance
        db: Database session

    Returns:
        List of execution summaries from both memory and persistence
    """
    # Get in-memory executions
    executions = orchestrator.list_executions(workflow_name=workflow_name)

    # Get persisted executions
    try:
        service = WorkflowExecutionService(db)
        persisted = await service.get_execution_history(limit=100)
        for record in persisted:
            if workflow_name and record.workflow_name != workflow_name:
                continue
            exec_id = f"db_{record.id}_{record.workflow_name}"
            # Avoid duplicates with in-memory executions
            if not any(e["execution_id"] == exec_id for e in executions):
                executions.append({
                    "execution_id": exec_id,
                    "workflow_name": record.workflow_name,
                    "status": record.status,
                    "stage_count": 0,
                    "started_at": record.started_at.isoformat() if record.started_at else None,
                    "completed_at": record.completed_at.isoformat() if record.completed_at else None,
                })
    except Exception:
        # Persistence is optional; ignore errors
        pass

    return {"executions": executions}


@router.get(
    "/executions/{execution_id}/logs",
    response_model=ExecutionLogsResponse,
    dependencies=[require_auth],
    summary="获取执行日志",
    description="获取指定工作流执行的智能体执行日志详情。",
)
async def get_execution_logs(
    execution_id: int,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """Get agent execution logs for a workflow execution.

    Args:
        execution_id: Workflow execution ID (database ID)
        db: Database session

    Returns:
        List of agent execution log entries

    Raises:
        HTTPException: 404 if execution not found
    """
    service = WorkflowExecutionService(db)

    # Verify execution exists
    execution = await service.workflow_repo.get_by_id(execution_id)
    if execution is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Execution '{execution_id}' not found",
        )

    logs = await service.get_execution_logs(execution_id)
    return {
        "workflow_execution_id": execution_id,
        "logs": [
            {
                "id": log.id,
                "agent_name": log.agent_name,
                "stage_name": log.stage_name,
                "status": log.status,
                "result_json": log.result_json,
                "started_at": log.started_at.isoformat() if log.started_at else None,
                "completed_at": log.completed_at.isoformat() if log.completed_at else None,
            }
            for log in logs
        ],
    }
