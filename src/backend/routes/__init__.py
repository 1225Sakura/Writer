# Auto Novel Writer - API Routes (Legacy)
# This module is deprecated. Routes have been moved to backend.api.v1.endpoints.
# Use `from backend.api.v1.endpoints import chat, settings, ...` instead.
# This file is kept for backward compatibility during migration.

from __future__ import annotations

import importlib

# Lazy import wrapper for backward compatibility (for * imports and unknown attributes)
def __getattr__(name: str):
    """Lazy import from new location for backward compatibility."""
    mapping = {
        "chat_router": "backend.api.v1.endpoints.chat",
        "settings_router": "backend.api.v1.endpoints.settings",
        "chapters_router": "backend.api.v1.endpoints.chapters",
        "ai_router": "backend.api.v1.endpoints.ai",
        "styles_router": "backend.api.v1.endpoints.styles",
        "export_import_router": "backend.api.v1.endpoints.export_import",
        "auth_router": "backend.api.v1.endpoints.auth",
        "tasks_router": "backend.api.v1.endpoints.tasks",
        "cache_router": "backend.api.v1.endpoints.cache",
        "workflows_router": "backend.api.v1.endpoints.workflows",
        "agents_router": "backend.api.v1.endpoints.agents",
        "stats_router": "backend.api.v1.endpoints.stats",
        "metrics_router": "backend.api.v1.endpoints.metrics",
        "context_rank_router": "backend.api.v1.endpoints.context_rank",
        "snapshots_router": "backend.api.v1.endpoints.snapshots",
        "pacing_router": "backend.api.v1.endpoints.pacing",
        "genres_router": "backend.api.v1.endpoints.genres",
        "graph_router": "backend.api.v1.endpoints.graph",
        "context_router": "backend.api.v1.endpoints.context",
        "constraints_router": "backend.api.v1.endpoints.constraints",
        "observability_router": "backend.api.v1.endpoints.observability",
        "engagement_router": "backend.api.v1.endpoints.engagement",
    }

    if name in mapping:
        module = importlib.import_module(mapping[name])
        return getattr(module, "router")

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


# Re-export api_router from the new location for backward compatibility
# This is what main.py imports: from routes import api_router
from backend.api.v1.router import api_router

# Re-export health_router since health.py is now a proxy module
from backend.api.v1.endpoints.health import router as health_router
