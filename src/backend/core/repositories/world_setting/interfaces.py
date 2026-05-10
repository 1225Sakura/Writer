# Auto Novel Writer - WorldSetting Repository Interface
# Abstract interface for WorldSetting persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import WorldSetting


class WorldSettingRepositoryInterface(ABC):
    """Abstract interface for WorldSetting repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[WorldSetting]:
        """Fetch a world setting by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[WorldSetting]:
        """Fetch all world settings belonging to a project."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> WorldSetting:
        """Create and persist a new world setting."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[WorldSetting]:
        """Update a world setting by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a world setting by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[WorldSetting]:
        """List world settings with optional pagination and filters."""
        ...
