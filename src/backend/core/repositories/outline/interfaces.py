# Auto Novel Writer - Outline Repository Interface
# Abstract interface for Outline persistence operations

from abc import abstractmethod
from typing import Optional

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Outline


class OutlineRepositoryInterface(BaseRepositoryInterface[Outline]):
    """Abstract interface for Outline repository operations."""

    @abstractmethod
    async def get_with_chapters(self, id: int) -> Optional[Outline]:
        """Fetch an outline with its chapters eagerly loaded."""
        ...
