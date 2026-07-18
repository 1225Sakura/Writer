"""Register all routers in FastAPI app.

Phase 1 (US-001): removed routers — chat, snapshots, chapter_snapshots,
export, observability, ai_review, agents, context, workflows, tasks,
metrics. Skipped routers (broken imports of deleted models) — chapters,
settings_entities. Routes re-added under US-002 through US-013.
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
