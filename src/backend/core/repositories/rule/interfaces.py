# Auto Novel Writer - Rule Repository Interface
# Abstract interface for Rule persistence operations

from abc import abstractmethod
from typing import List, Optional

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Rule


class RuleRepositoryInterface(BaseRepositoryInterface[Rule]):
    """Abstract interface for Rule repository operations."""

    @abstractmethod
    async def get_by_type(self, rule_type: str, project_id: Optional[int] = None) -> List[Rule]:
        """Fetch rules by type (e.g. 'magic_system', 'physics', 'social')."""
        ...

    @abstractmethod
    async def get_active_rules(self, project_id: Optional[int] = None) -> List[Rule]:
        """Fetch all rules that have a type set (considered active)."""
        ...
