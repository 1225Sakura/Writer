# Auto Novel Writer - Item Repository Interface
# Abstract interface for Item persistence operations

from abc import abstractmethod
from typing import List, Optional

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Item


class ItemRepositoryInterface(BaseRepositoryInterface[Item]):
    """Abstract interface for Item repository operations."""

    @abstractmethod
    async def get_by_owner(self, owner: str, project_id: Optional[int] = None) -> List[Item]:
        """Fetch items belonging to a specific owner."""
        ...

    @abstractmethod
    async def get_by_location(self, location: str, project_id: Optional[int] = None) -> List[Item]:
        """Fetch items found at a specific location."""
        ...
