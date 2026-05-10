# Auto Novel Writer - Settings Routes
# Interface 2: World settings management

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
import json

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.core.domain import (
    Character, CharacterRelationship, CharacterStoryline,
    Item, Location, Faction, WorldSetting, Rule,
    WritingSettings
)
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.core.services.character.character_service import CharacterService
from backend.api.v1.dependencies import get_event_bus
from backend.middleware.auth import require_auth
from backend.core.domain.schemas.request_schemas import (
    CharacterCreateRequest,
    CharacterUpdateRequest,
    CharacterRelationshipCreateRequest,
    CharacterStorylineCreateRequest,
    ItemCreateRequest,
    ItemUpdateRequest,
    LocationCreateRequest,
    LocationUpdateRequest,
    FactionCreateRequest,
    FactionUpdateRequest,
    WorldSettingCreateRequest,
    WorldSettingUpdateRequest,
    RuleCreateRequest,
    RuleUpdateRequest,
    WritingSettingsUpdateRequest,
    ExportDataRequest,
)
from backend.core.domain.schemas.response_schemas import (
    CharacterResponse,
    CharacterRelationshipResponse,
    CharacterStorylineResponse,
    ItemResponse,
    LocationResponse,
    FactionResponse,
    WorldSettingResponse,
    RuleResponse,
    WritingSettingsResponse,
    ExportDataResponse,
)
from backend.core.domain.schemas.common_schemas import MessageResponse
from backend.core.services.item.item_service import ItemService
from backend.core.services.location.location_service import LocationService
from backend.core.services.faction.faction_service import FactionService
from backend.core.services.world_setting.world_setting_service import WorldSettingService
from backend.core.services.rule.rule_service import RuleService
from backend.core.services.writing_settings.writing_settings_service import WritingSettingsService

def get_character_service(db: AsyncSession = Depends(get_db)) -> CharacterService:
    """Dependency to inject CharacterService with event bus and cache."""
    return CharacterService(db, get_event_bus(), get_cache_service())


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


router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[require_auth])


# ---------------------------------------------------------------------------
# Character endpoints (use CharacterService)
# ---------------------------------------------------------------------------

@router.get(
    "/characters",
    response_model=List[CharacterResponse],
    summary="列出所有角色",
    description="获取所有角色的列表，支持按等级过滤。",
)
async def list_characters(
    skip: int = 0,
    limit: int = 100,
    tier: Optional[str] = None,
    service: CharacterService = Depends(get_character_service)
):
    """List all characters with optional filtering."""
    return await service.list_characters(skip=skip, limit=limit, tier=tier)


@router.post(
    "/characters",
    response_model=CharacterResponse,
    summary="创建角色",
    description="创建新的角色设定。",
)
async def create_character(
    character: CharacterCreateRequest,
    service: CharacterService = Depends(get_character_service)
):
    """Create a new character."""
    return await service.create_character(character.model_dump())


