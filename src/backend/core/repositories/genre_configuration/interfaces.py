# Auto Novel Writer - GenreConfiguration Repository Interface
# Abstract interface for GenreConfiguration persistence operations

from abc import abstractmethod
from typing import Optional

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import GenreConfiguration


class GenreConfigurationRepositoryInterface(BaseRepositoryInterface[GenreConfiguration]):
    """Abstract interface for GenreConfiguration repository operations."""

    @abstractmethod
    async def get_by_genre(self, genre: str) -> Optional[GenreConfiguration]:
        """Fetch a genre configuration by genre name."""
        ...
