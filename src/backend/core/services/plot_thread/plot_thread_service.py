# Auto Novel Writer - PlotThread Service
# Business logic layer for PlotThread operations with event publishing

from backend.core.services.base import BaseService
from backend.core.domain.entities import PlotThread


class PlotThreadService(BaseService[PlotThread]):
    """Service for PlotThread operations with event publishing."""

    _cache_tag = "plot_threads"
    _entity_type = "plot_thread"

    def __init__(self, db, event_bus, cache):
        super().__init__(db, event_bus, cache, PlotThread)

    # Backward-compatible aliases
    create_plot_thread = BaseService.create
    update_plot_thread = BaseService.update
    get_plot_thread = BaseService.get
    list_plot_threads = BaseService.list
    delete_plot_thread = BaseService.delete
