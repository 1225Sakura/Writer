# Auto Novel Writer - Item Service
# Business logic layer for Item operations with event publishing

from backend.core.services.base import BaseService
from backend.core.domain.entities import Item


class ItemService(BaseService[Item]):
    """Service for Item operations with event publishing."""

    _cache_tag = "items"
    _entity_type = "item"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, Item)

    # Backward-compatible aliases
    create_item = BaseService.create
    update_item = BaseService.update
    get_item = BaseService.get
    list_items = BaseService.list
    delete_item = BaseService.delete
