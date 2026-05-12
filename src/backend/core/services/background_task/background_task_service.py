# Auto Novel Writer - BackgroundTask Service
# Business logic layer for BackgroundTask operations with event publishing

from typing import Optional, List
from backend.core.services.base import BaseService
from backend.core.domain.entities import BackgroundTask
from backend.core.repositories.background_task.sqlalchemy_repository import SQLAlchemyBackgroundTaskRepository


class BackgroundTaskService(BaseService[BackgroundTask]):
    """Service for BackgroundTask operations with event publishing."""

    _cache_tag = "background_tasks"
    _entity_type = "background_task"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, BackgroundTask)
        # Use specialized repository for custom query methods (e.g. get_by_status)
        self.repo = SQLAlchemyBackgroundTaskRepository(db)

    async def get_by_status(self, status: str) -> List[BackgroundTask]:
        """Get background tasks by status."""
        return await self.repo.get_by_status(status)

    # Backward-compatible aliases (note: id is str, not int — callers pass str anyway)
    create_background_task = BaseService.create
    update_background_task = BaseService.update
    get_background_task = BaseService.get
    list_background_tasks = BaseService.list
    delete_background_task = BaseService.delete
