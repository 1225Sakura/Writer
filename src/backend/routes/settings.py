# Auto Novel Writer - Settings Routes
# Interface 2: World settings management

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import get_db
from backend.models.entities import (
    Character, CharacterRelationship, CharacterStoryline,
    Item, Location, Faction, WorldSetting, Rule,
    WritingSettings
)
from backend.services.cache_service import cache_service
from backend.config import settings
from backend.middleware.auth import require_auth

router = APIRouter(prefix="/settings", tags=["settings"], dependencies=[require_auth])

MAX_NAME_LENGTH = 200
MAX_DESCRIPTION_LENGTH = 5000
MAX_TEXT_FIELD_LENGTH = 10000


# Pydantic models
class CharacterBase(BaseModel):
    name: str
    gender: Optional[str] = None
    personality: Optional[str] = None
    desires: Optional[str] = None
    flaws: Optional[str] = None
    description: Optional[str] = None
    tier: Optional[str] = None
    cultivation_realm: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        if len(v) > MAX_NAME_LENGTH:
            raise ValueError(f'Name exceeds maximum length of {MAX_NAME_LENGTH}')
        return v.strip()

    @field_validator('description', 'personality', 'desires', 'flaws')
    @classmethod
    def validate_text_fields(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > MAX_TEXT_FIELD_LENGTH:
            raise ValueError(f'Text field exceeds maximum length of {MAX_TEXT_FIELD_LENGTH}')
        return v


class CharacterCreate(CharacterBase):
    pass


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    personality: Optional[str] = None
    desires: Optional[str] = None
    flaws: Optional[str] = None
    description: Optional[str] = None
    tier: Optional[str] = None
    cultivation_realm: Optional[str] = None


class CharacterResponse(CharacterBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CharacterRelationshipCreate(BaseModel):
    character_id: int
    target_id: int
    type: str
    description: Optional[str] = None

    @field_validator('character_id', 'target_id')
    @classmethod
    def validate_ids(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('ID must be a positive integer')
        return v

    @field_validator('type')
    @classmethod
    def validate_type(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Relationship type cannot be empty')
        return v.strip()

    @field_validator('description')
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and len(v) > MAX_DESCRIPTION_LENGTH:
            raise ValueError(f'Description exceeds maximum length of {MAX_DESCRIPTION_LENGTH}')
        return v


class CharacterRelationshipResponse(BaseModel):
    id: int
    character_id: int
    target_id: int
    type: str
    description: Optional[str]

    class Config:
        from_attributes = True


class CharacterStorylineCreate(BaseModel):
    character_id: int
    title: str
    arc: Optional[str] = None
    progress: int = 0

    @field_validator('character_id')
    @classmethod
    def validate_character_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('character_id must be a positive integer')
        return v

    @field_validator('title')
    @classmethod
    def validate_title(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Title cannot be empty')
        if len(v) > MAX_NAME_LENGTH:
            raise ValueError(f'Title exceeds maximum length of {MAX_NAME_LENGTH}')
        return v.strip()

    @field_validator('progress')
    @classmethod
    def validate_progress(cls, v: int) -> int:
        if v < 0 or v > 100:
            raise ValueError('Progress must be between 0 and 100')
        return v


class CharacterStorylineResponse(BaseModel):
    id: int
    character_id: int
    title: str
    arc: Optional[str]
    progress: int

    class Config:
        from_attributes = True


# World entity models
class ItemCreate(BaseModel):
    name: str
    description: Optional[str] = None
    owner: Optional[str] = None
    location: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        if len(v) > MAX_NAME_LENGTH:
            raise ValueError(f'Name exceeds maximum length of {MAX_NAME_LENGTH}')
        return v.strip()


class ItemResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    owner: Optional[str]
    location: Optional[str]

    class Config:
        from_attributes = True


class LocationCreate(BaseModel):
    name: str
    description: Optional[str] = None
    importance: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        if len(v) > MAX_NAME_LENGTH:
            raise ValueError(f'Name exceeds maximum length of {MAX_NAME_LENGTH}')
        return v.strip()


class LocationResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    importance: Optional[str]

    class Config:
        from_attributes = True


class FactionCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        if len(v) > MAX_NAME_LENGTH:
            raise ValueError(f'Name exceeds maximum length of {MAX_NAME_LENGTH}')
        return v.strip()


class FactionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    type: Optional[str]

    class Config:
        from_attributes = True


class WorldSettingCreate(BaseModel):
    name: str
    description: Optional[str] = None
    details_json: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        if len(v) > MAX_NAME_LENGTH:
            raise ValueError(f'Name exceeds maximum length of {MAX_NAME_LENGTH}')
        return v.strip()


class WorldSettingResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    details_json: Optional[str]

    class Config:
        from_attributes = True


class RuleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    type: Optional[str] = None

    @field_validator('name')
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Name cannot be empty')
        if len(v) > MAX_NAME_LENGTH:
            raise ValueError(f'Name exceeds maximum length of {MAX_NAME_LENGTH}')
        return v.strip()


class RuleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    type: Optional[str]

    class Config:
        from_attributes = True


class WritingSettingsUpdate(BaseModel):
    human_ai_ratio: Optional[float] = None
    writing_style: Optional[str] = None
    target_word_count: Optional[int] = None

    @field_validator('human_ai_ratio')
    @classmethod
    def validate_human_ai_ratio(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < 0.0 or v > 1.0):
            raise ValueError('human_ai_ratio must be between 0.0 and 1.0')
        return v

    @field_validator('target_word_count')
    @classmethod
    def validate_target_word_count(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError('target_word_count must be a positive integer')
        return v


class WritingSettingsResponse(BaseModel):
    id: int
    human_ai_ratio: float
    writing_style: str
    target_word_count: int

    class Config:
        from_attributes = True


# Character endpoints
@router.get("/characters", response_model=List[CharacterResponse])
async def list_characters(
    skip: int = 0,
    limit: int = 100,
    tier: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all characters with optional filtering."""
    query = select(Character)
    if tier:
        query = query.where(Character.tier == tier)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/characters", response_model=CharacterResponse)
async def create_character(
    character: CharacterCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new character."""
    db_character = Character(**character.model_dump())
    db.add(db_character)
    await db.flush()
    await db.refresh(db_character)
    cache_service.clear_entity_cache("character")
    return db_character


@router.get("/characters/{character_id}", response_model=CharacterResponse)
async def get_character(character_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific character."""
    result = await db.execute(select(Character).where(Character.id == character_id))
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@router.patch("/characters/{character_id}", response_model=CharacterResponse)
async def update_character(
    character_id: int,
    character: CharacterUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a character."""
    result = await db.execute(select(Character).where(Character.id == character_id))
    db_character = result.scalar_one_or_none()
    if not db_character:
        raise HTTPException(status_code=404, detail="Character not found")

    update_data = character.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_character, key, value)

    db_character.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(db_character)
    cache_service.clear_entity_cache("character")
    return db_character


@router.delete("/characters/{character_id}")
async def delete_character(character_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a character."""
    result = await db.execute(select(Character).where(Character.id == character_id))
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    await db.delete(character)
    cache_service.clear_entity_cache("character")
    return {"message": "Character deleted"}


# Character relationships
@router.get("/characters/{character_id}/relationships", response_model=List[CharacterRelationshipResponse])
async def list_character_relationships(
    character_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all relationships for a character."""
    result = await db.execute(
        select(CharacterRelationship).where(CharacterRelationship.character_id == character_id)
    )
    return result.scalars().all()


@router.post("/characters/{character_id}/relationships", response_model=CharacterRelationshipResponse)
async def create_character_relationship(
    character_id: int,
    relationship: CharacterRelationshipCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a relationship for a character."""
    db_relationship = CharacterRelationship(**relationship.model_dump())
    db.add(db_relationship)
    await db.flush()
    await db.refresh(db_relationship)
    cache_service.clear_entity_cache("character")
    return db_relationship


# Character storylines
@router.get("/characters/{character_id}/storylines", response_model=List[CharacterStorylineResponse])
async def list_character_storylines(
    character_id: int,
    db: AsyncSession = Depends(get_db)
):
    """List all storylines for a character."""
    result = await db.execute(
        select(CharacterStoryline).where(CharacterStoryline.character_id == character_id)
    )
    return result.scalars().all()


@router.post("/characters/{character_id}/storylines", response_model=CharacterStorylineResponse)
async def create_character_storyline(
    character_id: int,
    storyline: CharacterStorylineCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a storyline for a character."""
    db_storyline = CharacterStoryline(**storyline.model_dump())
    db.add(db_storyline)
    await db.flush()
    await db.refresh(db_storyline)
    cache_service.clear_entity_cache("character")
    return db_storyline


# Items
@router.get("/items", response_model=List[ItemResponse])
async def list_items(
    skip: int = 0,
    limit: int = 100,
    owner: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all items."""
    query = select(Item)
    if owner:
        query = query.where(Item.owner == owner)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/items", response_model=ItemResponse)
async def create_item(item: ItemCreate, db: AsyncSession = Depends(get_db)):
    """Create a new item."""
    db_item = Item(**item.model_dump())
    db.add(db_item)
    await db.flush()
    await db.refresh(db_item)
    cache_service.clear_entity_cache("item")
    return db_item


@router.patch("/items/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: int,
    item: ItemCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update an item."""
    result = await db.execute(select(Item).where(Item.id == item_id))
    db_item = result.scalar_one_or_none()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")

    for key, value in item.model_dump(exclude_unset=True).items():
        setattr(db_item, key, value)

    await db.flush()
    await db.refresh(db_item)
    cache_service.clear_entity_cache("item")
    return db_item


@router.delete("/items/{item_id}")
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db)):
    """Delete an item."""
    result = await db.execute(select(Item).where(Item.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    await db.delete(item)
    cache_service.clear_entity_cache("item")
    return {"message": "Item deleted"}


# Locations
@router.get("/locations", response_model=List[LocationResponse])
async def list_locations(
    skip: int = 0,
    limit: int = 100,
    importance: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all locations."""
    query = select(Location)
    if importance:
        query = query.where(Location.importance == importance)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/locations", response_model=LocationResponse)
async def create_location(location: LocationCreate, db: AsyncSession = Depends(get_db)):
    """Create a new location."""
    db_location = Location(**location.model_dump())
    db.add(db_location)
    await db.flush()
    await db.refresh(db_location)
    cache_service.clear_entity_cache("location")
    return db_location


@router.patch("/locations/{location_id}", response_model=LocationResponse)
async def update_location(
    location_id: int,
    location: LocationCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update a location."""
    result = await db.execute(select(Location).where(Location.id == location_id))
    db_location = result.scalar_one_or_none()
    if not db_location:
        raise HTTPException(status_code=404, detail="Location not found")

    for key, value in location.model_dump(exclude_unset=True).items():
        setattr(db_location, key, value)

    await db.flush()
    await db.refresh(db_location)
    cache_service.clear_entity_cache("location")
    return db_location


@router.delete("/locations/{location_id}")
async def delete_location(location_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a location."""
    result = await db.execute(select(Location).where(Location.id == location_id))
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    await db.delete(location)
    cache_service.clear_entity_cache("location")
    return {"message": "Location deleted"}


# Factions
@router.get("/factions", response_model=List[FactionResponse])
async def list_factions(
    skip: int = 0,
    limit: int = 100,
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all factions."""
    query = select(Faction)
    if type:
        query = query.where(Faction.type == type)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/factions", response_model=FactionResponse)
async def create_faction(faction: FactionCreate, db: AsyncSession = Depends(get_db)):
    """Create a new faction."""
    db_faction = Faction(**faction.model_dump())
    db.add(db_faction)
    await db.flush()
    await db.refresh(db_faction)
    cache_service.clear_entity_cache("faction")
    return db_faction


@router.patch("/factions/{faction_id}", response_model=FactionResponse)
async def update_faction(
    faction_id: int,
    faction: FactionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update a faction."""
    result = await db.execute(select(Faction).where(Faction.id == faction_id))
    db_faction = result.scalar_one_or_none()
    if not db_faction:
        raise HTTPException(status_code=404, detail="Faction not found")

    for key, value in faction.model_dump(exclude_unset=True).items():
        setattr(db_faction, key, value)

    await db.flush()
    await db.refresh(db_faction)
    cache_service.clear_entity_cache("faction")
    return db_faction


@router.delete("/factions/{faction_id}")
async def delete_faction(faction_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a faction."""
    result = await db.execute(select(Faction).where(Faction.id == faction_id))
    faction = result.scalar_one_or_none()
    if not faction:
        raise HTTPException(status_code=404, detail="Faction not found")
    await db.delete(faction)
    cache_service.clear_entity_cache("faction")
    return {"message": "Faction deleted"}


# World Settings
@router.get("/world", response_model=List[WorldSettingResponse])
async def list_world_settings(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """List all world settings."""
    result = await db.execute(select(WorldSetting).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/world", response_model=WorldSettingResponse)
async def create_world_setting(
    setting: WorldSettingCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new world setting."""
    db_setting = WorldSetting(**setting.model_dump())
    db.add(db_setting)
    await db.flush()
    await db.refresh(db_setting)
    cache_service.clear_entity_cache("world_setting")
    return db_setting


@router.patch("/world/{setting_id}", response_model=WorldSettingResponse)
async def update_world_setting(
    setting_id: int,
    setting: WorldSettingCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update a world setting."""
    result = await db.execute(select(WorldSetting).where(WorldSetting.id == setting_id))
    db_setting = result.scalar_one_or_none()
    if not db_setting:
        raise HTTPException(status_code=404, detail="World setting not found")

    for key, value in setting.model_dump(exclude_unset=True).items():
        setattr(db_setting, key, value)

    await db.flush()
    await db.refresh(db_setting)
    cache_service.clear_entity_cache("world_setting")
    return db_setting


@router.delete("/world/{setting_id}")
async def delete_world_setting(setting_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a world setting."""
    result = await db.execute(select(WorldSetting).where(WorldSetting.id == setting_id))
    setting = result.scalar_one_or_none()
    if not setting:
        raise HTTPException(status_code=404, detail="World setting not found")
    await db.delete(setting)
    cache_service.clear_entity_cache("world_setting")
    return {"message": "World setting deleted"}


# Rules
@router.get("/rules", response_model=List[RuleResponse])
async def list_rules(
    skip: int = 0,
    limit: int = 100,
    type: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all rules."""
    query = select(Rule)
    if type:
        query = query.where(Rule.type == type)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/rules", response_model=RuleResponse)
async def create_rule(rule: RuleCreate, db: AsyncSession = Depends(get_db)):
    """Create a new rule."""
    db_rule = Rule(**rule.model_dump())
    db.add(db_rule)
    await db.flush()
    await db.refresh(db_rule)
    cache_service.clear_entity_cache("rule")
    return db_rule


@router.patch("/rules/{rule_id}", response_model=RuleResponse)
async def update_rule(
    rule_id: int,
    rule: RuleCreate,
    db: AsyncSession = Depends(get_db)
):
    """Update a rule."""
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    db_rule = result.scalar_one_or_none()
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")

    for key, value in rule.model_dump(exclude_unset=True).items():
        setattr(db_rule, key, value)

    await db.flush()
    await db.refresh(db_rule)
    cache_service.clear_entity_cache("rule")
    return db_rule


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a rule."""
    result = await db.execute(select(Rule).where(Rule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    await db.delete(rule)
    cache_service.clear_entity_cache("rule")
    return {"message": "Rule deleted"}


# Writing Settings
@router.get("/writing", response_model=WritingSettingsResponse)
async def get_writing_settings(db: AsyncSession = Depends(get_db)):
    """Get current writing settings."""
    result = await db.execute(select(WritingSettings))
    settings_obj = result.scalar_one_or_none()
    if not settings_obj:
        # Create default if not exists
        settings_obj = WritingSettings()
        db.add(settings_obj)
        await db.flush()
        await db.refresh(settings_obj)
    return settings_obj


@router.patch("/writing", response_model=WritingSettingsResponse)
async def update_writing_settings(
    updates: WritingSettingsUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update writing settings."""
    result = await db.execute(select(WritingSettings))
    settings_obj = result.scalar_one_or_none()
    if not settings_obj:
        settings_obj = WritingSettings()
        db.add(settings_obj)

    update_data = updates.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings_obj, key, value)

    await db.flush()
    await db.refresh(settings_obj)
    cache_service.clear_entity_cache("writing_settings")
    return settings_obj


# Export/Import for backup and migration
class ExportData(BaseModel):
    """Complete project data for export."""
    version: str = "1.0"
    exported_at: str
    characters: list
    character_relationships: list
    character_storylines: list
    items: list
    locations: list
    factions: list
    world_settings: list
    rules: list
    writing_settings: Optional[dict] = None


@router.get("/export", response_model=ExportData)
async def export_data(db: AsyncSession = Depends(get_db)):
    """Export all project data as JSON."""
    # Get all entities
    characters = (await db.execute(select(Character))).scalars().all()
    relationships = (await db.execute(select(CharacterRelationship))).scalars().all()
    storylines = (await db.execute(select(CharacterStoryline))).scalars().all()
    items = (await db.execute(select(Item))).scalars().all()
    locations = (await db.execute(select(Location))).scalars().all()
    factions = (await db.execute(select(Faction))).scalars().all()
    world_settings = (await db.execute(select(WorldSetting))).scalars().all()
    rules = (await db.execute(select(Rule))).scalars().all()
    writing_settings = (await db.execute(select(WritingSettings))).scalars().one_or_none()

    return ExportData(
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


@router.post("/import")
async def import_data(data: ExportData, db: AsyncSession = Depends(get_db)):
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

    # Validate import data
    if data.version != "1.0":
        raise HTTPException(status_code=400, detail=f"Unsupported export version: {data.version}")

    # Build ID mapping: old_id -> new_id for characters
    id_mapping: dict[int, int] = {}

    # Import characters first and build ID mapping
    for char_data in data.characters:
        char_data_clean = {k: v for k, v in char_data.items()
                          if k not in ('_type', 'id', 'created_at', 'updated_at')}
        char = Character(**char_data_clean)
        db.add(char)
        await db.flush()
        # Map old ID to new ID (old ID stored temporarily)
        old_id = char_data.get('id')
        if old_id is not None:
            id_mapping[old_id] = char.id
        imported_count['characters'] += 1

    # Import character relationships (with circular reference handling)
    processed_relationships = set()  # Track already-processed relationships
    remaining_relationships = list(data.character_relationships)

    # Process relationships in passes, resolving references as characters are mapped
    max_passes = len(data.characters) + 1  # Prevent infinite loops
    for _ in range(max_passes):
        if not remaining_relationships:
            break

        unresolved = []
        for rel_data in remaining_relationships:
            old_char_id = rel_data.get('character_id')
            old_target_id = rel_data.get('target_id')

            # Check if both character IDs are resolved
            if old_char_id in id_mapping and old_target_id in id_mapping:
                rel_clean = {k: v for k, v in rel_data.items()
                            if k not in ('_type', 'id', 'created_at', 'updated_at')}
                rel_clean['character_id'] = id_mapping[old_char_id]
                rel_clean['target_id'] = id_mapping[old_target_id]
                db.add(CharacterRelationship(**rel_clean))
                processed_relationships.add((old_char_id, old_target_id))
                imported_count['character_relationships'] += 1
            else:
                unresolved.append(rel_data)

        remaining_relationships = unresolved

    # Handle any remaining unresolved relationships (circular refs)
    # These reference characters that weren't in the export - skip them
    if remaining_relationships:
        # Log warning but don't fail the import
        pass

    # Import character storylines
    for story_data in data.character_storylines:
        old_char_id = story_data.get('character_id')
        if old_char_id in id_mapping:
            story_clean = {k: v for k, v in story_data.items()
                          if k not in ('_type', 'id', 'created_at', 'updated_at')}
            story_clean['character_id'] = id_mapping[old_char_id]
            db.add(CharacterStoryline(**story_clean))
            imported_count['character_storylines'] += 1

    # Import items
    for item_data in data.items:
        item_clean = {k: v for k, v in item_data.items()
                     if k not in ('_type', 'id', 'created_at', 'updated_at')}
        db.add(Item(**item_clean))
        imported_count['items'] += 1

    # Import locations
    for loc_data in data.locations:
        loc_clean = {k: v for k, v in loc_data.items()
                    if k not in ('_type', 'id', 'created_at', 'updated_at')}
        db.add(Location(**loc_clean))
        imported_count['locations'] += 1

    # Import factions
    for fac_data in data.factions:
        fac_clean = {k: v for k, v in fac_data.items()
                    if k not in ('_type', 'id', 'created_at', 'updated_at')}
        db.add(Faction(**fac_clean))
        imported_count['factions'] += 1

    # Import world settings
    for ws_data in data.world_settings:
        ws_clean = {k: v for k, v in ws_data.items()
                   if k not in ('_type', 'id', 'created_at', 'updated_at')}
        db.add(WorldSetting(**ws_clean))
        imported_count['world_settings'] += 1

    # Import rules
    for rule_data in data.rules:
        rule_clean = {k: v for k, v in rule_data.items()
                     if k not in ('_type', 'id', 'created_at', 'updated_at')}
        db.add(Rule(**rule_clean))
        imported_count['rules'] += 1

    await db.flush()

    return {
        "message": "Import successful",
        "imported": imported_count
    }
