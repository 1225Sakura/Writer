# Auto Novel Writer - PlotThread Repository Interface
# Abstract interface for PlotThread persistence operations

from abc import abstractmethod
from typing import List, Optional

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import PlotThread


class PlotThreadRepositoryInterface(BaseRepositoryInterface[PlotThread]):
    """Abstract interface for PlotThread repository operations."""

    @abstractmethod
    async def get_active_threads(self, project_id: Optional[int] = None) -> List[PlotThread]:
        """Fetch plot threads with 'active' status."""
        ...

    @abstractmethod
    async def get_unresolved(self, project_id: Optional[int] = None) -> List[PlotThread]:
        """Fetch plot threads that have no reveal chapter assigned (unresolved)."""
        ...

    @abstractmethod
    async def link_to_chapter(self, thread_id: int, chapter_id: int, link_type: str = "reveal") -> Optional[PlotThread]:
        """Link a plot thread to a chapter (as created or reveal chapter).

        Args:
            thread_id: The plot thread ID
            chapter_id: The chapter ID to link
            link_type: Either 'created' or 'reveal'
        """
        ...
