# Auto Novel Writer - WritingSettings Repository Interface
# Abstract interface for WritingSettings persistence operations

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import WritingSettings


class WritingSettingsRepositoryInterface(BaseRepositoryInterface[WritingSettings]):
    """Abstract interface for WritingSettings repository operations."""
    pass
