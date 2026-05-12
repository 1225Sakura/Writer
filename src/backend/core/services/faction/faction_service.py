# Auto Novel Writer - Faction Service
# Business logic layer for Faction operations with event publishing

from backend.core.services.base import BaseService
from backend.core.domain.entities import Faction


class FactionService(BaseService[Faction]):
    """Service for Faction operations with event publishing."""

    _cache_tag = "factions"
    _entity_type = "faction"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, Faction)

    # Backward-compatible aliases
    create_faction = BaseService.create
    update_faction = BaseService.update
    get_faction = BaseService.get
    list_factions = BaseService.list
    delete_faction = BaseService.delete
