# Auto Novel Writer - WorkflowExecution Repository Interface
# Abstract interface for WorkflowExecution persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import WorkflowExecution


class WorkflowExecutionRepositoryInterface(ABC):
    """Abstract interface for WorkflowExecution repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[WorkflowExecution]:
        """Fetch a workflow execution by primary key."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> WorkflowExecution:
        """Create and persist a new workflow execution."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[WorkflowExecution]:
        """Update a workflow execution by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a workflow execution by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[WorkflowExecution]:
        """List workflow executions with optional pagination and filters."""
        ...

    @abstractmethod
    async def get_by_status(self, status: str, skip: int = 0, limit: int = 100) -> List[WorkflowExecution]:
        """Fetch workflow executions filtered by status."""
        ...
