# Auto Novel Writer - API v1 Router
# Aggregates all endpoint routers under /api/v1 prefix

from fastapi import APIRouter

api_router = APIRouter(prefix="/api/v1")

# Import all endpoint routers
from backend.api.v1.endpoints import (
    auth,
    chat,
    settings,
    chapters,
    ai,
    styles,
    export_import,
    tasks,
    health,
    cache,
    workflows,
    agents,
    stats,
    metrics,
    context_rank,
    snapshots,
    pacing,
    genres,
    graph,
    context,
    constraints,
    observability,
    engagement,
)

# Include all routers
api_router.include_router(auth.router, tags=["auth"])
api_router.include_router(chat.router, tags=["chat"])
api_router.include_router(settings.router, tags=["settings"])
api_router.include_router(chapters.router, tags=["chapters"])
api_router.include_router(ai.router, tags=["ai"])
api_router.include_router(styles.router, tags=["styles"])
api_router.include_router(export_import.router, tags=["export_import"])
api_router.include_router(tasks.router, tags=["tasks"])
api_router.include_router(health.router, tags=["health"])
api_router.include_router(cache.router, tags=["cache"])
api_router.include_router(workflows.router, tags=["workflows"])
api_router.include_router(agents.router, tags=["agents"])
api_router.include_router(stats.router, tags=["stats"])
api_router.include_router(metrics.router, tags=["metrics"])
api_router.include_router(context_rank.router, tags=["context_rank"])
api_router.include_router(snapshots.router, tags=["snapshots"])
api_router.include_router(pacing.router, tags=["pacing"])
api_router.include_router(genres.router, tags=["genres"])
api_router.include_router(graph.router, tags=["graph"])
api_router.include_router(context.router, tags=["context"])
api_router.include_router(constraints.router, tags=["constraints"])
api_router.include_router(observability.router, tags=["observability"])
api_router.include_router(engagement.router, tags=["engagement"])