# Auto Novel Writer - Rule Repository Interface
# Abstract interface for Rule persistence operations

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Rule


class RuleRepositoryInterface(BaseRepositoryInterface[Rule]):
    """Abstract interface for Rule repository operations."""
    pass
