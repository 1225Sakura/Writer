# Auto Novel Writer - Background Task Queue
# Lightweight asyncio-based task queue for local desktop app
# Python 3.11+

import asyncio
import json
import logging
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Awaitable, Callable, Dict, List, Optional

from sqlalchemy import select, update, delete, and_
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session_maker
from core.domain.entities import BackgroundTask

logger = logging.getLogger(__name__)


class TaskStatus(str, Enum):
    """Task status enumeration."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class TaskType(str, Enum):
    """Task type enumeration."""
    AI_GENERATE = "ai_generate"
    EXPORT_PROJECT = "export_project"
    BATCH_OPERATION = "batch_operation"
    CLEANUP = "cleanup"


@dataclass
class Task:
    """In-memory task representation."""
    id: str
    type: TaskType
    status: TaskStatus
    payload: Dict[str, Any] = field(default_factory=dict)
    result: Optional[Any] = None
    error: Optional[str] = None
    retries: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    _cancel_event: asyncio.Event = field(default_factory=asyncio.Event)

    def is_cancelled(self) -> bool:
        return self._cancel_event.is_set()

    def cancel(self):
        self._cancel_event.set()


# Task handler registry
TaskHandler = Callable[[Task], Awaitable[Any]]
_task_handlers: Dict[TaskType, TaskHandler] = {}


def register_task_handler(task_type: TaskType):
    """Decorator to register a task handler."""
    def decorator(func: TaskHandler) -> TaskHandler:
        _task_handlers[task_type] = func
        return func
    return decorator


class TaskQueue:
    """Async background task queue with worker pool."""

    def __init__(self, max_workers: int = 3, max_retries: int = 3):
        self.max_workers = max_workers
        self.max_retries = max_retries
        self._queue: asyncio.Queue[Task] = asyncio.Queue()
        self._tasks: Dict[str, Task] = {}
        self._workers: List[asyncio.Task] = []
        self._running = False
        self._lock = asyncio.Lock()

    async def start(self):
        """Start the worker pool."""
        if self._running:
            return
        self._running = True
        self._workers = [
            asyncio.create_task(self._worker_loop(f"worker-{i}"))
            for i in range(self.max_workers)
        ]
        logger.info(f"Task queue started with {self.max_workers} workers")

    async def stop(self):
        """Stop the worker pool gracefully."""
        self._running = False
        # Cancel all pending tasks in queue
        while not self._queue.empty():
            try:
                task = self._queue.get_nowait()
                task.status = TaskStatus.CANCELLED
                await self._persist_task(task)
            except asyncio.QueueEmpty:
                break
        # Wait for workers to finish
        if self._workers:
            await asyncio.gather(*self._workers, return_exceptions=True)
            self._workers = []
        logger.info("Task queue stopped")

    async def submit(
        self,
        task_type: TaskType,
        payload: Dict[str, Any],
        task_id: Optional[str] = None
    ) -> Task:
        """Submit a new background task."""
        task = Task(
            id=task_id or str(uuid.uuid4()),
            type=task_type,
            status=TaskStatus.PENDING,
            payload=payload,
        )
        async with self._lock:
            self._tasks[task.id] = task
        await self._persist_task(task)
        await self._queue.put(task)
        logger.info(f"Task submitted: {task.id} ({task_type})")
        return task

    async def get_task(self, task_id: str) -> Optional[Task]:
        """Get task by ID (from memory or database)."""
        async with self._lock:
            if task_id in self._tasks:
                return self._tasks[task_id]
        # Fallback to database
        return await self._get_task_from_db(task_id)

    async def list_tasks(
        self,
        status: Optional[TaskStatus] = None,
        task_type: Optional[TaskType] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[Task]:
        """List tasks with optional filtering."""
        async with async_session_maker() as session:
            query = select(BackgroundTask)
            conditions = []
            if status:
                conditions.append(BackgroundTask.status == status)
            if task_type:
                conditions.append(BackgroundTask.type == task_type)
            if conditions:
                query = query.where(and_(*conditions))
            query = query.order_by(BackgroundTask.created_at.desc())
            query = query.limit(limit).offset(offset)
            result = await session.execute(query)
            db_tasks = result.scalars().all()
            return [self._db_to_task(t) for t in db_tasks]

    async def cancel_task(self, task_id: str) -> bool:
        """Cancel a pending task. Returns True if cancelled."""
        async with self._lock:
            if task_id in self._tasks:
                task = self._tasks[task_id]
                if task.status == TaskStatus.PENDING:
                    task.cancel()
                    task.status = TaskStatus.CANCELLED
                    await self._persist_task(task)
                    logger.info(f"Task cancelled: {task_id}")
                    return True
                return False
        # Check database for pending task
        task = await self._get_task_from_db(task_id)
        if task and task.status == TaskStatus.PENDING:
            task.status = TaskStatus.CANCELLED
            await self._persist_task(task)
            return True
        return False

    async def delete_task(self, task_id: str) -> bool:
        """Delete a task from the database."""
        async with self._lock:
            self._tasks.pop(task_id, None)
        async with async_session_maker() as session:
            result = await session.execute(
                delete(BackgroundTask).where(BackgroundTask.id == task_id)
            )
            await session.commit()
            return result.rowcount > 0

    async def _worker_loop(self, worker_name: str):
        """Worker loop that processes tasks from the queue."""
        while self._running:
            try:
                task = await asyncio.wait_for(self._queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                continue
            except Exception:
                break

            if task.is_cancelled():
                self._queue.task_done()
                continue

            await self._process_task(task)
            self._queue.task_done()

    async def _process_task(self, task: Task):
        """Process a single task with retry logic."""
        handler = _task_handlers.get(task.type)
        if not handler:
            task.status = TaskStatus.FAILED
            task.error = f"No handler registered for task type: {task.type}"
            await self._persist_task(task)
            return

        task.status = TaskStatus.RUNNING
        task.updated_at = datetime.utcnow()
        await self._persist_task(task)

        try:
            result = await handler(task)
            task.result = result
            task.status = TaskStatus.COMPLETED
            task.error = None
            logger.info(f"Task completed: {task.id}")
        except Exception as e:
            task.retries += 1
            if task.retries <= self.max_retries:
                # Exponential backoff: 2^retries seconds
                backoff = 2 ** task.retries
                logger.warning(
                    f"Task failed (attempt {task.retries}/{self.max_retries}): "
                    f"{task.id}, retrying in {backoff}s: {e}"
                )
                await asyncio.sleep(backoff)
                await self._queue.put(task)
                return
            else:
                task.status = TaskStatus.FAILED
                task.error = str(e)
                logger.error(f"Task failed permanently: {task.id}: {e}")

        task.updated_at = datetime.utcnow()
        await self._persist_task(task)

    async def _persist_task(self, task: Task):
        """Persist task state to database."""
        try:
            async with async_session_maker() as session:
                db_task = await session.get(BackgroundTask, task.id)
                if db_task:
                    db_task.status = task.status.value
                    db_task.result = json.dumps(task.result, ensure_ascii=False, default=str) if task.result is not None else None
                    db_task.error = task.error
                    db_task.retries = task.retries
                    db_task.updated_at = datetime.utcnow()
                else:
                    db_task = BackgroundTask(
                        id=task.id,
                        type=task.type.value,
                        status=task.status.value,
                        payload=json.dumps(task.payload, ensure_ascii=False),
                        result=json.dumps(task.result, ensure_ascii=False, default=str) if task.result is not None else None,
                        error=task.error,
                        retries=task.retries,
                        created_at=task.created_at,
                        updated_at=task.updated_at,
                    )
                    session.add(db_task)
                await session.commit()
        except Exception as e:
            logger.error(f"Failed to persist task {task.id}: {e}")

    async def _get_task_from_db(self, task_id: str) -> Optional[Task]:
        """Load task from database."""
        async with async_session_maker() as session:
            db_task = await session.get(BackgroundTask, task_id)
            if db_task:
                return self._db_to_task(db_task)
            return None

    def _db_to_task(self, db_task: BackgroundTask) -> Task:
        """Convert database task to Task dataclass."""
        return Task(
            id=db_task.id,
            type=TaskType(db_task.type),
            status=TaskStatus(db_task.status),
            payload=json.loads(db_task.payload) if db_task.payload else {},
            result=json.loads(db_task.result) if db_task.result else None,
            error=db_task.error,
            retries=db_task.retries or 0,
            created_at=db_task.created_at,
            updated_at=db_task.updated_at,
        )


# Global task queue instance
task_queue = TaskQueue(max_workers=3, max_retries=3)


# ============================================================
# Default Task Handlers
# ============================================================

@register_task_handler(TaskType.AI_GENERATE)
async def handle_ai_generate(task: Task) -> Dict[str, Any]:
    """Handle AI generation task."""
    from services.ai_service import AIService
    from config import settings

    payload = task.payload
    prompt = payload.get("prompt", "")
    operation = payload.get("operation", "continue")
    human_ai_ratio = payload.get("human_ai_ratio", 70)
    style = payload.get("style", "default")

    if not settings.minimax_api_key:
        raise RuntimeError("MiniMax API key not configured")

    ai_service = AIService(
        api_key=settings.minimax_api_key,
        base_url=settings.minimax_api_url
    )

    chunks = []
    async for chunk in ai_service.generate(
        prompt=prompt,
        operation=operation,
        human_ai_ratio=human_ai_ratio,
        style=style
    ):
        if task.is_cancelled():
            raise asyncio.CancelledError("Task was cancelled")
        chunks.append(chunk)

    return {
        "content": "".join(chunks),
        "operation": operation,
        "style": style,
    }


@register_task_handler(TaskType.EXPORT_PROJECT)
async def handle_export_project(task: Task) -> Dict[str, Any]:
    """Handle project export task."""
    from services.export_import import export_project, export_to_json, export_to_zip

    export_format = task.payload.get("format", "json")
    data = await export_project()

    if export_format == "zip":
        zip_bytes = export_to_zip(data)
        import base64
        return {
            "format": "zip",
            "data": base64.b64encode(zip_bytes).decode("utf-8"),
            "filename": "project_export.zip",
        }
    else:
        return {
            "format": "json",
            "data": export_to_json(data),
        }


@register_task_handler(TaskType.BATCH_OPERATION)
async def handle_batch_operation(task: Task) -> Dict[str, Any]:
    """Handle batch operation task (e.g., batch AI generation)."""
    operations = task.payload.get("operations", [])
    results = []

    for i, op in enumerate(operations):
        if task.is_cancelled():
            raise asyncio.CancelledError("Task was cancelled")

        op_type = op.get("type", "ai_generate")
        if op_type == "ai_generate":
            handler = _task_handlers.get(TaskType.AI_GENERATE)
            if handler:
                sub_task = Task(
                    id=f"{task.id}-sub-{i}",
                    type=TaskType.AI_GENERATE,
                    status=TaskStatus.RUNNING,
                    payload=op.get("payload", {}),
                )
                result = await handler(sub_task)
                results.append({"index": i, "status": "success", "result": result})
            else:
                results.append({"index": i, "status": "error", "error": "No AI handler"})
        else:
            results.append({"index": i, "status": "skipped", "reason": f"Unknown op: {op_type}"})

    return {"total": len(operations), "completed": len(results), "results": results}


@register_task_handler(TaskType.CLEANUP)
async def handle_cleanup(task: Task) -> Dict[str, Any]:
    """Handle cleanup task (e.g., remove old completed tasks)."""
    max_age_hours = task.payload.get("max_age_hours", 24)
    cutoff = datetime.utcnow().timestamp() - (max_age_hours * 3600)

    async with async_session_maker() as session:
        from sqlalchemy import delete
        result = await session.execute(
            delete(BackgroundTask).where(
                and_(
                    BackgroundTask.status.in_(["completed", "failed", "cancelled"]),
                    BackgroundTask.updated_at < datetime.fromtimestamp(cutoff)
                )
            )
        )
        await session.commit()
        deleted_count = result.rowcount

    return {"deleted_count": deleted_count, "max_age_hours": max_age_hours}
