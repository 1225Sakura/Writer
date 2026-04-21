"""Workflow API routes.

Endpoints for executing, monitoring, and listing agent workflows.
"""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from ..agents.orchestrator import AgentOrchestrator, StageConfig
from ..agents.workflows import WORKFLOW_REGISTRY
from ..database import get_db
from ..middleware.auth import require_auth

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

    context: dict[str, Any] = Field(default_factory=dict, description="Workflow input data")


class ExecuteWorkflowResponse(BaseModel):
    """Response for workflow execution start."""

    execution_id: str
    workflow_name: str
    status: str
    message: str


class WorkflowStatusResponse(BaseModel):
    """Response for workflow status query."""

    execution_id: str
    workflow_name: str
    status: str
    stage_results: dict[str, Any]
    input_data: dict[str, Any]


class WorkflowInfo(BaseModel):
    """Workflow metadata."""

    name: str
    description: str
    stage_count: int
    stages: list[dict[str, Any]]


class WorkflowListResponse(BaseModel):
    """Response for listing workflows."""

    workflows: list[WorkflowInfo]


class ExecutionSummary(BaseModel):
    """Summary of a workflow execution."""

    execution_id: str
    workflow_name: str
    status: str
    stage_count: int


class ExecutionListResponse(BaseModel):
    """Response for listing executions."""

    executions: list[ExecutionSummary]


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@router.post(
    "/{name}/execute",
    response_model=ExecuteWorkflowResponse,
    status_code=status.HTTP_202_ACCEPTED,
    dependencies=[require_auth],
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
)
async def list_executions(
    workflow_name: str | None = None,
    orchestrator: AgentOrchestrator = Depends(get_orchestrator),
) -> dict[str, Any]:
    """List workflow executions.

    Args:
        workflow_name: Optional filter by workflow name
        orchestrator: AgentOrchestrator instance

    Returns:
        List of execution summaries
    """
    executions = orchestrator.list_executions(workflow_name=workflow_name)
    return {"executions": executions}
