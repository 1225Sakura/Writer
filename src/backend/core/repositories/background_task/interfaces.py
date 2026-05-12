# Auto Novel Writer - BackgroundTask Repository Interface
# Abstract interface for BackgroundTask persistence operations

from abc import abstractmethod
from typing import Optional, List

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import BackgroundTask


class BackgroundTaskRepositoryInterface(BaseRepositoryInterface[BackgroundTask]):
    """Abstract interface for BackgroundTask repository operations.

    Note: BackgroundTask uses string primary keys (id: str).
    The base class methods get_by_id, update, delete use int by default.
    Implementations must override these to use str.
    """

    @abstractmethod
    async def get_by_id(self, id: str) -> Optional[BackgroundTask]:
        """Fetch a background task by primary key (String id)."""
        ...

    @abstractmethod
    async def update(self, id: str, data: dict) -> Optional[BackgroundTask]:
        """Update a background task by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: str) -> bool:
        """Delete a background task by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def get_by_status(self, status: str) -> List[BackgroundTask]:
        """Fetch all background tasks filtered by status."""
        ...
