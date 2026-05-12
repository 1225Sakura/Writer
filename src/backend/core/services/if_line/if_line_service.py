# Auto Novel Writer - IFLine Service
# Business logic layer for IFLine operations with event publishing

from backend.core.services.base import BaseService
from backend.core.domain.entities import IFLine


class IFLineService(BaseService[IFLine]):
    """Service for IFLine operations with event publishing."""

    _cache_tag = "if_lines"
    _entity_type = "if_line"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, IFLine)

    # Backward-compatible aliases
    create_if_line = BaseService.create
    update_if_line = BaseService.update
    get_if_line = BaseService.get
    list_if_lines = BaseService.list
    delete_if_line = BaseService.delete
