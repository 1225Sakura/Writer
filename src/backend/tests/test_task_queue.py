"""Tests for background task queue functionality."""

import pytest
import asyncio
from datetime import datetime
from unittest.mock import patch

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession

from backend.infrastructure.database import Base
from backend.core.domain import entities  # noqa: F401 - register models
from backend.services.task_queue import (
    TaskQueue,
    Task,
    TaskType,
    TaskStatus,
    BackgroundTask,
    register_task_handler,
    _task_handlers,
)


# Test handler (prefix with _ to avoid pytest collection)
async def _sample_handler(task: Task) -> dict:
    await asyncio.sleep(0.01)
    return {"processed": True, "input": task.payload.get("test", "")}


async def _failing_handler(task: Task) -> dict:
    raise RuntimeError("Intentional failure")


async def _cancelled_handler(task: Task) -> dict:
    for i in range(10):
        if task.is_cancelled():
            raise asyncio.CancelledError("Task cancelled")
        await asyncio.sleep(0.01)
    return {"completed": True}


@pytest.fixture
async def test_engine():
    """Create an in-memory engine for task queue tests."""
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(autouse=True)
async def patch_session_maker(test_engine):
    """Patch async_session_maker to use test engine."""
    test_session_maker = async_sessionmaker(
        test_engine, class_=AsyncSession, expire_on_commit=False
    )
    with patch("backend.services.task_queue.async_session_maker", test_session_maker):
        yield


@pytest.fixture
def queue():
    """Create a fresh task queue for testing."""
    return TaskQueue(max_workers=2, max_retries=2)


@pytest.fixture(autouse=True)
def cleanup_handlers():
    """Clean up handlers after each test."""
    original = dict(_task_handlers)
    yield
    _task_handlers.clear()
    _task_handlers.update(original)


@pytest.mark.asyncio
async def test_task_queue_start_stop(queue):
    """Test starting and stopping the task queue."""
    await queue.start()
    assert queue._running is True
    assert len(queue._workers) == 2

    await queue.stop()
    assert queue._running is False
    assert len(queue._workers) == 0


@pytest.mark.asyncio
async def test_submit_and_process_task(queue):
    """Test submitting a task and processing it."""
    _task_handlers[TaskType.CLEANUP] = _sample_handler

    await queue.start()
    task = await queue.submit(
        task_type=TaskType.CLEANUP,
        payload={"test": "hello"}
    )

    assert task.status == TaskStatus.PENDING
    assert task.id is not None

    # Wait for processing
    await asyncio.sleep(0.2)

    # Refresh from DB
    refreshed = await queue.get_task(task.id)
    assert refreshed.status == TaskStatus.COMPLETED
    assert refreshed.result["processed"] is True

    await queue.stop()


@pytest.mark.asyncio
async def test_task_retry_on_failure(queue):
    """Test task retry with exponential backoff."""
    _task_handlers[TaskType.CLEANUP] = _failing_handler

    await queue.start()
    task = await queue.submit(
        task_type=TaskType.CLEANUP,
        payload={}
    )

    # Wait for retries (backoff: 2^1=2s, 2^2=4s + processing time)
    await asyncio.sleep(10)

    refreshed = await queue.get_task(task.id)
    assert refreshed.status == TaskStatus.FAILED
    assert refreshed.retries == 3
    assert "Intentional failure" in refreshed.error

    await queue.stop()


@pytest.mark.asyncio
async def test_cancel_pending_task(queue):
    """Test cancelling a pending task."""
    _task_handlers[TaskType.CLEANUP] = _sample_handler

    await queue.start()

    # Submit many tasks to ensure some stay pending
    tasks = []
    for i in range(10):
        task = await queue.submit(
            task_type=TaskType.CLEANUP,
            payload={"test": f"task_{i}"}
        )
        tasks.append(task)

    # Cancel the last one (should still be pending)
    cancelled = await queue.cancel_task(tasks[-1].id)
    assert cancelled is True

    cancelled_task = await queue.get_task(tasks[-1].id)
    assert cancelled_task.status == TaskStatus.CANCELLED

    await queue.stop()


