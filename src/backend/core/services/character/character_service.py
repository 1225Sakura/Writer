# Auto Novel Writer - Character Service
# Business logic layer for Character operations with event publishing

from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.character.interfaces import CharacterRepositoryInterface
from backend.core.repositories.character.sqlalchemy_repository import SQLAlchemyCharacterRepository
from backend.core.domain.entities import Character, CharacterRelationship, CharacterStoryline
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService, get_cache_service


class CharacterService:
    """Service for Character entity operations with event publishing."""

    def __init__(
        self,
        db: AsyncSession,
        event_bus: AsyncEventBus,
        cache: CacheService,
        repo: Optional[CharacterRepositoryInterface] = None,
    ) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = repo or SQLAlchemyCharacterRepository(db)

    async def create_character(self, data: dict) -> Character:
        """Create a new character and publish creation event."""
        character = await self.repo.create(data)
        self.cache.clear_entity_cache("character")
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
            self.cache.clear_entity_cache("character")
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
            self.cache.clear_entity_cache("character")
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
        self.cache.clear_entity_cache("character")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "character_relationship", "id": instance.id},
        )
        return instance

    async def delete_relationship(self, character_id: int, relationship_id: int) -> bool:
        """Delete a character relationship by ID, verifying ownership."""
        from sqlalchemy import select
        result = await self.db.execute(
            select(CharacterRelationship).where(
                CharacterRelationship.id == relationship_id,
                CharacterRelationship.character_id == character_id,
            )
        )
        relationship = result.scalar_one_or_none()
        if not relationship:
            return False
        await self.db.delete(relationship)
        await self.db.flush()
        self.cache.clear_entity_cache("character")
        await self.event_bus.publish(
            ENTITY_DELETED,
            {"entity_type": "character_relationship", "id": relationship_id},
        )
        return True

    async def get_storylines(self, character_id: int) -> List[CharacterStoryline]:
        """Get all storylines for a character."""
        return await self.repo.get_storylines(character_id)

    async def create_storyline(self, data: dict) -> CharacterStoryline:
        """Create a storyline for a character."""
        instance = CharacterStoryline(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        self.cache.clear_entity_cache("character")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "character_storyline", "id": instance.id},
        )
        return instance

    async def update_storyline(self, character_id: int, storyline_id: int, data: dict) -> Optional[CharacterStoryline]:
        """Update a character storyline by ID, verifying ownership."""
        from sqlalchemy import select
        result = await self.db.execute(
            select(CharacterStoryline).where(
                CharacterStoryline.id == storyline_id,
                CharacterStoryline.character_id == character_id,
            )
        )
        storyline = result.scalar_one_or_none()
        if not storyline:
            return None
        for key, value in data.items():
            setattr(storyline, key, value)
        storyline.updated_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(storyline)
        self.cache.clear_entity_cache("character")
        await self.event_bus.publish(
            ENTITY_UPDATED,
            {"entity_type": "character_storyline", "id": storyline_id},
        )
        return storyline

    async def delete_storyline(self, character_id: int, storyline_id: int) -> bool:
        """Delete a character storyline by ID, verifying ownership."""
        from sqlalchemy import select
        result = await self.db.execute(
            select(CharacterStoryline).where(
                CharacterStoryline.id == storyline_id,
                CharacterStoryline.character_id == character_id,
            )
        )
        storyline = result.scalar_one_or_none()
        if not storyline:
            return False
        await self.db.delete(storyline)
        await self.db.flush()
        self.cache.clear_entity_cache("character")
        await self.event_bus.publish(
            ENTITY_DELETED,
            {"entity_type": "character_storyline", "id": storyline_id},
        )
        return True

    async def list_all_characters(self) -> List[Character]:
        """List all characters (no pagination, for export)."""
        return await self.repo.list(skip=0, limit=100000)

    async def list_all_relationships(self) -> List[CharacterRelationship]:
        """List all character relationships (for export)."""
        from sqlalchemy import select
        result = await self.db.execute(select(CharacterRelationship))
        return list(result.scalars().all())

    async def list_all_storylines(self) -> List[CharacterStoryline]:
        """List all character storylines (for export)."""
        from sqlalchemy import select
        result = await self.db.execute(select(CharacterStoryline))
        return list(result.scalars().all())
