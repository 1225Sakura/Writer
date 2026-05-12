# Auto Novel Writer - IFLine Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of IFLineRepositoryInterface

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.if_line.interfaces import IFLineRepositoryInterface
from backend.core.domain.entities import IFLine


class SQLAlchemyIFLineRepository(SQLAlchemyBaseRepository[IFLine], IFLineRepositoryInterface):
    """SQLAlchemy implementation of IFLine repository."""

    def __init__(self, db):
        super().__init__(db, IFLine)
