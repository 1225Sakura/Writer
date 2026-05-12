# Auto Novel Writer - Faction Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of FactionRepositoryInterface

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.faction.interfaces import FactionRepositoryInterface
from backend.core.domain.entities import Faction


class SQLAlchemyFactionRepository(SQLAlchemyBaseRepository[Faction], FactionRepositoryInterface):
    """SQLAlchemy implementation of Faction repository."""

    def __init__(self, db):
        super().__init__(db, Faction)
