# Auto Novel Writer - Outline Repository Interface
# Abstract interface for Outline persistence operations

from abc import abstractmethod
from typing import Optional, List

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Outline


class OutlineRepositoryInterface(BaseRepositoryInterface[Outline]):
    """Abstract interface for Outline repository operations."""

    @abstractmethod
    async def get_with_chapters(self, id: int) -> Optional[Outline]:
        """Fetch an outline with its chapters eagerly loaded."""
        ...

    @abstractmethod
    async def get_active_outline(self, project_id: int) -> Optional[Outline]:
        """Fetch the most recently updated outline for a project."""
        ...
