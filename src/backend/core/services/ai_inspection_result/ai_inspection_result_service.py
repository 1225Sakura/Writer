# Auto Novel Writer - AIInspectionResult Service
# Business logic layer for AIInspectionResult operations with event publishing

from typing import List
from backend.core.services.base import BaseService
from backend.core.domain.entities import AIInspectionResult
from backend.core.repositories.ai_inspection_result.sqlalchemy_repository import SQLAlchemyAIInspectionResultRepository


class AIInspectionResultService(BaseService[AIInspectionResult]):
    """Service for AIInspectionResult operations with event publishing."""

    _cache_tag = "ai_inspections"
    _entity_type = "ai_inspection_result"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, AIInspectionResult)
        # Use specialized repository for custom query methods (e.g. get_by_chapter)
        self.repo = SQLAlchemyAIInspectionResultRepository(db)

    async def get_by_chapter(self, chapter_id: int) -> List[AIInspectionResult]:
        """Get all AI inspection results for a chapter."""
        return await self.repo.get_by_chapter(chapter_id)

    # Backward-compatible aliases
    create_ai_inspection_result = BaseService.create
    update_ai_inspection_result = BaseService.update
    get_ai_inspection_result = BaseService.get
    list_ai_inspection_results = BaseService.list
    delete_ai_inspection_result = BaseService.delete
