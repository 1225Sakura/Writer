# Auto Novel Writer - AIInspectionResult Repository Interface
# Abstract interface for AIInspectionResult persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import AIInspectionResult


class AIInspectionResultRepositoryInterface(ABC):
    """Abstract interface for AIInspectionResult repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[AIInspectionResult]:
        """Fetch an AI inspection result by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[AIInspectionResult]:
        """Fetch all AI inspection results belonging to a project."""
        ...

    @abstractmethod
    async def get_by_chapter(self, chapter_id: int) -> List[AIInspectionResult]:
        """Fetch all AI inspection results for a specific chapter."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> AIInspectionResult:
        """Create and persist a new AI inspection result."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[AIInspectionResult]:
        """Update an AI inspection result by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete an AI inspection result by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[AIInspectionResult]:
        """List AI inspection results with optional pagination and filters."""
        ...