@pytest.mark.asyncio
async def test_list_tasks_with_filtering(queue):
    """Test listing tasks with status and type filters."""
    _task_handlers[TaskType.CLEANUP] = _sample_handler
    _task_handlers[TaskType.EXPORT_PROJECT] = _sample_handler

    await queue.start()

    # Submit tasks
    task1 = await queue.submit(TaskType.CLEANUP, {"test": "a"})
    task2 = await queue.submit(TaskType.EXPORT_PROJECT, {"test": "b"})

    await asyncio.sleep(0.2)

    # List all tasks
    all_tasks = await queue.list_tasks()
    assert len(all_tasks) >= 2

    # Filter by type
    cleanup_tasks = await queue.list_tasks(task_type=TaskType.CLEANUP)
    assert all(t.type == TaskType.CLEANUP for t in cleanup_tasks)

    # Filter by status
    completed_tasks = await queue.list_tasks(status=TaskStatus.COMPLETED)
    assert all(t.status == TaskStatus.COMPLETED for t in completed_tasks)

    await queue.stop()


@pytest.mark.asyncio
async def test_task_persistence(queue, test_engine):
    """Test that tasks are persisted to the database."""
    _task_handlers[TaskType.CLEANUP] = _sample_handler

    await queue.start()
    task = await queue.submit(
        task_type=TaskType.CLEANUP,
        payload={"persist": True}
    )

    await asyncio.sleep(0.2)

    # Verify in database directly using test engine
    async with async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)() as session:
        from sqlalchemy import select
        result = await session.execute(
            select(BackgroundTask).where(BackgroundTask.id == task.id)
        )
        db_task = result.scalar_one_or_none()
        assert db_task is not None
        assert db_task.status == TaskStatus.COMPLETED.value
        assert db_task.type == TaskType.CLEANUP.value

    await queue.stop()


@pytest.mark.asyncio
async def test_delete_task(queue):
    """Test deleting a task."""
    _task_handlers[TaskType.CLEANUP] = _sample_handler

    await queue.start()
    task = await queue.submit(TaskType.CLEANUP, {"test": "delete"})
    await asyncio.sleep(0.2)

    deleted = await queue.delete_task(task.id)
    assert deleted is True

    # Verify deleted
    found = await queue.get_task(task.id)
    assert found is None

    await queue.stop()


@pytest.mark.asyncio
async def test_batch_operation_task(queue):
    """Test batch operation task handler."""
    _task_handlers[TaskType.AI_GENERATE] = _sample_handler

    # Import the actual batch handler
    from backend.services.task_queue import handle_batch_operation
    _task_handlers[TaskType.BATCH_OPERATION] = handle_batch_operation
    _task_handlers[TaskType.AI_GENERATE] = _sample_handler

    await queue.start()
    task = await queue.submit(
        task_type=TaskType.BATCH_OPERATION,
        payload={
            "operations": [
                {"type": "ai_generate", "payload": {"test": "op1"}},
                {"type": "ai_generate", "payload": {"test": "op2"}},
            ]
        }
    )

    await asyncio.sleep(0.5)

    refreshed = await queue.get_task(task.id)
    assert refreshed.status == TaskStatus.COMPLETED
    assert refreshed.result["total"] == 2
    assert refreshed.result["completed"] == 2

    await queue.stop()


@pytest.mark.asyncio
async def test_task_not_found(queue):
    """Test getting a non-existent task."""
    task = await queue.get_task("non-existent-id")
    assert task is None


@pytest.mark.asyncio
async def test_cancel_non_pending_task(queue):
    """Test cancelling a task that is not pending."""
    _task_handlers[TaskType.CLEANUP] = _sample_handler

    await queue.start()
    task = await queue.submit(TaskType.CLEANUP, {"test": "x"})

    # Wait for completion
    await asyncio.sleep(0.2)

    # Try to cancel completed task
    cancelled = await queue.cancel_task(task.id)
    assert cancelled is False

    await queue.stop()
