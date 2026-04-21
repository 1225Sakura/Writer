# Auto Novel Writer - Background Task API Routes
# Python 3.11+

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from middleware.auth import require_auth
from services.task_queue import (
    TaskQueue,
    TaskType,
    TaskStatus,
    task_queue,
)

router = APIRouter(prefix="/tasks", tags=["tasks"], dependencies=[require_auth])


# ============================================================
# Request/Response Models
# ============================================================

class SubmitTaskRequest(BaseModel):
    """Request to submit a background task."""
    type: str = Field(..., description="Task type: ai_generate, export_project, batch_operation, cleanup")
    payload: dict = Field(default_factory=dict, description="Task-specific payload")
    task_id: Optional[str] = Field(None, description="Optional custom task ID")

    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        try:
            TaskType(v)
        except ValueError:
            valid = ", ".join(t.value for t in TaskType)
            raise ValueError(f"Invalid task type. Must be one of: {valid}")
        return v


class TaskResponse(BaseModel):
    """Task response model."""
    id: str
    type: str
    status: str
    payload: Optional[dict] = None
    result: Optional[dict] = None
    error: Optional[str] = None
    retries: int = 0
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    @staticmethod
    def from_task(task) -> "TaskResponse":
        return TaskResponse(
            id=task.id,
            type=task.type.value,
            status=task.status.value,
            payload=task.payload,
            result=task.result if isinstance(task.result, dict) else {"data": task.result} if task.result is not None else None,
            error=task.error,
            retries=task.retries,
            created_at=task.created_at.isoformat() if task.created_at else None,
            updated_at=task.updated_at.isoformat() if task.updated_at else None,
        )


class TaskListResponse(BaseModel):
    """Paginated task list response."""
    tasks: List[TaskResponse]
    total: int
    limit: int
    offset: int


class TaskSubmitResponse(BaseModel):
    """Task submission response."""
    task_id: str
    status: str
    message: str


class TaskCancelResponse(BaseModel):
    """Task cancellation response."""
    success: bool
    message: str


# ============================================================
# API Endpoints
# ============================================================

@router.post("")
async def submit_task(request: SubmitTaskRequest) -> TaskSubmitResponse:
    """Submit a new background task.

    Task types:
    - ai_generate: AI content generation (payload: prompt, operation, style, human_ai_ratio)
    - export_project: Export project data (payload: format=json|zip)
    - batch_operation: Batch operations (payload: operations list)
    - cleanup: Cleanup old tasks (payload: max_age_hours)
    """
    task_type = TaskType(request.type)
    task = await task_queue.submit(
        task_type=task_type,
        payload=request.payload,
        task_id=request.task_id
    )
    return TaskSubmitResponse(
        task_id=task.id,
        status=task.status.value,
        message=f"Task {task.id} submitted successfully"
    )


@router.get("/{task_id}")
async def get_task(task_id: str) -> TaskResponse:
    """Get task status and result by ID."""
    task = await task_queue.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return TaskResponse.from_task(task)


@router.get("")
async def list_tasks(
    status: Optional[str] = Query(None, description="Filter by status: pending, running, completed, failed, cancelled"),
    type: Optional[str] = Query(None, description="Filter by type: ai_generate, export_project, batch_operation, cleanup"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
) -> TaskListResponse:
    """List background tasks with optional filtering."""
    task_status = None
    task_type = None

    if status:
        try:
            task_status = TaskStatus(status)
        except ValueError:
            valid = ", ".join(s.value for s in TaskStatus)
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid}")

    if type:
        try:
            task_type = TaskType(type)
        except ValueError:
            valid = ", ".join(t.value for t in TaskType)
            raise HTTPException(status_code=400, detail=f"Invalid type. Must be one of: {valid}")

    tasks = await task_queue.list_tasks(
        status=task_status,
        task_type=task_type,
        limit=limit,
        offset=offset
    )

    return TaskListResponse(
        tasks=[TaskResponse.from_task(t) for t in tasks],
        total=len(tasks),
        limit=limit,
        offset=offset,
    )


@router.delete("/{task_id}")
async def cancel_task(task_id: str) -> TaskCancelResponse:
    """Cancel a pending background task.

    Only tasks with status 'pending' can be cancelled.
    Running tasks cannot be cancelled (they will complete).
    """
    cancelled = await task_queue.cancel_task(task_id)
    if cancelled:
        return TaskCancelResponse(
            success=True,
            message=f"Task {task_id} cancelled successfully"
        )
    return TaskCancelResponse(
        success=False,
        message=f"Task {task_id} could not be cancelled (may not exist or not in pending status)"
    )
