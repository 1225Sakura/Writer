# Auto Novel Writer - Item Settings Routes

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.api.v1.dependencies import get_event_bus
from backend.core.domain.schemas.request_schemas import (
    ItemCreateRequest,
    ItemUpdateRequest,
)
from backend.core.domain.schemas.response_schemas import ItemResponse
from backend.core.domain.schemas.common_schemas import MessageResponse
from backend.core.services.item.item_service import ItemService
from backend.api.v1.endpoints.settings import (
    _prepare_create_data,
    _prepare_update_data,
    _attach_tags_to_response,
)

router = APIRouter()


def get_item_service(db: AsyncSession = Depends(get_db)) -> ItemService:
    """Dependency to inject ItemService."""
    return ItemService(db, get_event_bus(), get_cache_service())


@router.get(
    "/items",
    response_model=List[ItemResponse],
    summary="列出所有物品",
    description="获取所有物品的列表，支持按所有者过滤。",
)
async def list_items(
    skip: int = 0,
    limit: int = 100,
    owner: Optional[str] = None,
    service: ItemService = Depends(get_item_service)
):
    """List all items."""
    items = await service.list_items(skip=skip, limit=limit, owner=owner)
    for item in items:
        _attach_tags_to_response(item)
    return items


@router.post(
    "/items",
    response_model=ItemResponse,
    summary="创建物品",
    description="创建新的物品设定。",
)
async def create_item(
    item: ItemCreateRequest,
    service: ItemService = Depends(get_item_service)
):
    """Create a new item."""
    data = _prepare_create_data(item)
    db_item = await service.create_item(data)
    _attach_tags_to_response(db_item)
    get_cache_service().clear_entity_cache("item")
    return db_item


@router.get(
    "/items/{item_id}",
    response_model=ItemResponse,
    summary="获取物品详情",
    description="获取指定ID的物品详细信息。",
)
async def get_item(item_id: int, service: ItemService = Depends(get_item_service)):
    """Get a specific item by ID."""
    item = await service.get_item(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    _attach_tags_to_response(item)
    return item


@router.patch(
    "/items/{item_id}",
    response_model=ItemResponse,
    summary="更新物品",
    description="更新指定ID的物品信息。",
)
async def update_item(
    item_id: int,
    item: ItemUpdateRequest,
    service: ItemService = Depends(get_item_service)
):
    """Update an item."""
    db_item = await service.update_item(item_id, _prepare_update_data(item))
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    _attach_tags_to_response(db_item)
    get_cache_service().clear_entity_cache("item")
    return db_item


@router.delete(
    "/items/{item_id}",
    response_model=MessageResponse,
    summary="删除物品",
    description="删除指定ID的物品。",
)
async def delete_item(item_id: int, service: ItemService = Depends(get_item_service)):
    """Delete an item."""
    deleted = await service.delete_item(item_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Item not found")
    get_cache_service().clear_entity_cache("item")
    return {"message": "Item deleted"}
