"""Item, Location, and Character CRUD routes."""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.exceptions import NotFoundException
from app.dependencies import (
    get_character_service,
    get_faction_service,
    get_item_service,
    get_location_service,
    get_rule_service,
    get_world_setting_service,
)
from app.schemas import (
    ApiResponse,
    CharacterCreate,
    CharacterOut,
    CharacterUpdate,
    FactionCreate,
    FactionOut,
    FactionUpdate,
    ItemCreate,
    ItemOut,
    ItemUpdate,
    LocationCreate,
    LocationOut,
    LocationUpdate,
    RuleCreate,
    RuleOut,
    RuleUpdate,
    WorldSettingCreate,
    WorldSettingOut,
    WorldSettingUpdate,
)
from app.services.character import CharacterService
from app.services.faction import FactionService
from app.services.item import ItemService
from app.services.location import LocationService
from app.services.rule import RuleService
from app.services.world_setting import WorldSettingService

items_router = APIRouter(prefix="/settings/items", tags=["Settings"])
locations_router = APIRouter(prefix="/settings/locations", tags=["Settings"])
characters_router = APIRouter(prefix="/settings/characters", tags=["Settings — Characters"])
factions_router = APIRouter(prefix="/settings/factions", tags=["Settings — Factions"])
world_settings_router = APIRouter(prefix="/settings/world-settings", tags=["Settings — World Settings"])
rules_router = APIRouter(prefix="/settings/rules", tags=["Settings — Rules"])


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


# Factions
@factions_router.get("")
def list_factions(
    project_id: int | None = None,
    svc: FactionService = Depends(get_faction_service),
) -> ApiResponse[list]:
    factions = svc.list(project_id=project_id)
    return ApiResponse(data=[FactionOut.model_validate(faction).model_dump() for faction in factions])


@factions_router.post("")
def create_faction(
    data: FactionCreate,
    svc: FactionService = Depends(get_faction_service),
) -> ApiResponse[dict]:
    faction = svc.create(data, project_id=data.project_id)
    return ApiResponse(data=FactionOut.model_validate(faction).model_dump())


@factions_router.get("/{faction_id}")
def get_faction(
    faction_id: int,
    svc: FactionService = Depends(get_faction_service),
) -> ApiResponse[dict]:
    faction = svc.get(faction_id)
    if not faction:
        raise NotFoundException("Faction", faction_id)
    return ApiResponse(data=FactionOut.model_validate(faction).model_dump())


@factions_router.patch("/{faction_id}")
def update_faction(
    faction_id: int,
    data: FactionUpdate,
    svc: FactionService = Depends(get_faction_service),
) -> ApiResponse[dict]:
    faction = svc.update(faction_id, data)
    if not faction:
        raise NotFoundException("Faction", faction_id)
    return ApiResponse(data=FactionOut.model_validate(faction).model_dump())


@factions_router.delete("/{faction_id}")
def delete_faction(
    faction_id: int,
    svc: FactionService = Depends(get_faction_service),
) -> ApiResponse[dict]:
    if not svc.delete(faction_id):
        raise NotFoundException("Faction", faction_id)
    return ApiResponse(message="Faction deleted")


# World settings
@world_settings_router.get("")
def list_world_settings(
    project_id: int | None = None,
    svc: WorldSettingService = Depends(get_world_setting_service),
) -> ApiResponse[list]:
    world_settings = svc.list(project_id=project_id)
    return ApiResponse(
        data=[WorldSettingOut.model_validate(item).model_dump() for item in world_settings]
    )


@world_settings_router.post("")
def create_world_setting(
    data: WorldSettingCreate,
    svc: WorldSettingService = Depends(get_world_setting_service),
) -> ApiResponse[dict]:
    world_setting = svc.create(data, project_id=data.project_id)
    return ApiResponse(data=WorldSettingOut.model_validate(world_setting).model_dump())


@world_settings_router.get("/{world_setting_id}")
def get_world_setting(
    world_setting_id: int,
    svc: WorldSettingService = Depends(get_world_setting_service),
) -> ApiResponse[dict]:
    world_setting = svc.get(world_setting_id)
    if not world_setting:
        raise NotFoundException("WorldSetting", world_setting_id)
    return ApiResponse(data=WorldSettingOut.model_validate(world_setting).model_dump())


@world_settings_router.patch("/{world_setting_id}")
def update_world_setting(
    world_setting_id: int,
    data: WorldSettingUpdate,
    svc: WorldSettingService = Depends(get_world_setting_service),
) -> ApiResponse[dict]:
    world_setting = svc.update(world_setting_id, data)
    if not world_setting:
        raise NotFoundException("WorldSetting", world_setting_id)
    return ApiResponse(data=WorldSettingOut.model_validate(world_setting).model_dump())


@world_settings_router.delete("/{world_setting_id}")
def delete_world_setting(
    world_setting_id: int,
    svc: WorldSettingService = Depends(get_world_setting_service),
) -> ApiResponse[dict]:
    if not svc.delete(world_setting_id):
        raise NotFoundException("WorldSetting", world_setting_id)
    return ApiResponse(message="World setting deleted")


# Rules
@rules_router.get("")
def list_rules(
    project_id: int | None = None,
    svc: RuleService = Depends(get_rule_service),
) -> ApiResponse[list]:
    rules = svc.list(project_id=project_id)
    return ApiResponse(data=[RuleOut.model_validate(rule).model_dump() for rule in rules])


@rules_router.post("")
def create_rule(
    data: RuleCreate,
    svc: RuleService = Depends(get_rule_service),
) -> ApiResponse[dict]:
    rule = svc.create(data, project_id=data.project_id)
    return ApiResponse(data=RuleOut.model_validate(rule).model_dump())


@rules_router.get("/{rule_id}")
def get_rule(
    rule_id: int,
    svc: RuleService = Depends(get_rule_service),
) -> ApiResponse[dict]:
    rule = svc.get(rule_id)
    if not rule:
        raise NotFoundException("Rule", rule_id)
    return ApiResponse(data=RuleOut.model_validate(rule).model_dump())


@rules_router.patch("/{rule_id}")
def update_rule(
    rule_id: int,
    data: RuleUpdate,
    svc: RuleService = Depends(get_rule_service),
) -> ApiResponse[dict]:
    rule = svc.update(rule_id, data)
    if not rule:
        raise NotFoundException("Rule", rule_id)
    return ApiResponse(data=RuleOut.model_validate(rule).model_dump())


@rules_router.delete("/{rule_id}")
def delete_rule(
    rule_id: int,
    svc: RuleService = Depends(get_rule_service),
) -> ApiResponse[dict]:
    if not svc.delete(rule_id):
        raise NotFoundException("Rule", rule_id)
    return ApiResponse(message="Rule deleted")
