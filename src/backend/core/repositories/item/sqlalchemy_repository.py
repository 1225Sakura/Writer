# Auto Novel Writer - Item Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of ItemRepositoryInterface

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.item.interfaces import ItemRepositoryInterface
from backend.core.domain.entities import Item


class SQLAlchemyItemRepository(SQLAlchemyBaseRepository[Item], ItemRepositoryInterface):
    """SQLAlchemy implementation of Item repository."""

    def __init__(self, db):
        super().__init__(db, Item)
