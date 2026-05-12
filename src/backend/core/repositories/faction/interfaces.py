# Auto Novel Writer - Faction Repository Interface
# Abstract interface for Faction persistence operations

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Faction


class FactionRepositoryInterface(BaseRepositoryInterface[Faction]):
    """Abstract interface for Faction repository operations."""
    pass
