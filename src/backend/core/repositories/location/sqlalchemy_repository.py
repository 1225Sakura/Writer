# Auto Novel Writer - Location Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of LocationRepositoryInterface

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.location.interfaces import LocationRepositoryInterface
from backend.core.domain.entities import Location


class SQLAlchemyLocationRepository(SQLAlchemyBaseRepository[Location], LocationRepositoryInterface):
    """SQLAlchemy implementation of Location repository."""

    def __init__(self, db):
        super().__init__(db, Location)
