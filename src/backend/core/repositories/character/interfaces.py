# Auto Novel Writer - Character Repository Interface
# Abstract interface for Character persistence operations

from abc import ABC, abstractmethod
from typing import Optional, List

from core.domain.entities import Character


class CharacterRepositoryInterface(ABC):
    """Abstract interface for Character repository operations."""

    @abstractmethod
    async def get_by_id(self, id: int) -> Optional[Character]:
        """Fetch a character by primary key."""
        ...

    @abstractmethod
    async def get_by_project(self, project_id: int) -> List[Character]:
        """Fetch all characters belonging to a project."""
        ...

    @abstractmethod
    async def create(self, data: dict) -> Character:
        """Create and persist a new character."""
        ...

    @abstractmethod
    async def update(self, id: int, data: dict) -> Optional[Character]:
        """Update a character by primary key."""
        ...

    @abstractmethod
    async def delete(self, id: int) -> bool:
        """Delete a character by primary key. Returns True if deleted."""
        ...

    @abstractmethod
    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Character]:
        """List characters with optional pagination and filters."""
        ...

    @abstractmethod
    async def get_by_tier(self, tier: str, skip: int = 0, limit: int = 100) -> List[Character]:
        """Fetch characters filtered by cultivation tier."""
        ...

    @abstractmethod
    async def get_relationships(self, character_id: int) -> List:
        """Fetch all relationships for a given character."""
        ...

    @abstractmethod
    async def get_storylines(self, character_id: int) -> List:
        """Fetch all storylines for a given character."""
        ...