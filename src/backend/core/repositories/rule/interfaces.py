# Auto Novel Writer - Rule Repository Interface
# Abstract interface for Rule persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import Rule


class RuleRepositoryInterface(ABC):
    """Abstract interface for Rule repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[Rule]:
        """Fetch a rule by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[Rule]:
        """Fetch all rules belonging to a project."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> Rule:
        """Create and persist a new rule."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[Rule]:
        """Update a rule by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a rule by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Rule]:
        """List rules with optional pagination and filters."""
        ...
