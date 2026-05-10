# Auto Novel Writer - GenreConfiguration Repository Package
from backend.core.repositories.genre_configuration.interfaces import GenreConfigurationRepositoryInterface
from backend.core.repositories.genre_configuration.sqlalchemy_repository import SQLAlchemyGenreConfigurationRepository

__all__ = ["GenreConfigurationRepositoryInterface", "SQLAlchemyGenreConfigurationRepository"]
