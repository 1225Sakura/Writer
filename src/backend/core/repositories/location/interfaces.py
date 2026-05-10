# Auto Novel Writer - Location Repository Interface
# Abstract interface for Location persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import Location


class LocationRepositoryInterface(ABC):
    """Abstract interface for Location repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[Location]:
        """Fetch a location by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[Location]:
        """Fetch all locations belonging to a project."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> Location:
        """Create and persist a new location."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[Location]:
        """Update a location by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a location by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Location]:
        """List locations with optional pagination and filters."""
        ...
