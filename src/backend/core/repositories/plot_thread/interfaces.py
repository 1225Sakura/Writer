# Auto Novel Writer - PlotThread Repository Interface
# Abstract interface for PlotThread persistence operations

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import PlotThread


class PlotThreadRepositoryInterface(BaseRepositoryInterface[PlotThread]):
    """Abstract interface for PlotThread repository operations."""
    pass
