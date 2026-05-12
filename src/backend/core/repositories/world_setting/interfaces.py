# Auto Novel Writer - WorldSetting Repository Interface
# Abstract interface for WorldSetting persistence operations

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import WorldSetting


class WorldSettingRepositoryInterface(BaseRepositoryInterface[WorldSetting]):
    """Abstract interface for WorldSetting repository operations."""
    pass
