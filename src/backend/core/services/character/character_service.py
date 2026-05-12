# Auto Novel Writer - Character Service
# Business logic layer for Character operations with event publishing

from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.services.base import BaseService
from backend.core.repositories.character.interfaces import CharacterRepositoryInterface
from backend.core.repositories.character.sqlalchemy_repository import SQLAlchemyCharacterRepository
from backend.core.domain.entities import Character, CharacterRelationship, CharacterStoryline
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class CharacterService(BaseService[Character]):
    """Service for Character entity operations with event publishing."""

    _cache_tag = "characters"
    _entity_type = "character"

    def __init__(
        self,
        db: AsyncSession,
        event_bus: AsyncEventBus,
        cache: CacheService,
        repo: Optional[CharacterRepositoryInterface] = None,
    ) -> None:
        super().__init__(db, event_bus, cache, Character)
        self.repo = repo or SQLAlchemyCharacterRepository(db)

    # =========================================================================
    # CRUD overrides
    # =========================================================================

    async def create_character(self, data: dict) -> Character:
        """Create a new character and publish creation event."""
        character = await self.repo.create(data)
        await self.cache.ainvalidate_tag(self._cache_tag)
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": self._entity_type, "id": character.id, "data": data},
        )
        return character

    async def update_character(self, id: int, data: dict) -> Optional[Character]:
        """Update a character and publish update event."""
        data["updated_at"] = datetime.now(timezone.utc)
        character = await self.repo.update(id, data)
        if character:
            await self.cache.ainvalidate_tag(self._cache_tag)
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": self._entity_type, "id": id, "data": data},
            )
        return character

    async def get_character(self, id: int) -> Optional[Character]:
        """Get a character by ID."""
        return await self.repo.get_by_id(id)

    async def list_characters(
        self, skip: int = 0, limit: int = 100, tier: Optional[str] = None
    ) -> List[Character]:
        """List characters with optional tier filter."""
        if tier is not None:
            return await self.repo.get_by_tier(tier, skip=skip, limit=limit)
        return await self.repo.list(skip=skip, limit=limit)

    async def delete_character(self, id: int) -> bool:
        """Delete a character and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag(self._cache_tag)
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": self._entity_type, "id": id},
            )
        return deleted

    # =========================================================================
    # Backward-compatible aliases (match old public API)
    # =========================================================================

    create = create_character
    update = update_character
    get = get_character
    list = list_characters
    delete = delete_character

    # =========================================================================
    # List helpers (no pagination)
    # =========================================================================

    async def list_all_characters(self) -> List[Character]:
        """List all characters (no pagination, for export)."""
        return await self.repo.list(skip=0, limit=100000)

    # =========================================================================
    # Relationship sub-entity operations (delegated to repository)
    # =========================================================================

    async def get_relationships(self, character_id: int) -> List[CharacterRelationship]:
        """Get all relationships for a character."""
        return await self.repo.get_relationships(character_id)

    async def create_relationship(self, data: dict) -> CharacterRelationship:
        """Create a relationship for a character."""
        instance = await self.repo.create_relationship(data)
        await self.cache.ainvalidate_tag(self._cache_tag)
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "character_relationship", "id": instance.id},
        )
        return instance

    async def delete_relationship(self, character_id: int, relationship_id: int) -> bool:
        """Delete a character relationship by ID, verifying ownership."""
        deleted = await self.repo.delete_relationship(character_id, relationship_id)
        if deleted:
            await self.cache.ainvalidate_tag(self._cache_tag)
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "character_relationship", "id": relationship_id},
            )
        return deleted

    async def list_all_relationships(self) -> List[CharacterRelationship]:
        """List all character relationships (for export)."""
        return await self.repo.list_all_relationships()

    # =========================================================================
    # Storyline sub-entity operations (delegated to repository)
    # =========================================================================

    async def get_storylines(self, character_id: int) -> List[CharacterStoryline]:
        """Get all storylines for a character."""
        return await self.repo.get_storylines(character_id)

    async def create_storyline(self, data: dict) -> CharacterStoryline:
        """Create a storyline for a character."""
        instance = await self.repo.create_storyline(data)
        await self.cache.ainvalidate_tag(self._cache_tag)
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "character_storyline", "id": instance.id},
        )
        return instance

    async def update_storyline(self, character_id: int, storyline_id: int, data: dict) -> Optional[CharacterStoryline]:
        """Update a character storyline by ID, verifying ownership."""
        storyline = await self.repo.update_storyline(character_id, storyline_id, data)
        if storyline:
            await self.cache.ainvalidate_tag(self._cache_tag)
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "character_storyline", "id": storyline_id},
            )
        return storyline

    async def delete_storyline(self, character_id: int, storyline_id: int) -> bool:
        """Delete a character storyline by ID, verifying ownership."""
        deleted = await self.repo.delete_storyline(character_id, storyline_id)
        if deleted:
            await self.cache.ainvalidate_tag(self._cache_tag)
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "character_storyline", "id": storyline_id},
            )
        return deleted

    async def list_all_storylines(self) -> List[CharacterStoryline]:
        """List all character storylines (for export)."""
        return await self.repo.list_all_storylines()
