# Auto Novel Writer - Location Repository Interface
# Abstract interface for Location persistence operations

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Location


class LocationRepositoryInterface(BaseRepositoryInterface[Location]):
    """Abstract interface for Location repository operations."""
    pass
