# Auto Novel Writer - AgentExecutionLog Repository Interface
# Abstract interface for AgentExecutionLog persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import AgentExecutionLog


class AgentExecutionLogRepositoryInterface(ABC):
    """Abstract interface for AgentExecutionLog repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[AgentExecutionLog]:
        """Fetch an agent execution log by primary key."""
        ...

    @abstractmethod
    async def get_by_workflow(self, workflow_execution_id: int) -> List[AgentExecutionLog]:
        """Fetch all agent execution logs for a specific workflow execution."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> AgentExecutionLog:
        """Create and persist a new agent execution log."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[AgentExecutionLog]:
        """Update an agent execution log by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete an agent execution log by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[AgentExecutionLog]:
        """List agent execution logs with optional pagination and filters."""
        ...
