"""Register all routers in FastAPI app.

Phase 1 (US-001): removed routers — chat, snapshots, chapter_snapshots,
export, observability, ai_review, agents, context, workflows, tasks,
metrics. Skipped routers (broken imports of deleted models) — chapters,
settings_entities. Routes re-added under US-002 through US-013.

Phase 1.5 (M2 mechanism): added chat_ws router (WebSocket) at root prefix
to match frontend ChatWebSocketClient URL (ws://host/ws/chat/{id}).
"""
from __future__ import annotations

from fastapi import APIRouter

from app.routers import health, projects
from app.routers.ai_generate import router as ai_generate_router
from app.routers.ai_generate_entity import (
    router as ai_generate_entity_router,
    tools_router as ai_tools_router,
)
from app.routers.ai_review import router as ai_review_router
from app.routers.ai_fill_fields import router as ai_fill_fields_router
from app.routers.ai_rewrite_description import router as ai_rewrite_description_router
from app.routers.ai_provider import router as ai_provider_router
from app.routers.settings_entities import (
    characters_router,
    factions_router,
    items_router,
    locations_router,
    rules_router,
    world_settings_router,
)
from app.routers.outlines import outlines_router
from app.routers.chapters import chapters_router
from app.routers.drafts import drafts_router
from app.routers.chat import router as chat_router
from app.routers.chat_ws import router as chat_ws_router
from app.routers.if_minimal import router as if_minimal_router
from app.routers.context import router as context_router
from app.routers.engagement import router as engagement_router
from app.routers.pacing import router as pacing_router
from app.routers.observability import router as observability_router

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(health.router)
api_router.include_router(projects.router)
api_router.include_router(ai_generate_router)
api_router.include_router(ai_generate_entity_router)
api_router.include_router(ai_tools_router)
api_router.include_router(ai_review_router)
api_router.include_router(ai_fill_fields_router)
api_router.include_router(ai_rewrite_description_router)
api_router.include_router(characters_router)
api_router.include_router(items_router)
api_router.include_router(locations_router)
api_router.include_router(factions_router)
api_router.include_router(world_settings_router)
api_router.include_router(rules_router)
api_router.include_router(ai_provider_router)
api_router.include_router(outlines_router)
api_router.include_router(chapters_router)
api_router.include_router(drafts_router)
api_router.include_router(chat_router)
api_router.include_router(if_minimal_router)
api_router.include_router(context_router)
api_router.include_router(engagement_router)
api_router.include_router(pacing_router)
api_router.include_router(observability_router)

# WebSocket routes are mounted on the bare FastAPI app (not under /api/v1)
# so the frontend ChatWebSocketClient URL ws://host:port/ws/chat/{id} resolves
# directly. See app/main.py for the include_router(chat_ws_router) call.
__all__ = ["api_router", "chat_ws_router"]
