# Auto Novel Writer - PlotThread Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of PlotThreadRepositoryInterface

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.plot_thread.interfaces import PlotThreadRepositoryInterface
from backend.core.domain.entities import PlotThread


class SQLAlchemyPlotThreadRepository(SQLAlchemyBaseRepository[PlotThread], PlotThreadRepositoryInterface):
    """SQLAlchemy implementation of PlotThread repository."""

    def __init__(self, db):
        super().__init__(db, PlotThread)
