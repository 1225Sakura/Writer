# Auto Novel Writer - Rule Service
# Business logic layer for Rule operations with event publishing

from backend.core.services.base import BaseService
from backend.core.domain.entities import Rule


class RuleService(BaseService[Rule]):
    """Service for Rule operations with event publishing."""

    _cache_tag = "rules"
    _entity_type = "rule"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, Rule)

    # Backward-compatible aliases
    create_rule = BaseService.create
    update_rule = BaseService.update
    get_rule = BaseService.get
    list_rules = BaseService.list
    delete_rule = BaseService.delete