@router.get(
    "/characters/{character_id}",
    response_model=CharacterResponse,
    summary="获取角色详情",
    description="获取指定ID的角色详细信息。",
)
async def get_character(
    character_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """Get a specific character."""
    character = await service.get_character(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@router.patch(
    "/characters/{character_id}",
    response_model=CharacterResponse,
    summary="更新角色",
    description="更新指定ID的角色信息。",
)
async def update_character(
    character_id: int,
    character: CharacterUpdateRequest,
    service: CharacterService = Depends(get_character_service)
):
    """Update a character."""
    db_character = await service.update_character(
        character_id, character.model_dump(exclude_unset=True)
    )
    if not db_character:
        raise HTTPException(status_code=404, detail="Character not found")
    return db_character


@router.delete(
    "/characters/{character_id}",
    response_model=MessageResponse,
    summary="删除角色",
    description="删除指定ID的角色。",
)
async def delete_character(
    character_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """Delete a character."""
    deleted = await service.delete_character(character_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Character not found")
    return {"message": "Character deleted"}


# Character relationships
@router.get(
    "/characters/{character_id}/relationships",
    response_model=List[CharacterRelationshipResponse],
    summary="列出角色关系",
    description="获取指定角色的所有关系列表。",
)
async def list_character_relationships(
    character_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """List all relationships for a character."""
    return await service.get_relationships(character_id)


@router.post(
    "/characters/{character_id}/relationships",
    response_model=CharacterRelationshipResponse,
    summary="创建角色关系",
    description="为指定角色创建新的关系。",
)
async def create_character_relationship(
    character_id: int,
    relationship: CharacterRelationshipCreateRequest,
    service: CharacterService = Depends(get_character_service)
):
    """Create a relationship for a character."""
    return await service.create_relationship(relationship.model_dump())


@router.delete(
    "/characters/{character_id}/relationships/{relationship_id}",
    response_model=MessageResponse,
    summary="删除角色关系",
    description="删除指定角色关系。",
)
async def delete_character_relationship(
    character_id: int,
    relationship_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """Delete a character relationship."""
    deleted = await service.delete_relationship(character_id, relationship_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return {"message": "Relationship deleted"}


# Character storylines
@router.get(
    "/characters/{character_id}/storylines",
    response_model=List[CharacterStorylineResponse],
    summary="列出角色故事线",
    description="获取指定角色的所有故事线列表。",
)
async def list_character_storylines(
    character_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """List all storylines for a character."""
    return await service.get_storylines(character_id)


@router.post(
    "/characters/{character_id}/storylines",
    response_model=CharacterStorylineResponse,
    summary="创建角色故事线",
    description="为指定角色创建新的故事线。",
)
async def create_character_storyline(
    character_id: int,
    storyline: CharacterStorylineCreateRequest,
    service: CharacterService = Depends(get_character_service)
):
    """Create a storyline for a character."""
    return await service.create_storyline(storyline.model_dump())


@router.patch(
    "/characters/{character_id}/storylines/{storyline_id}",
    response_model=CharacterStorylineResponse,
    summary="更新角色故事线",
    description="更新指定角色故事线。",
)
async def update_character_storyline(
    character_id: int,
    storyline_id: int,
    storyline: CharacterStorylineCreateRequest,
    service: CharacterService = Depends(get_character_service)
):
    """Update a character storyline."""
    updated = await service.update_storyline(character_id, storyline_id, storyline.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Storyline not found")
    return updated


@router.delete(
    "/characters/{character_id}/storylines/{storyline_id}",
    response_model=MessageResponse,
    summary="删除角色故事线",
    description="删除指定角色故事线。",
)
async def delete_character_storyline(
    character_id: int,
    storyline_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """Delete a character storyline."""
    deleted = await service.delete_storyline(character_id, storyline_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Storyline not found")
    return {"message": "Storyline deleted"}


# ---------------------------------------------------------------------------
# Item endpoints (use ItemService)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Location endpoints (use LocationService)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Faction endpoints (use FactionService)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# World Setting endpoints (use WorldSettingService)
# ---------------------------------------------------------------------------

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


# ---------------------------------------------------------------------------
# Rule endpoints (use RuleService)
# ---------------------------------------------------------------------------

def get_rule_service(db: AsyncSession = Depends(get_db)) -> RuleService:
    """Dependency to inject RuleService."""
    return RuleService(db, get_event_bus(), get_cache_service())


@router.get(
    "/rules",
    response_model=List[RuleResponse],
    summary="列出所有规则",
    description="获取所有规则的列表，支持按类型过滤。",
)
async def list_rules(
    skip: int = 0,
    limit: int = 100,
    type: Optional[str] = None,
    service: RuleService = Depends(get_rule_service)
):
    """List all rules."""
    if type:
        rules = await service.list_rules(skip=skip, limit=limit, type=type)
    else:
        rules = await service.list_rules(skip=skip, limit=limit)
    for rule in rules:
        _attach_tags_to_response(rule)
    return rules


@router.post(
    "/rules",
    response_model=RuleResponse,
    summary="创建规则",
    description="创建新的规则设定。",
)
async def create_rule(
    rule: RuleCreateRequest,
    service: RuleService = Depends(get_rule_service)
):
    """Create a new rule."""
    data = _prepare_create_data(rule)
    db_rule = await service.create_rule(data)
    _attach_tags_to_response(db_rule)
    get_cache_service().clear_entity_cache("rule")
    return db_rule


@router.get(
    "/rules/{rule_id}",
    response_model=RuleResponse,
    summary="获取规则详情",
    description="获取指定ID的规则详细信息。",
)
async def get_rule(
    rule_id: int,
    service: RuleService = Depends(get_rule_service)
):
    """Get a specific rule by ID."""
    rule = await service.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    _attach_tags_to_response(rule)
    return rule


@router.patch(
    "/rules/{rule_id}",
    response_model=RuleResponse,
    summary="更新规则",
    description="更新指定ID的规则信息。",
)
async def update_rule(
    rule_id: int,
    rule: RuleUpdateRequest,
    service: RuleService = Depends(get_rule_service)
):
    """Update a rule."""
    db_rule = await service.update_rule(rule_id, _prepare_update_data(rule))
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    _attach_tags_to_response(db_rule)
    get_cache_service().clear_entity_cache("rule")
    return db_rule


@router.delete(
    "/rules/{rule_id}",
    response_model=MessageResponse,
    summary="删除规则",
    description="删除指定ID的规则。",
)
async def delete_rule(
    rule_id: int,
    service: RuleService = Depends(get_rule_service)
):
    """Delete a rule."""
    deleted = await service.delete_rule(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")
    get_cache_service().clear_entity_cache("rule")
    return {"message": "Rule deleted"}


# ---------------------------------------------------------------------------
# Writing Settings endpoints (use WritingSettingsService)
# ---------------------------------------------------------------------------

def get_writing_settings_service(db: AsyncSession = Depends(get_db)) -> WritingSettingsService:
    """Dependency to inject WritingSettingsService."""
    return WritingSettingsService(db, get_event_bus(), get_cache_service())


@router.get(
    "/writing",
    response_model=WritingSettingsResponse,
    summary="获取写作设定",
    description="获取当前的写作设定配置。如不存在则创建默认值。",
)
async def get_writing_settings(
    service: WritingSettingsService = Depends(get_writing_settings_service)
):
    """Get current writing settings."""
    return await service.get_writing_settings()


@router.patch(
    "/writing",
    response_model=WritingSettingsResponse,
    summary="更新写作设定",
    description="更新写作设定配置。",
)
async def update_writing_settings(
    updates: WritingSettingsUpdateRequest,
    service: WritingSettingsService = Depends(get_writing_settings_service)
):
    """Update writing settings."""
    settings = await service.get_writing_settings()
    db_settings = await service.update_writing_settings(settings.id, updates.model_dump(exclude_unset=True))
    if db_settings:
        get_cache_service().clear_entity_cache("writing_settings")
    return db_settings or settings


# ---------------------------------------------------------------------------
# Export/Import for backup and migration
# ---------------------------------------------------------------------------

@router.get(
    "/export",
    response_model=ExportDataResponse,
    summary="导出项目数据",
    description="将所有项目数据导出为JSON格式，用于备份和迁移。",
)
async def export_data(
    character_service: CharacterService = Depends(get_character_service),
    item_service: ItemService = Depends(get_item_service),
    location_service: LocationService = Depends(get_location_service),
    faction_service: FactionService = Depends(get_faction_service),
    world_service: WorldSettingService = Depends(get_world_setting_service),
    rule_service: RuleService = Depends(get_rule_service),
    writing_service: WritingSettingsService = Depends(get_writing_settings_service),
):
    """Export all project data as JSON."""
    characters = await character_service.list_all_characters()
    relationships = await character_service.list_all_relationships()
    storylines = await character_service.list_all_storylines()
    items = await item_service.list_items(limit=10000)
    locations = await location_service.list_locations(limit=10000)
    factions = await faction_service.list_factions(limit=10000)
    world_settings = await world_service.list_world_settings(limit=10000)
    rules = await rule_service.list_rules(limit=10000)
    writing_settings = await writing_service.get_writing_settings()

    return ExportDataResponse(
        version="1.0",
        exported_at=datetime.utcnow().isoformat(),
        characters=[{**c.__dict__, '_type': 'character'} for c in characters],
        character_relationships=[{**r.__dict__, '_type': 'relationship'} for r in relationships],
        character_storylines=[{**s.__dict__, '_type': 'storyline'} for s in storylines],
        items=[{**i.__dict__, '_type': 'item'} for i in items],
        locations=[{**l.__dict__, '_type': 'location'} for l in locations],
        factions=[{**f.__dict__, '_type': 'faction'} for f in factions],
        world_settings=[{**w.__dict__, '_type': 'world_setting'} for w in world_settings],
        rules=[{**r.__dict__, '_type': 'rule'} for r in rules],
        writing_settings=writing_settings.__dict__ if writing_settings else None,
    )


@router.post(
    "/import",
    summary="导入项目数据",
    description="从JSON格式导入项目数据，支持关系映射和循环引用处理。",
)
async def import_data(
    data: ExportDataRequest,
    character_service: CharacterService = Depends(get_character_service),
    item_service: ItemService = Depends(get_item_service),
    location_service: LocationService = Depends(get_location_service),
    faction_service: FactionService = Depends(get_faction_service),
    world_service: WorldSettingService = Depends(get_world_setting_service),
    rule_service: RuleService = Depends(get_rule_service),
):
    """Import project data from JSON with relationship support."""
    imported_count = {
        'characters': 0,
        'character_relationships': 0,
        'character_storylines': 0,
        'items': 0,
        'locations': 0,
        'factions': 0,
        'world_settings': 0,
        'rules': 0,
    }

    if data.version != "1.0":
        raise HTTPException(status_code=400, detail=f"Unsupported export version: {data.version}")

    id_mapping: dict[int, int] = {}

    # Import characters first and build ID mapping
    for char_data in data.characters:
        char_data_clean = {k: v for k, v in char_data.items()
                          if k not in ('_type', 'id', 'created_at', 'updated_at')}
        char = await character_service.create_character(char_data_clean)
        old_id = char_data.get('id')
        if old_id is not None:
            id_mapping[old_id] = char.id
        imported_count['characters'] += 1

    # Import character relationships (with circular reference handling)
    remaining_relationships = list(data.character_relationships)
    max_passes = len(data.characters) + 1
    for _ in range(max_passes):
        if not remaining_relationships:
            break
        unresolved = []
        for rel_data in remaining_relationships:
            old_char_id = rel_data.get('character_id')
            old_target_id = rel_data.get('target_id')
            if old_char_id in id_mapping and old_target_id in id_mapping:
                rel_clean = {k: v for k, v in rel_data.items()
                            if k not in ('_type', 'id', 'created_at', 'updated_at')}
                rel_clean['character_id'] = id_mapping[old_char_id]
                rel_clean['target_id'] = id_mapping[old_target_id]
                await character_service.create_relationship(rel_clean)
                imported_count['character_relationships'] += 1
            else:
                unresolved.append(rel_data)
        remaining_relationships = unresolved

    # Import character storylines
    for story_data in data.character_storylines:
        old_char_id = story_data.get('character_id')
        if old_char_id in id_mapping:
            story_clean = {k: v for k, v in story_data.items()
                          if k not in ('_type', 'id', 'created_at', 'updated_at')}
            story_clean['character_id'] = id_mapping[old_char_id]
            await character_service.create_storyline(story_clean)
            imported_count['character_storylines'] += 1

    # Import items
    for item_data in data.items:
        item_clean = {k: v for k, v in item_data.items()
                     if k not in ('_type', 'id', 'created_at', 'updated_at')}
        await item_service.create_item(item_clean)
        imported_count['items'] += 1

    # Import locations
    for loc_data in data.locations:
        loc_clean = {k: v for k, v in loc_data.items()
                    if k not in ('_type', 'id', 'created_at', 'updated_at')}
        await location_service.create_location(loc_clean)
        imported_count['locations'] += 1

    # Import factions
    for fac_data in data.factions:
        fac_clean = {k: v for k, v in fac_data.items()
                    if k not in ('_type', 'id', 'created_at', 'updated_at')}
        await faction_service.create_faction(fac_clean)
        imported_count['factions'] += 1

    # Import world settings
    for ws_data in data.world_settings:
        ws_clean = {k: v for k, v in ws_data.items()
                   if k not in ('_type', 'id', 'created_at', 'updated_at')}
        await world_service.create_world_setting(ws_clean)
        imported_count['world_settings'] += 1

    # Import rules
    for rule_data in data.rules:
        rule_clean = {k: v for k, v in rule_data.items()
                     if k not in ('_type', 'id', 'created_at', 'updated_at')}
        await rule_service.create_rule(rule_clean)
        imported_count['rules'] += 1

    return {
        "message": "Import successful",
        "imported": imported_count
    }
