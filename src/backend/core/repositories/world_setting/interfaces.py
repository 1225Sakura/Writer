# Auto Novel Writer - WorldSetting Repository Interface
# Abstract interface for WorldSetting persistence operations

from abc import abstractmethod
from typing import List, Optional, Dict, Any

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import WorldSetting


class WorldSettingRepositoryInterface(BaseRepositoryInterface[WorldSetting]):
    """Abstract interface for WorldSetting repository operations."""

    @abstractmethod
    async def get_hierarchy(self, project_id: int) -> List[Dict[str, Any]]:
        """Fetch world settings organized as a hierarchy by tags.

        Returns a list of dicts with 'category' and 'settings' keys,
        grouping settings by their first tag.
        """
        ...

    @abstractmethod
    async def get_by_category(self, category: str, project_id: Optional[int] = None) -> List[WorldSetting]:
        """Fetch world settings that match a category (stored in tags)."""
        ...
