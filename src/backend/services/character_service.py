# Auto Novel Writer - Character Service
# Business logic layer for Character operations with event publishing

from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from repositories.character_repository import CharacterRepository
from models.entities import Character, CharacterRelationship, CharacterStoryline
from utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from services.cache_service import cache_service


class CharacterService:
    """Service for Character entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus) -> None:
        self.db = db
        self.event_bus = event_bus
        self.repo = CharacterRepository(db)

    async def create_character(self, data: dict) -> Character:
        """Create a new character and publish creation event."""
        character = await self.repo.create(data)
        cache_service.clear_entity_cache("character")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "character", "id": character.id, "data": data},
        )
        return character

    async def update_character(self, id: int, data: dict) -> Optional[Character]:
        """Update a character and publish update event."""
        data["updated_at"] = datetime.utcnow()
        character = await self.repo.update(id, data)
        if character:
            cache_service.clear_entity_cache("character")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "character", "id": id, "data": data},
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
            cache_service.clear_entity_cache("character")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "character", "id": id},
            )
        return deleted

    async def get_relationships(self, character_id: int) -> List[CharacterRelationship]:
        """Get all relationships for a character."""
        return await self.repo.get_relationships(character_id)

    async def create_relationship(self, data: dict) -> CharacterRelationship:
        """Create a relationship for a character."""
        instance = CharacterRelationship(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        cache_service.clear_entity_cache("character")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "character_relationship", "id": instance.id},
        )
        return instance

    async def get_storylines(self, character_id: int) -> List[CharacterStoryline]:
        """Get all storylines for a character."""
        return await self.repo.get_storylines(character_id)

    async def create_storyline(self, data: dict) -> CharacterStoryline:
        """Create a storyline for a character."""
        instance = CharacterStoryline(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        cache_service.clear_entity_cache("character")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "character_storyline", "id": instance.id},
        )
        return instance
