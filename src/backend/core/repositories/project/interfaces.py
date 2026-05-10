# Auto Novel Writer - Project Repository Interface
# Abstract interface for Project persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import Project


class ProjectRepositoryInterface(ABC):
    """Abstract interface for Project repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[Project]:
        """Fetch a project by primary key."""
        ...

    @abstractmethod
    async def get_by_name(self, name: str) -> Optional[Project]:
        """Fetch a project by name."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> Project:
        """Create and persist a new project."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[Project]:
        """Update a project by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a project by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Project]:
        """List projects with optional pagination and filters."""
        ...
