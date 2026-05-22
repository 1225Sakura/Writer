# Auto Novel Writer - World Setting Routes

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.api.v1.dependencies import get_event_bus
from backend.core.domain.schemas.request_schemas import (
    WorldSettingCreateRequest,
    WorldSettingUpdateRequest,
)
from backend.core.domain.schemas.response_schemas import WorldSettingResponse
from backend.core.services.world_setting.world_setting_service import WorldSettingService
from backend.api.v1.endpoints.settings import (
    _prepare_create_data,
    _prepare_update_data,
    _attach_tags_to_response,
)

router = APIRouter()


def get_world_setting_service(db: AsyncSession = Depends(get_db)) -> WorldSettingService:
    """Dependency to inject WorldSettingService."""
    return WorldSettingService(db, get_event_bus(), get_cache_service())


@router.get(
    "/world",
    response_model=List[WorldSettingResponse],
    summary="列出所有世界观设定",
    description="获取所有世界观设定的列表。",
)
async def list_world_settings(
    skip: int = 0,
    limit: int = 100,
    service: WorldSettingService = Depends(get_world_setting_service)
):
    """List all world settings."""
    settings = await service.list_world_settings(skip=skip, limit=limit)
    for setting in settings:
        _attach_tags_to_response(setting)
    return settings


@router.post(
    "/world",
    response_model=WorldSettingResponse,
    summary="创建世界观设定",
    description="创建新的世界观设定。",
)
async def create_world_setting(
    setting: WorldSettingCreateRequest,
    service: WorldSettingService = Depends(get_world_setting_service)
):
    """Create a new world setting."""
    data = _prepare_create_data(setting)
    db_setting = await service.create_world_setting(data)
    _attach_tags_to_response(db_setting)
    get_cache_service().clear_entity_cache("world_setting")
    return db_setting


@router.get(
    "/world/{setting_id}",
    response_model=WorldSettingResponse,
    summary="获取世界观设定详情",
    description="获取指定ID的世界观设定详细信息。",
)
async def get_world_setting(
    setting_id: int,
    service: WorldSettingService = Depends(get_world_setting_service)
):
    """Get a specific world setting by ID."""
    setting = await service.get_world_setting(setting_id)
    if not setting:
        raise HTTPException(status_code=404, detail="World setting not found")
    _attach_tags_to_response(setting)
    return setting


@router.patch(
    "/world/{setting_id}",
    response_model=WorldSettingResponse,
    summary="更新世界观设定",
    description="更新指定ID的世界观设定。",
)
async def update_world_setting(
    setting_id: int,
    setting: WorldSettingUpdateRequest,
    service: WorldSettingService = Depends(get_world_setting_service)
):
    """Update a world setting."""
    db_setting = await service.update_world_setting(setting_id, _prepare_update_data(setting))
    if not db_setting:
        raise HTTPException(status_code=404, detail="World setting not found")
    _attach_tags_to_response(db_setting)
    get_cache_service().clear_entity_cache("world_setting")
    return db_setting


@router.delete(
    "/world/{setting_id}",
    summary="删除世界观设定",
    description="删除指定ID的世界观设定。",
)
async def delete_world_setting(
    setting_id: int,
    service: WorldSettingService = Depends(get_world_setting_service)
):
    """Delete a world setting."""
    deleted = await service.delete_world_setting(setting_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="World setting not found")
    get_cache_service().clear_entity_cache("world_setting")
    return {"message": "World setting deleted"}
