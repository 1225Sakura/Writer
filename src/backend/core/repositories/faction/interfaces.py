# Auto Novel Writer - Faction Repository Interface
# Abstract interface for Faction persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import Faction


class FactionRepositoryInterface(ABC):
    """Abstract interface for Faction repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[Faction]:
        """Fetch a faction by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[Faction]:
        """Fetch all factions belonging to a project."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> Faction:
        """Create and persist a new faction."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[Faction]:
        """Update a faction by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a faction by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Faction]:
        """List factions with optional pagination and filters."""
        ...
