# Auto Novel Writer - Location Settings Routes

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.api.v1.dependencies import get_event_bus
from backend.core.domain.schemas.request_schemas import (
    LocationCreateRequest,
    LocationUpdateRequest,
)
from backend.core.domain.schemas.response_schemas import LocationResponse
from backend.core.domain.schemas.common_schemas import MessageResponse
from backend.core.services.location.location_service import LocationService
from backend.api.v1.endpoints.settings import (
    _prepare_create_data,
    _prepare_update_data,
    _attach_tags_to_response,
)

router = APIRouter()


def get_location_service(db: AsyncSession = Depends(get_db)) -> LocationService:
    """Dependency to inject LocationService."""
    return LocationService(db, get_event_bus(), get_cache_service())


@router.get(
    "/locations",
    response_model=List[LocationResponse],
    summary="列出所有地点",
    description="获取所有地点的列表，支持按重要性过滤。",
)
async def list_locations(
    skip: int = 0,
    limit: int = 100,
    importance: Optional[str] = None,
    service: LocationService = Depends(get_location_service)
):
    """List all locations."""
    if importance:
        locations = await service.list_locations(skip=skip, limit=limit, importance=importance)
    else:
        locations = await service.list_locations(skip=skip, limit=limit)
    for location in locations:
        _attach_tags_to_response(location)
    return locations


@router.post(
    "/locations",
    response_model=LocationResponse,
    summary="创建地点",
    description="创建新的地点设定。",
)
async def create_location(
    location: LocationCreateRequest,
    service: LocationService = Depends(get_location_service)
):
    """Create a new location."""
    data = _prepare_create_data(location)
    db_location = await service.create_location(data)
    _attach_tags_to_response(db_location)
    get_cache_service().clear_entity_cache("location")
    return db_location


@router.get(
    "/locations/{location_id}",
    response_model=LocationResponse,
    summary="获取地点详情",
    description="获取指定ID的地点详细信息。",
)
async def get_location(
    location_id: int,
    service: LocationService = Depends(get_location_service)
):
    """Get a specific location by ID."""
    location = await service.get_location(location_id)
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    _attach_tags_to_response(location)
    return location


@router.patch(
    "/locations/{location_id}",
    response_model=LocationResponse,
    summary="更新地点",
    description="更新指定ID的地点信息。",
)
async def update_location(
    location_id: int,
    location: LocationUpdateRequest,
    service: LocationService = Depends(get_location_service)
):
    """Update a location."""
    db_location = await service.update_location(location_id, _prepare_update_data(location))
    if not db_location:
        raise HTTPException(status_code=404, detail="Location not found")
    _attach_tags_to_response(db_location)
    get_cache_service().clear_entity_cache("location")
    return db_location


@router.delete(
    "/locations/{location_id}",
    response_model=MessageResponse,
    summary="删除地点",
    description="删除指定ID的地点。",
)
async def delete_location(
    location_id: int,
    service: LocationService = Depends(get_location_service)
):
    """Delete a location."""
    deleted = await service.delete_location(location_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Location not found")
    get_cache_service().clear_entity_cache("location")
    return {"message": "Location deleted"}
