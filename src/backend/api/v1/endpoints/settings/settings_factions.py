# Auto Novel Writer - Faction Settings Routes

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.api.v1.dependencies import get_event_bus
from backend.core.domain.schemas.request_schemas import (
    FactionCreateRequest,
    FactionUpdateRequest,
)
from backend.core.domain.schemas.response_schemas import FactionResponse
from backend.core.domain.schemas.common_schemas import MessageResponse
from backend.core.services.faction.faction_service import FactionService
from backend.api.v1.endpoints.settings import (
    _prepare_create_data,
    _prepare_update_data,
    _attach_tags_to_response,
)

router = APIRouter()


def get_faction_service(db: AsyncSession = Depends(get_db)) -> FactionService:
    """Dependency to inject FactionService."""
    return FactionService(db, get_event_bus(), get_cache_service())


@router.get(
    "/factions",
    response_model=List[FactionResponse],
    summary="列出所有势力",
    description="获取所有势力的列表，支持按类型过滤。",
)
async def list_factions(
    skip: int = 0,
    limit: int = 100,
    type: Optional[str] = None,
    service: FactionService = Depends(get_faction_service)
):
    """List all factions."""
    if type:
        factions = await service.list_factions(skip=skip, limit=limit, type=type)
    else:
        factions = await service.list_factions(skip=skip, limit=limit)
    for faction in factions:
        _attach_tags_to_response(faction)
    return factions


@router.post(
    "/factions",
    response_model=FactionResponse,
    summary="创建势力",
    description="创建新的势力设定。",
)
async def create_faction(
    faction: FactionCreateRequest,
    service: FactionService = Depends(get_faction_service)
):
    """Create a new faction."""
    data = _prepare_create_data(faction)
    db_faction = await service.create_faction(data)
    _attach_tags_to_response(db_faction)
    get_cache_service().clear_entity_cache("faction")
    return db_faction


@router.get(
    "/factions/{faction_id}",
    response_model=FactionResponse,
    summary="获取势力详情",
    description="获取指定ID的势力详细信息。",
)
async def get_faction(
    faction_id: int,
    service: FactionService = Depends(get_faction_service)
):
    """Get a specific faction by ID."""
    faction = await service.get_faction(faction_id)
    if not faction:
        raise HTTPException(status_code=404, detail="Faction not found")
    _attach_tags_to_response(faction)
    return faction


@router.patch(
    "/factions/{faction_id}",
    response_model=FactionResponse,
    summary="更新势力",
    description="更新指定ID的势力信息。",
)
async def update_faction(
    faction_id: int,
    faction: FactionUpdateRequest,
    service: FactionService = Depends(get_faction_service)
):
    """Update a faction."""
    db_faction = await service.update_faction(faction_id, _prepare_update_data(faction))
    if not db_faction:
        raise HTTPException(status_code=404, detail="Faction not found")
    _attach_tags_to_response(db_faction)
    get_cache_service().clear_entity_cache("faction")
    return db_faction


@router.delete(
    "/factions/{faction_id}",
    response_model=MessageResponse,
    summary="删除势力",
    description="删除指定ID的势力。",
)
async def delete_faction(
    faction_id: int,
    service: FactionService = Depends(get_faction_service)
):
    """Delete a faction."""
    deleted = await service.delete_faction(faction_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Faction not found")
    get_cache_service().clear_entity_cache("faction")
    return {"message": "Faction deleted"}
