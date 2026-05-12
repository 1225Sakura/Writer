# Auto Novel Writer - Item Repository Interface
# Abstract interface for Item persistence operations

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Item


class ItemRepositoryInterface(BaseRepositoryInterface[Item]):
    """Abstract interface for Item repository operations."""
    pass
