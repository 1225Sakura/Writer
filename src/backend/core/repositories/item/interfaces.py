# Auto Novel Writer - Item Repository Interface
# Abstract interface for Item persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import Item


class ItemRepositoryInterface(ABC):
    """Abstract interface for Item repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[Item]:
        """Fetch an item by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[Item]:
        """Fetch all items belonging to a project."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> Item:
        """Create and persist a new item."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[Item]:
        """Update an item by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete an item by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Item]:
        """List items with optional pagination and filters."""
        ...
