# Auto Novel Writer - GenreConfiguration Repository Interface
# Abstract interface for GenreConfiguration persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from backend.core.domain.entities import GenreConfiguration


class GenreConfigurationRepositoryInterface(ABC):
    """Abstract interface for GenreConfiguration repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[GenreConfiguration]:
        """Fetch a genre configuration by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[GenreConfiguration]:
        """Fetch all genre configurations belonging to a project."""
        ...

    @abstractmethod
    async def get_by_genre(self, genre: str) -> Optional[GenreConfiguration]:
        """Fetch a genre configuration by genre name."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> GenreConfiguration:
        """Create and persist a new genre configuration."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[GenreConfiguration]:
        """Update a genre configuration by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a genre configuration by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[GenreConfiguration]:
        """List genre configurations with optional pagination and filters."""
        ...
