# Auto Novel Writer - Location Repository Interface
# Abstract interface for Location persistence operations

from abc import abstractmethod
from typing import List

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Location


class LocationRepositoryInterface(BaseRepositoryInterface[Location]):
    """Abstract interface for Location repository operations."""

    @abstractmethod
    async def get_by_importance(self, importance: str, project_id: int = None) -> List[Location]:
        """Fetch locations by importance level (e.g. 'major', 'minor')."""
        ...

    @abstractmethod
    async def get_by_tag(self, tag: str, project_id: int = None) -> List[Location]:
        """Fetch locations that contain a specific tag in their tags JSON field."""
        ...
