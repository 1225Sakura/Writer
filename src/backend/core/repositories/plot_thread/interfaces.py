# Auto Novel Writer - PlotThread Repository Interface
# Abstract interface for PlotThread persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import PlotThread


class PlotThreadRepositoryInterface(ABC):
    """Abstract interface for PlotThread repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[PlotThread]:
        """Fetch a plot thread by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[PlotThread]:
        """Fetch all plot threads belonging to a project."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> PlotThread:
        """Create and persist a new plot thread."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[PlotThread]:
        """Update a plot thread by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a plot thread by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[PlotThread]:
        """List plot threads with optional pagination and filters."""
        ...
