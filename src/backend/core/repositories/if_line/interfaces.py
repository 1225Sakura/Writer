# Auto Novel Writer - IFLine Repository Interface
# Abstract interface for IFLine persistence operations

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import IFLine


class IFLineRepositoryInterface(BaseRepositoryInterface[IFLine]):
    """Abstract interface for IFLine repository operations."""
    pass
