# Auto Novel Writer - IFLine Repository Interface
# Abstract interface for IFLine persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import IFLine


class IFLineRepositoryInterface(ABC):
    """Abstract interface for IFLine repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[IFLine]:
        """Fetch an IF line by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[IFLine]:
        """Fetch all IF lines belonging to a project."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> IFLine:
        """Create and persist a new IF line."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[IFLine]:
        """Update an IF line by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete an IF line by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[IFLine]:
        """List IF lines with optional pagination and filters."""
        ...
