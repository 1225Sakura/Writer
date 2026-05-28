# Auto Novel Writer - IFLine Repository Interface
# Abstract interface for IFLine persistence operations

from abc import abstractmethod
from typing import List, Optional

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import IFLine


class IFLineRepositoryInterface(BaseRepositoryInterface[IFLine]):
    """Abstract interface for IFLine repository operations."""

    @abstractmethod
    async def get_by_character(self, character_id: int) -> List[IFLine]:
        """Fetch IF lines linked to a specific character."""
        ...

    @abstractmethod
    async def get_parallel_lines(self, project_id: int, sync_mode: str = "auto") -> List[IFLine]:
        """Fetch IF lines with a given sync mode (e.g. parallel/auto lines)."""
        ...
