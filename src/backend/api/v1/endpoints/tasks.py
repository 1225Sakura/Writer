# Auto Novel Writer - Background Task API Routes
# Python 3.11+

from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, field_validator

from backend.middleware.auth import require_auth
from backend.services.task_queue import (
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
    model_config = {"json_schema_extra": {
        "example": {
            "type": "ai_generate",
            "payload": {"prompt": "续写下一章", "operation": "continue", "style": "default"},
            "task_id": None
        }
    }}

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
    model_config = {"json_schema_extra": {
        "example": {
            "id": "task-001",
            "type": "ai_generate",
            "status": "completed",
            "payload": {"prompt": "续写"},
            "result": {"content": "生成的内容..."},
            "error": None,
            "retries": 0,
            "created_at": "2026-04-21T10:00:00",
            "updated_at": "2026-04-21T10:05:00"
        }
    }}

    id: str = Field(..., description="Task unique identifier")
    type: str = Field(..., description="Task type")
    status: str = Field(..., description="Task status: pending, running, completed, failed, cancelled")
    payload: Optional[dict] = Field(None, description="Task input payload")
    result: Optional[dict] = Field(None, description="Task execution result")
    error: Optional[str] = Field(None, description="Error message if failed")
    retries: int = Field(0, description="Number of retry attempts")
    created_at: Optional[str] = Field(None, description="Creation timestamp ISO format")
    updated_at: Optional[str] = Field(None, description="Last update timestamp ISO format")

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
    model_config = {"json_schema_extra": {
        "example": {
            "tasks": [],
            "total": 0,
            "limit": 100,
            "offset": 0
        }
    }}

    tasks: List[TaskResponse] = Field(..., description="List of tasks")
    total: int = Field(..., description="Total number of tasks")
    limit: int = Field(..., description="Query limit")
    offset: int = Field(..., description="Query offset")


class TaskSubmitResponse(BaseModel):
    """Task submission response."""
    model_config = {"json_schema_extra": {
        "example": {"task_id": "task-001", "status": "pending", "message": "Task task-001 submitted successfully"}
    }}

    task_id: str = Field(..., description="Submitted task ID")
    status: str = Field(..., description="Initial task status")
    message: str = Field(..., description="Status message")


class TaskCancelResponse(BaseModel):
    """Task cancellation response."""
    model_config = {"json_schema_extra": {
        "example": {"success": True, "message": "Task task-001 cancelled successfully"}
    }}

    success: bool = Field(..., description="Whether cancellation succeeded")
    message: str = Field(..., description="Result message")


# ============================================================
# API Endpoints
# ============================================================

@router.post(
    "",
    summary="提交后台任务",
    description="""
    提交新的后台异步任务。

    任务类型:
    - **ai_generate**: AI内容生成 (payload: prompt, operation, style, human_ai_ratio)
    - **export_project**: 导出项目数据 (payload: format=json|zip)
    - **batch_operation**: 批量操作 (payload: operations list)
    - **cleanup**: 清理旧任务 (payload: max_age_hours)
    """,
)
async def submit_task(request: SubmitTaskRequest) -> TaskSubmitResponse:
    """Submit a new background task."""
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


@router.get(
    "/{task_id}",
    summary="获取任务状态",
    description="通过任务ID查询任务当前状态和执行结果。",
)
async def get_task(task_id: str) -> TaskResponse:
    """Get task status and result by ID."""
    task = await task_queue.get_task(task_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task {task_id} not found")
    return TaskResponse.from_task(task)


@router.get(
    "",
    summary="列出后台任务",
    description="列出所有后台任务，支持按状态、类型过滤和分页。",
)
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


@router.delete(
    "/{task_id}",
    summary="取消后台任务",
    description="取消处于pending状态的后台任务。运行中的任务无法取消。",
)
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
