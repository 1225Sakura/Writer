# Auto Novel Writer - WritingSettings Service
# Business logic layer for WritingSettings operations with event publishing

from typing import Optional

from backend.core.services.base import BaseService
from backend.core.domain.entities import WritingSettings


class WritingSettingsService(BaseService[WritingSettings]):
    """Service for WritingSettings operations with event publishing."""

    _cache_tag = "writing_settings"
    _entity_type = "writing_settings"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, WritingSettings)

    async def get_writing_settings(self, id: int = 0) -> Optional[WritingSettings]:
        """Get writing settings. If no id given, returns the first (singleton) record."""
        if id:
            return await self.repo.get_by_id(id)
        results = await self.repo.list(limit=1)
        return results[0] if results else None

    # Backward-compatible aliases
    create_writing_settings = BaseService.create
    update_writing_settings = BaseService.update
    list_writing_settings = BaseService.list
    delete_writing_settings = BaseService.delete
