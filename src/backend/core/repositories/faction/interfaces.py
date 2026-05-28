# Auto Novel Writer - Faction Repository Interface
# Abstract interface for Faction persistence operations

from abc import abstractmethod
from typing import List, Optional

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Faction


class FactionRepositoryInterface(BaseRepositoryInterface[Faction]):
    """Abstract interface for Faction repository operations."""

    @abstractmethod
    async def get_by_type(self, faction_type: str, project_id: Optional[int] = None) -> List[Faction]:
        """Fetch factions by type (e.g. 'alliance', 'conflict', 'guild')."""
        ...

    @abstractmethod
    async def get_by_tag(self, tag: str, project_id: Optional[int] = None) -> List[Faction]:
        """Fetch factions that contain a specific tag in their tags JSON field."""
        ...
