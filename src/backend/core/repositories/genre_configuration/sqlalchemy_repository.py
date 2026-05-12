# Auto Novel Writer - GenreConfiguration Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of GenreConfigurationRepositoryInterface

from typing import Optional
from sqlalchemy import select

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.genre_configuration.interfaces import GenreConfigurationRepositoryInterface
from backend.core.domain.entities import GenreConfiguration


class SQLAlchemyGenreConfigurationRepository(SQLAlchemyBaseRepository[GenreConfiguration], GenreConfigurationRepositoryInterface):
    """SQLAlchemy implementation of GenreConfiguration repository."""

    def __init__(self, db):
        super().__init__(db, GenreConfiguration)

    async def get_by_genre(self, genre: str) -> Optional[GenreConfiguration]:
        result = await self.db.execute(
            select(GenreConfiguration).where(GenreConfiguration.genre == genre)
        )
        return result.scalar_one_or_none()
