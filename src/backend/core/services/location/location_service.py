# Auto Novel Writer - Location Service
# Business logic layer for Location operations with event publishing

from backend.core.services.base import BaseService
from backend.core.domain.entities import Location


class LocationService(BaseService[Location]):
    """Service for Location operations with event publishing."""

    _cache_tag = "locations"
    _entity_type = "location"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, Location)

    # Backward-compatible aliases
    create_location = BaseService.create
    update_location = BaseService.update
    get_location = BaseService.get
    list_locations = BaseService.list
    delete_location = BaseService.delete
