# Auto Novel Writer - WorldSetting Service
# Business logic layer for WorldSetting operations with event publishing

from backend.core.services.base import BaseService
from backend.core.domain.entities import WorldSetting


class WorldSettingService(BaseService[WorldSetting]):
    """Service for WorldSetting operations with event publishing."""

    _cache_tag = "world_settings"
    _entity_type = "world_setting"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, WorldSetting)

    # Backward-compatible aliases
    create_world_setting = BaseService.create
    update_world_setting = BaseService.update
    get_world_setting = BaseService.get
    list_world_settings = BaseService.list
    delete_world_setting = BaseService.delete
