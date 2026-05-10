# Auto Novel Writer - BackgroundTask Repository Interface
# Abstract interface for BackgroundTask persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import BackgroundTask


class BackgroundTaskRepositoryInterface(ABC):
    """Abstract interface for BackgroundTask repository operations."""

    @abstractmethod
    async def get_by_id(self, id: str) -> Optional[BackgroundTask]:
        """Fetch a background task by primary key (String id)."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[BackgroundTask]:
        """Fetch all background tasks belonging to a project."""
        ...

    @abstractmethod
    async def get_by_status(self, status: str) -> List[BackgroundTask]:
        """Fetch all background tasks filtered by status."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> BackgroundTask:
        """Create and persist a new background task."""
        ...

    @abstractmethod
    async def update(self, id: str, data: dict) -> Optional[BackgroundTask]:
        """Update a background task by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: str) -> bool:
        """Delete a background task by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[BackgroundTask]:
        """List background tasks with optional pagination and filters."""
        ...
