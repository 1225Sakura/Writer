# Auto Novel Writer - Character Repository Interface
# Abstract interface for Character persistence operations

from abc import abstractmethod
from typing import Optional, List

from backend.core.repositories.base import BaseRepositoryInterface
from backend.core.domain.entities import Character, CharacterRelationship, CharacterStoryline


class CharacterRepositoryInterface(BaseRepositoryInterface[Character]):
    """Abstract interface for Character repository operations."""

    @abstractmethod
    async def get_by_tier(self, tier: str, skip: int = 0, limit: int = 100) -> List[Character]:
        """Fetch characters filtered by cultivation tier."""
        ...

    @abstractmethod
    async def get_relationships(self, character_id: int) -> List[CharacterRelationship]:
        """Fetch all relationships for a given character."""
        ...

    @abstractmethod
    async def get_storylines(self, character_id: int) -> List[CharacterStoryline]:
        """Fetch all storylines for a given character."""
        ...

    @abstractmethod
    async def create_relationship(self, data: dict) -> CharacterRelationship:
        """Create and persist a new character relationship."""
        ...

    @abstractmethod
    async def delete_relationship(self, character_id: int, relationship_id: int) -> bool:
        """Delete a character relationship by ID, verifying ownership. Returns True if deleted."""
        ...

    @abstractmethod
    async def create_storyline(self, data: dict) -> CharacterStoryline:
        """Create and persist a new character storyline."""
        ...

    @abstractmethod
    async def update_storyline(self, character_id: int, storyline_id: int, data: dict) -> Optional[CharacterStoryline]:
        """Update a character storyline by ID, verifying ownership."""
        ...

    @abstractmethod
    async def delete_storyline(self, character_id: int, storyline_id: int) -> bool:
        """Delete a character storyline by ID, verifying ownership. Returns True if deleted."""
        ...

    @abstractmethod
    async def list_all_relationships(self) -> List[CharacterRelationship]:
        """Fetch all character relationships (no pagination, for export)."""
        ...

    @abstractmethod
    async def list_all_storylines(self) -> List[CharacterStoryline]:
        """Fetch all character storylines (no pagination, for export)."""
        ...
