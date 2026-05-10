# Auto Novel Writer - Rule Service
# Business logic layer for Rule operations with event publishing

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.rule.sqlalchemy_repository import SQLAlchemyRuleRepository
from backend.core.domain.entities import Rule
from backend.utils.event_bus import AsyncEventBus, ENTITY_CREATED, ENTITY_UPDATED, ENTITY_DELETED
from backend.infrastructure.cache.cache_service import CacheService


class RuleService:
    """Service for Rule entity operations with event publishing."""

    def __init__(self, db: AsyncSession, event_bus: AsyncEventBus, cache: CacheService) -> None:
        self.db = db
        self.event_bus = event_bus
        self.cache = cache
        self.repo = SQLAlchemyRuleRepository(db)

    async def create_rule(self, data: dict) -> Rule:
        """Create a new rule and publish creation event."""
        instance = await self.repo.create(data)
        await self.cache.ainvalidate_tag("rules")
        await self.event_bus.publish(
            ENTITY_CREATED,
            {"entity_type": "rule", "id": instance.id, "data": data},
        )
        return instance

    async def update_rule(self, id: int, data: dict) -> Optional[Rule]:
        """Update a rule and publish update event."""
        instance = await self.repo.update(id, data)
        if instance:
            await self.cache.ainvalidate_tag("rules")
            await self.event_bus.publish(
                ENTITY_UPDATED,
                {"entity_type": "rule", "id": id, "data": data},
            )
        return instance

    async def get_rule(self, id: int) -> Optional[Rule]:
        """Get a rule by ID."""
        return await self.repo.get_by_id(id)

    async def list_rules(self, skip: int = 0, limit: int = 100, **filters) -> List[Rule]:
        """List all rules with pagination."""
        return await self.repo.list(skip=skip, limit=limit, **filters)

    async def delete_rule(self, id: int) -> bool:
        """Delete a rule and publish deletion event."""
        deleted = await self.repo.delete(id)
        if deleted:
            await self.cache.ainvalidate_tag("rules")
            await self.event_bus.publish(
                ENTITY_DELETED,
                {"entity_type": "rule", "id": id},
            )
        return deleted
