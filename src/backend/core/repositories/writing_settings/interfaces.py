# Auto Novel Writer - WritingSettings Repository Interface
# Abstract interface for WritingSettings persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import WritingSettings


class WritingSettingsRepositoryInterface(ABC):
    """Abstract interface for WritingSettings repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[WritingSettings]:
        """Fetch writing settings by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[WritingSettings]:
        """Fetch all writing settings belonging to a project."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> WritingSettings:
        """Create and persist new writing settings."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[WritingSettings]:
        """Update writing settings by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete writing settings by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[WritingSettings]:
        """List writing settings with optional pagination and filters."""
        ...
