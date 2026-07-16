"""Item, Location, and Character CRUD routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.exceptions import NotFoundException
from app.dependencies import (
    get_character_service,
    get_item_service,
    get_location_service,
)
from app.schemas import (
    ApiResponse,
    CharacterCreate,
    CharacterOut,
    CharacterUpdate,
    ItemCreate,
    ItemOut,
    ItemUpdate,
    LocationCreate,
    LocationOut,
    LocationUpdate,
)
from app.services.character import CharacterService
from app.services.item import ItemService
from app.services.location import LocationService

items_router = APIRouter(prefix="/settings/items", tags=["Settings"])
locations_router = APIRouter(prefix="/settings/locations", tags=["Settings"])
characters_router = APIRouter(prefix="/settings/characters", tags=["Settings — Characters"])


# Items
@items_router.get("")
def list_items(
    project_id: int | None = None,
    svc: ItemService = Depends(get_item_service),
) -> ApiResponse[list]:
    items = svc.list(project_id=project_id)
    return ApiResponse(data=[ItemOut.model_validate(item).model_dump() for item in items])


@items_router.post("")
def create_item(
    data: ItemCreate,
    svc: ItemService = Depends(get_item_service),
) -> ApiResponse[dict]:
    item = svc.create(data, project_id=data.project_id)
    return ApiResponse(data=ItemOut.model_validate(item).model_dump())


@items_router.get("/{item_id}")
def get_item(
    item_id: int,
    svc: ItemService = Depends(get_item_service),
) -> ApiResponse[dict]:
    item = svc.get(item_id)
    if not item:
        raise NotFoundException("Item", item_id)
    return ApiResponse(data=ItemOut.model_validate(item).model_dump())


@items_router.patch("/{item_id}")
def update_item(
    item_id: int,
    data: ItemUpdate,
    svc: ItemService = Depends(get_item_service),
) -> ApiResponse[dict]:
    item = svc.update(item_id, data)
    if not item:
        raise NotFoundException("Item", item_id)
    return ApiResponse(data=ItemOut.model_validate(item).model_dump())


@items_router.delete("/{item_id}")
def delete_item(
    item_id: int,
    svc: ItemService = Depends(get_item_service),
) -> ApiResponse[dict]:
    if not svc.delete(item_id):
        raise NotFoundException("Item", item_id)
    return ApiResponse(message="Item deleted")


# Locations
@locations_router.get("")
def list_locations(
    project_id: int | None = None,
    svc: LocationService = Depends(get_location_service),
) -> ApiResponse[list]:
    locations = svc.list(project_id=project_id)
    return ApiResponse(
        data=[LocationOut.model_validate(location).model_dump() for location in locations]
    )


@locations_router.post("")
def create_location(
    data: LocationCreate,
    svc: LocationService = Depends(get_location_service),
) -> ApiResponse[dict]:
    location = svc.create(data, project_id=data.project_id)
    return ApiResponse(data=LocationOut.model_validate(location).model_dump())


@locations_router.get("/{loc_id}")
def get_location(
    loc_id: int,
    svc: LocationService = Depends(get_location_service),
) -> ApiResponse[dict]:
    location = svc.get(loc_id)
    if not location:
        raise NotFoundException("Location", loc_id)
    return ApiResponse(data=LocationOut.model_validate(location).model_dump())


@locations_router.patch("/{loc_id}")
def update_location(
    loc_id: int,
    data: LocationUpdate,
    svc: LocationService = Depends(get_location_service),
) -> ApiResponse[dict]:
    location = svc.update(loc_id, data)
    if not location:
        raise NotFoundException("Location", loc_id)
    return ApiResponse(data=LocationOut.model_validate(location).model_dump())


@locations_router.delete("/{loc_id}")
def delete_location(
    loc_id: int,
    svc: LocationService = Depends(get_location_service),
) -> ApiResponse[dict]:
    if not svc.delete(loc_id):
        raise NotFoundException("Location", loc_id)
    return ApiResponse(message="Location deleted")


# Characters
@characters_router.get("")
def list_characters(
    project_id: int | None = None,
    svc: CharacterService = Depends(get_character_service),
) -> ApiResponse[list]:
    characters = svc.list(project_id=project_id)
    return ApiResponse(
        data=[CharacterOut.model_validate(character).model_dump() for character in characters]
    )


@characters_router.post("")
def create_character(
    data: CharacterCreate,
    svc: CharacterService = Depends(get_character_service),
) -> ApiResponse[dict]:
    character = svc.create(data)
    return ApiResponse(data=CharacterOut.model_validate(character).model_dump())


@characters_router.get("/{char_id}")
def get_character(
    char_id: int,
    svc: CharacterService = Depends(get_character_service),
) -> ApiResponse[dict]:
    character = svc.get(char_id)
    if not character:
        raise NotFoundException("Character", char_id)
    return ApiResponse(data=CharacterOut.model_validate(character).model_dump())


@characters_router.patch("/{char_id}")
def update_character(
    char_id: int,
    data: CharacterUpdate,
    svc: CharacterService = Depends(get_character_service),
) -> ApiResponse[dict]:
    character = svc.update(char_id, data)
    if not character:
        raise NotFoundException("Character", char_id)
    return ApiResponse(data=CharacterOut.model_validate(character).model_dump())


@characters_router.delete("/{char_id}")
def delete_character(
    char_id: int,
    svc: CharacterService = Depends(get_character_service),
) -> ApiResponse[dict]:
    if not svc.delete(char_id):
        raise NotFoundException("Character", char_id)
    return ApiResponse(message="Character deleted")
