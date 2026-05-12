# Auto Novel Writer - Project Repository Interface
# Abstract interface for Project persistence operations

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Project


class ProjectRepositoryInterface(BaseRepositoryInterface[Project]):
    """Abstract interface for Project repository operations."""
    pass
