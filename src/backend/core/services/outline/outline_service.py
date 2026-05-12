# Auto Novel Writer - Outline Service
# Business logic layer for Outline operations with event publishing

from typing import Optional
from backend.core.services.base import BaseService
from backend.core.domain.entities import Outline
from backend.core.repositories.outline.sqlalchemy_repository import SQLAlchemyOutlineRepository


class OutlineService(BaseService[Outline]):
    """Service for Outline operations with event publishing."""

    _cache_tag = "outlines"
    _entity_type = "outline"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, Outline)
        # Use specialized repository for custom query methods (e.g. get_with_chapters)
        self.repo = SQLAlchemyOutlineRepository(db)

    async def get_outline_with_chapters(self, id: int) -> Optional[Outline]:
        """Get an outline with its chapters eagerly loaded."""
        return await self.repo.get_with_chapters(id)

    # Backward-compatible aliases
    create_outline = BaseService.create
    update_outline = BaseService.update
    get_outline = BaseService.get
    list_outlines = BaseService.list
    delete_outline = BaseService.delete
