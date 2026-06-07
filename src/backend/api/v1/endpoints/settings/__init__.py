# Auto Novel Writer - Settings Routes (Package)
# Interface 2: World settings management

import json
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.api.v1.dependencies import get_event_bus
from backend.middleware.auth import require_auth

# ---------------------------------------------------------------------------
# Shared tag helpers
# ---------------------------------------------------------------------------

def _tags_to_json(tags: Optional[List[str]]) -> Optional[str]:
    """Serialize a list of tags to a JSON string for storage."""
    if tags is None:
        return None
    return json.dumps(tags, ensure_ascii=False)


def _json_to_tags(tags_json: Optional[str]) -> Optional[List[str]]:
    """Deserialize a JSON string to a list of tags."""
    if tags_json is None:
        return None
    try:
        return json.loads(tags_json)
    except (json.JSONDecodeError, TypeError):
        return None


def _prepare_create_data(request) -> dict:
    """Prepare creation data with tags JSON serialization."""
    data = request.model_dump()
    if 'tags' in data:
        data['tags'] = _tags_to_json(data.get('tags'))
    return data


def _prepare_update_data(request) -> dict:
    """Prepare update data with tags JSON serialization."""
    data = request.model_dump(exclude_unset=True)
    if 'tags' in data:
        data['tags'] = _tags_to_json(data['tags'])
    return data


def _attach_tags_to_response(entity) -> None:
    """Attach deserialized tags to an entity for response serialization."""
    if hasattr(entity, 'tags'):
        entity.tags = _json_to_tags(entity.tags)


# ---------------------------------------------------------------------------
# Sub-routers
# ---------------------------------------------------------------------------

from backend.api.v1.endpoints.settings.settings_characters import router as characters_router
from backend.api.v1.endpoints.settings.settings_items import router as items_router
from backend.api.v1.endpoints.settings.settings_locations import router as locations_router
from backend.api.v1.endpoints.settings.settings_factions import router as factions_router
from backend.api.v1.endpoints.settings.settings_world import router as world_router
from backend.api.v1.endpoints.settings.settings_rules import router as rules_router
from backend.api.v1.endpoints.settings.settings_writing import router as writing_router
from backend.api.v1.endpoints.settings.settings_ai_provider import router as ai_provider_router
from backend.api.v1.endpoints.settings.settings_relations import router as relations_router

# ---------------------------------------------------------------------------
# Parent router — prefix and tags are set here; sub-routers have neither
# ---------------------------------------------------------------------------

router = APIRouter(
    prefix="/settings",
    tags=["settings"],
    dependencies=[require_auth],
)

router.include_router(characters_router)
router.include_router(items_router)
router.include_router(locations_router)
router.include_router(factions_router)
router.include_router(world_router)
router.include_router(rules_router)
router.include_router(writing_router)
router.include_router(ai_provider_router)
router.include_router(relations_router)
