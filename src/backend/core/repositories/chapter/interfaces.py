# Auto Novel Writer - Chapter Repository Interface
# Abstract interface for Chapter persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import Chapter, DraftVersion


class ChapterRepositoryInterface(ABC):
    """Abstract interface for Chapter repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[Chapter]:
        """Fetch a chapter by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[Chapter]:
        """Fetch all chapters belonging to a project."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> Chapter:
        """Create and persist a new chapter."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[Chapter]:
        """Update a chapter by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a chapter by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Chapter]:
        """List chapters with optional pagination and filters."""
        ...

    @abstractmethod
    async def get_by_outline(self, outline_id: int, skip: int = 0, limit: int = 100) -> List[Chapter]:
        """Fetch chapters belonging to an outline."""
        ...

    @abstractmethod
    async def get_draft_versions(self, chapter_id: int) -> List[DraftVersion]:
        """Fetch all draft versions for a chapter."""
        ...

    @abstractmethod
    async def create_draft_version(self, data: dict) -> DraftVersion:
        """Create a new draft version."""
        ...

    @abstractmethod
    async def get_draft_version(self, chapter_id: int, version_number: int) -> Optional[DraftVersion]:
        """Get a specific draft version by chapter and version number."""
        ...
