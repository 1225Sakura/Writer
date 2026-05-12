# Auto Novel Writer - GenreConfiguration Service
# Business logic layer for GenreConfiguration operations with event publishing

from typing import Optional
from backend.core.services.base import BaseService
from backend.core.domain.entities import GenreConfiguration
from backend.core.repositories.genre_configuration.sqlalchemy_repository import SQLAlchemyGenreConfigurationRepository


class GenreConfigurationService(BaseService[GenreConfiguration]):
    """Service for GenreConfiguration operations with event publishing."""

    _cache_tag = "genre_configurations"
    _entity_type = "genre_configuration"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, GenreConfiguration)
        # Use specialized repository for custom query methods (e.g. get_by_genre)
        self.repo = SQLAlchemyGenreConfigurationRepository(db)

    async def get_by_genre(self, genre: str) -> Optional[GenreConfiguration]:
        """Get a genre configuration by genre name."""
        return await self.repo.get_by_genre(genre)

    # Backward-compatible aliases
    create_genre_configuration = BaseService.create
    update_genre_configuration = BaseService.update
    get_genre_configuration = BaseService.get
    list_genre_configurations = BaseService.list
    delete_genre_configuration = BaseService.delete
