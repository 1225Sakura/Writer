# Auto Novel Writer - Outline Repository Interface
# Abstract interface for Outline persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import Outline


class OutlineRepositoryInterface(ABC):
    """Abstract interface for Outline repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[Outline]:
        """Fetch an outline by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[Outline]:
        """Fetch all outlines belonging to a project."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> Outline:
        """Create and persist a new outline."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[Outline]:
        """Update an outline by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete an outline by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Outline]:
        """List outlines with optional pagination and filters."""
        ...

    @abstractmethod
    async def get_with_chapters(self, id: int) -> Optional[Outline]:
        """Fetch an outline with its chapters eagerly loaded."""
        ...
