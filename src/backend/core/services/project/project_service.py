# Auto Novel Writer - Project Service
# Business logic layer for Project operations with event publishing

from backend.core.services.base import BaseService
from backend.core.domain.entities import Project


class ProjectService(BaseService[Project]):
    """Service for Project operations with event publishing."""

    _cache_tag = "projects"
    _entity_type = "project"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, Project)

    # Backward-compatible aliases
    create_project = BaseService.create
    update_project = BaseService.update
    get_project = BaseService.get
    list_projects = BaseService.list
    delete_project = BaseService.delete
