"""Database CRUD service using SQLAlchemy async with caching."""

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import async_session_maker
from backend.models.entities import (
    Character, CharacterRelationship, CharacterStoryline,
    Item, Location, Faction, WorldSetting, Rule,
    Outline, Chapter, IFLine,
    ChatSession, ChatMessage, ExtractedEntity,
    DraftVersion, PlotThread, AIInspectionResult, WritingSettings
)
from backend.services.cache_service import (
    cache_service,
    get_cached_character, set_cached_character, invalidate_character_cache,
    get_cached_character_list, set_cached_character_list,
    get_cached_world_setting, set_cached_world_setting, invalidate_world_setting_cache,
    get_cached_world_setting_list, set_cached_world_setting_list,
    get_cached_writing_settings, set_cached_writing_settings, invalidate_writing_settings_cache,
)


def _to_dict(model: Any) -> dict | None:
    """Convert SQLAlchemy model to dict, excluding _sa_instance_state."""
    if model is None:
        return None
    result = {}
    for key, value in model.__dict__.items():
        if not key.startswith('_'):
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            else:
                result[key] = value
    return result


# ============ Cache Helpers ============

def _cache_key(prefix: str, *args: Any) -> str:
    """Generate a cache key."""
    return cache_service.make_key(prefix, *args)


# ============ Characters ============

async def get_character(character_id: int) -> dict | None:
    """Get character by ID (with caching)."""
    # Try cache first
    cached = get_cached_character(character_id)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(
            select(Character).where(Character.id == character_id)
        )
        character = result.scalar_one_or_none()
        data = _to_dict(character) if character else None
        if data:
            set_cached_character(character_id, data)
        return data


async def get_all_characters() -> list[dict]:
    """Get all characters (with caching)."""
    cached = get_cached_character_list()
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(Character).order_by(Character.id))
        characters = result.scalars().all()
        data = [_to_dict(c) for c in characters]
        set_cached_character_list(data)
        return data


async def create_character(data: dict) -> int:
    """Create a new character."""
    async with async_session_maker() as session:
        character = Character(
            name=data.get("name"),
            gender=data.get("gender"),
            personality=data.get("personality"),
            desires=data.get("desires"),
            flaws=data.get("flaws"),
            description=data.get("description"),
            tier=data.get("tier"),
            cultivation_realm=data.get("cultivation_realm")
        )
        session.add(character)
        await session.flush()
        await session.refresh(character)

        # Invalidate caches
        invalidate_character_cache()
        return character.id


async def update_character(character_id: int, data: dict) -> bool:
    """Update character fields."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Character).where(Character.id == character_id)
        )
        character = result.scalar_one_or_none()
        if not character:
            return False

        allowed_keys = ["name", "gender", "personality", "desires", "flaws",
                        "description", "tier", "cultivation_realm"]
        for key in allowed_keys:
            if key in data:
                setattr(character, key, data[key])
        character.updated_at = datetime.utcnow()

        await session.flush()

        # Invalidate caches
        invalidate_character_cache(character_id)
        return True


async def delete_character(character_id: int) -> bool:
    """Delete a character."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Character).where(Character.id == character_id)
        )
        character = result.scalar_one_or_none()
        if not character:
            return False
        await session.delete(character)
        await session.flush()

        # Invalidate caches
        invalidate_character_cache(character_id)
        return True


# ============ Chapters ============

async def get_chapter(chapter_id: int) -> dict | None:
    """Get chapter by ID (with caching)."""
    key = _cache_key("chapter", chapter_id)
    cached = cache_service.get("chapter", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(
            select(Chapter).where(Chapter.id == chapter_id)
        )
        chapter = result.scalar_one_or_none()
        data = _to_dict(chapter) if chapter else None
        if data:
            cache_service.set("chapter", key, data)
        return data


async def get_all_chapters() -> list[dict]:
    """Get all chapters (with caching)."""
    key = _cache_key("chapter_list")
    cached = cache_service.get("chapter", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(Chapter).order_by(Chapter.chapter_order))
        chapters = result.scalars().all()
        data = [_to_dict(c) for c in chapters]
        cache_service.set("chapter", key, data)
        return data


async def create_chapter(data: dict) -> int:
    """Create a new chapter."""
    async with async_session_maker() as session:
        chapter = Chapter(
            outline_id=data.get("outline_id"),
            title=data.get("title"),
            summary=data.get("summary"),
            status=data.get("status", "pending"),
            word_count=data.get("word_count", 0),
            chapter_order=data.get("chapter_order", 0)
        )
        session.add(chapter)
        await session.flush()
        await session.refresh(chapter)

        cache_service.delete_pattern("chapter", "chapter_list")
        return chapter.id


async def update_chapter(chapter_id: int, data: dict) -> bool:
    """Update chapter fields."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Chapter).where(Chapter.id == chapter_id)
        )
        chapter = result.scalar_one_or_none()
        if not chapter:
            return False

        allowed_keys = ["outline_id", "title", "summary", "status", "word_count", "chapter_order"]
        for key in allowed_keys:
            if key in data:
                setattr(chapter, key, data[key])
        chapter.updated_at = datetime.utcnow()

        await session.flush()

        cache_service.delete("chapter", _cache_key("chapter", chapter_id))
        cache_service.delete_pattern("chapter", "chapter_list")
        return True


async def delete_chapter(chapter_id: int) -> bool:
    """Delete a chapter."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(Chapter).where(Chapter.id == chapter_id)
        )
        chapter = result.scalar_one_or_none()
        if not chapter:
            return False
        await session.delete(chapter)
        await session.flush()

        cache_service.delete("chapter", _cache_key("chapter", chapter_id))
        cache_service.delete_pattern("chapter", "chapter_list")
        return True


# ============ Chat Sessions ============

async def get_chat_session(session_id: int) -> dict | None:
    """Get chat session by ID (with caching)."""
    key = _cache_key("chat_sess", session_id)
    cached = cache_service.get("chat_session", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        chat_session = result.scalar_one_or_none()
        data = _to_dict(chat_session) if chat_session else None
        if data:
            cache_service.set("chat_session", key, data)
        return data


async def get_all_chat_sessions() -> list[dict]:
    """Get all chat sessions (with caching)."""
    key = _cache_key("chat_sess_list")
    cached = cache_service.get("chat_session", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(
            select(ChatSession).order_by(ChatSession.created_at.desc())
        )
        sessions = result.scalars().all()
        data = [_to_dict(s) for s in sessions]
        cache_service.set("chat_session", key, data)
        return data


async def create_chat_session(data: dict) -> int:
    """Create a new chat session."""
    async with async_session_maker() as session:
        chat_session = ChatSession()
        session.add(chat_session)
        await session.flush()
        await session.refresh(chat_session)

        cache_service.delete_pattern("chat_session", "chat_sess_list")
        return chat_session.id


async def update_chat_session(session_id: int, data: dict) -> bool:
    """Update chat session fields."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        chat_session = result.scalar_one_or_none()
        if not chat_session:
            return False

        chat_session.updated_at = datetime.utcnow()
        await session.flush()

        cache_service.delete("chat_session", _cache_key("chat_sess", session_id))
        cache_service.delete_pattern("chat_session", "chat_sess_list")
        return True


async def delete_chat_session(session_id: int) -> bool:
    """Delete a chat session."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        chat_session = result.scalar_one_or_none()
        if not chat_session:
            return False
        await session.delete(chat_session)
        await session.flush()

        cache_service.delete("chat_session", _cache_key("chat_sess", session_id))
        cache_service.delete_pattern("chat_session", "chat_sess_list")
        return True


# ============ Messages ============

async def get_message(message_id: int) -> dict | None:
    """Get message by ID (with caching)."""
    key = _cache_key("msg", message_id)
    cached = cache_service.get("message", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(
            select(ChatMessage).where(ChatMessage.id == message_id)
        )
        message = result.scalar_one_or_none()
        data = _to_dict(message) if message else None
        if data:
            cache_service.set("message", key, data)
        return data


async def get_all_messages(session_id: int | None = None) -> list[dict]:
    """Get all messages, optionally filtered by session (with caching)."""
    key = _cache_key("msg_list", session_id)
    cached = cache_service.get("message", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        query = select(ChatMessage)
        if session_id is not None:
            query = query.where(ChatMessage.session_id == session_id)
        query = query.order_by(ChatMessage.created_at)

        result = await session.execute(query)
        messages = result.scalars().all()
        data = [_to_dict(m) for m in messages]
        cache_service.set("message", key, data)
        return data


async def create_message(data: dict) -> int:
    """Create a new message."""
    async with async_session_maker() as session:
        message = ChatMessage(
            session_id=data.get("session_id"),
            role=data.get("role"),
            content=data.get("content")
        )
        session.add(message)
        await session.flush()
        await session.refresh(message)

        cache_service.delete_pattern("message", "msg_list")
        return message.id


async def update_message(message_id: int, data: dict) -> bool:
    """Update message fields."""
    if "content" not in data:
        return False

    async with async_session_maker() as session:
        result = await session.execute(
            select(ChatMessage).where(ChatMessage.id == message_id)
        )
        message = result.scalar_one_or_none()
        if not message:
            return False

        message.content = data["content"]
        await session.flush()

        cache_service.delete("message", _cache_key("msg", message_id))
        cache_service.delete_pattern("message", "msg_list")
        return True


async def delete_message(message_id: int) -> bool:
    """Delete a message."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(ChatMessage).where(ChatMessage.id == message_id)
        )
        message = result.scalar_one_or_none()
        if not message:
            return False
        await session.delete(message)
        await session.flush()

        cache_service.delete("message", _cache_key("msg", message_id))
        cache_service.delete_pattern("message", "msg_list")
        return True


# ============ Character Relationships ============

async def get_character_relationships(character_id: int) -> list[dict]:
    """Get all relationships for a character."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(CharacterRelationship)
            .where(CharacterRelationship.character_id == character_id)
        )
        relationships = result.scalars().all()
        return [_to_dict(r) for r in relationships]


async def create_character_relationship(data: dict) -> int:
    """Create a new character relationship."""
    async with async_session_maker() as session:
        relationship = CharacterRelationship(
            character_id=data.get("character_id"),
            target_id=data.get("target_id"),
            type=data.get("type"),
            description=data.get("description"),
        )
        session.add(relationship)
        await session.flush()
        await session.refresh(relationship)

        invalidate_character_cache(data.get("character_id"))
        invalidate_character_cache(data.get("target_id"))
        return relationship.id


# ============ Character Storylines ============

async def get_character_storylines(character_id: int) -> list[dict]:
    """Get all storylines for a character."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(CharacterStoryline)
            .where(CharacterStoryline.character_id == character_id)
        )
        storylines = result.scalars().all()
        return [_to_dict(s) for s in storylines]


async def create_character_storyline(data: dict) -> int:
    """Create a new character storyline."""
    async with async_session_maker() as session:
        storyline = CharacterStoryline(
            character_id=data.get("character_id"),
            title=data.get("title"),
            arc=data.get("arc"),
            progress=data.get("progress", 0),
        )
        session.add(storyline)
        await session.flush()
        await session.refresh(storyline)

        invalidate_character_cache(data.get("character_id"))
        return storyline.id


# ============ Items ============

async def get_item(item_id: int) -> dict | None:
    """Get item by ID (with caching)."""
    key = _cache_key("item", item_id)
    cached = cache_service.get("item", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(Item).where(Item.id == item_id))
        item = result.scalar_one_or_none()
        data = _to_dict(item) if item else None
        if data:
            cache_service.set("item", key, data)
        return data


async def get_all_items(owner: str | None = None) -> list[dict]:
    """Get all items, optionally filtered by owner (with caching)."""
    key = _cache_key("item_list", owner)
    cached = cache_service.get("item", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        query = select(Item).order_by(Item.id)
        if owner:
            query = query.where(Item.owner == owner)
        result = await session.execute(query)
        items = result.scalars().all()
        data = [_to_dict(i) for i in items]
        cache_service.set("item", key, data)
        return data


async def create_item(data: dict) -> int:
    """Create a new item."""
    async with async_session_maker() as session:
        item = Item(
            name=data.get("name"),
            description=data.get("description"),
            owner=data.get("owner"),
            location=data.get("location"),
        )
        session.add(item)
        await session.flush()
        await session.refresh(item)

        cache_service.delete_pattern("item", "item_list")
        return item.id


async def update_item(item_id: int, data: dict) -> bool:
    """Update an item."""
    async with async_session_maker() as session:
        result = await session.execute(select(Item).where(Item.id == item_id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        for key in ["name", "description", "owner", "location"]:
            if key in data:
                setattr(item, key, data[key])
        await session.flush()

        cache_service.delete("item", _cache_key("item", item_id))
        cache_service.delete_pattern("item", "item_list")
        return True


async def delete_item(item_id: int) -> bool:
    """Delete an item."""
    async with async_session_maker() as session:
        result = await session.execute(select(Item).where(Item.id == item_id))
        item = result.scalar_one_or_none()
        if not item:
            return False
        await session.delete(item)
        await session.flush()

        cache_service.delete("item", _cache_key("item", item_id))
        cache_service.delete_pattern("item", "item_list")
        return True


# ============ Locations ============

async def get_location(location_id: int) -> dict | None:
    """Get location by ID (with caching)."""
    key = _cache_key("loc", location_id)
    cached = cache_service.get("location", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(Location).where(Location.id == location_id))
        location = result.scalar_one_or_none()
        data = _to_dict(location) if location else None
        if data:
            cache_service.set("location", key, data)
        return data


async def get_all_locations(importance: str | None = None) -> list[dict]:
    """Get all locations, optionally filtered by importance (with caching)."""
    key = _cache_key("loc_list", importance)
    cached = cache_service.get("location", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        query = select(Location).order_by(Location.id)
        if importance:
            query = query.where(Location.importance == importance)
        result = await session.execute(query)
        locations = result.scalars().all()
        data = [_to_dict(l) for l in locations]
        cache_service.set("location", key, data)
        return data


async def create_location(data: dict) -> int:
    """Create a new location."""
    async with async_session_maker() as session:
        location = Location(
            name=data.get("name"),
            description=data.get("description"),
            importance=data.get("importance"),
        )
        session.add(location)
        await session.flush()
        await session.refresh(location)

        cache_service.delete_pattern("location", "loc_list")
        return location.id


async def update_location(location_id: int, data: dict) -> bool:
    """Update a location."""
    async with async_session_maker() as session:
        result = await session.execute(select(Location).where(Location.id == location_id))
        location = result.scalar_one_or_none()
        if not location:
            return False
        for key in ["name", "description", "importance"]:
            if key in data:
                setattr(location, key, data[key])
        await session.flush()

        cache_service.delete("location", _cache_key("loc", location_id))
        cache_service.delete_pattern("location", "loc_list")
        return True


async def delete_location(location_id: int) -> bool:
    """Delete a location."""
    async with async_session_maker() as session:
        result = await session.execute(select(Location).where(Location.id == location_id))
        location = result.scalar_one_or_none()
        if not location:
            return False
        await session.delete(location)
        await session.flush()

        cache_service.delete("location", _cache_key("loc", location_id))
        cache_service.delete_pattern("location", "loc_list")
        return True


# ============ Factions ============

async def get_faction(faction_id: int) -> dict | None:
    """Get faction by ID (with caching)."""
    key = _cache_key("faction", faction_id)
    cached = cache_service.get("faction", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(Faction).where(Faction.id == faction_id))
        faction = result.scalar_one_or_none()
        data = _to_dict(faction) if faction else None
        if data:
            cache_service.set("faction", key, data)
        return data


async def get_all_factions(faction_type: str | None = None) -> list[dict]:
    """Get all factions, optionally filtered by type (with caching)."""
    key = _cache_key("faction_list", faction_type)
    cached = cache_service.get("faction", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        query = select(Faction).order_by(Faction.id)
        if faction_type:
            query = query.where(Faction.type == faction_type)
        result = await session.execute(query)
        factions = result.scalars().all()
        data = [_to_dict(f) for f in factions]
        cache_service.set("faction", key, data)
        return data


async def create_faction(data: dict) -> int:
    """Create a new faction."""
    async with async_session_maker() as session:
        faction = Faction(
            name=data.get("name"),
            description=data.get("description"),
            type=data.get("type"),
        )
        session.add(faction)
        await session.flush()
        await session.refresh(faction)

        cache_service.delete_pattern("faction", "faction_list")
        return faction.id


async def update_faction(faction_id: int, data: dict) -> bool:
    """Update a faction."""
    async with async_session_maker() as session:
        result = await session.execute(select(Faction).where(Faction.id == faction_id))
        faction = result.scalar_one_or_none()
        if not faction:
            return False
        for key in ["name", "description", "type"]:
            if key in data:
                setattr(faction, key, data[key])
        await session.flush()

        cache_service.delete("faction", _cache_key("faction", faction_id))
        cache_service.delete_pattern("faction", "faction_list")
        return True


async def delete_faction(faction_id: int) -> bool:
    """Delete a faction."""
    async with async_session_maker() as session:
        result = await session.execute(select(Faction).where(Faction.id == faction_id))
        faction = result.scalar_one_or_none()
        if not faction:
            return False
        await session.delete(faction)
        await session.flush()

        cache_service.delete("faction", _cache_key("faction", faction_id))
        cache_service.delete_pattern("faction", "faction_list")
        return True


# ============ World Settings ============

async def get_world_setting(setting_id: int) -> dict | None:
    """Get world setting by ID (with caching)."""
    cached = get_cached_world_setting(setting_id)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(WorldSetting).where(WorldSetting.id == setting_id))
        setting = result.scalar_one_or_none()
        data = _to_dict(setting) if setting else None
        if data:
            set_cached_world_setting(setting_id, data)
        return data


async def get_all_world_settings() -> list[dict]:
    """Get all world settings (with caching)."""
    cached = get_cached_world_setting_list()
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(WorldSetting).order_by(WorldSetting.id))
        settings = result.scalars().all()
        data = [_to_dict(s) for s in settings]
        set_cached_world_setting_list(data)
        return data


async def create_world_setting(data: dict) -> int:
    """Create a new world setting."""
    async with async_session_maker() as session:
        setting = WorldSetting(
            name=data.get("name"),
            description=data.get("description"),
            details_json=data.get("details_json"),
        )
        session.add(setting)
        await session.flush()
        await session.refresh(setting)

        invalidate_world_setting_cache()
        return setting.id


async def update_world_setting(setting_id: int, data: dict) -> bool:
    """Update a world setting."""
    async with async_session_maker() as session:
        result = await session.execute(select(WorldSetting).where(WorldSetting.id == setting_id))
        setting = result.scalar_one_or_none()
        if not setting:
            return False
        for key in ["name", "description", "details_json"]:
            if key in data:
                setattr(setting, key, data[key])
        await session.flush()

        invalidate_world_setting_cache(setting_id)
        return True


async def delete_world_setting(setting_id: int) -> bool:
    """Delete a world setting."""
    async with async_session_maker() as session:
        result = await session.execute(select(WorldSetting).where(WorldSetting.id == setting_id))
        setting = result.scalar_one_or_none()
        if not setting:
            return False
        await session.delete(setting)
        await session.flush()

        invalidate_world_setting_cache(setting_id)
        return True


# ============ Rules ============

async def get_rule(rule_id: int) -> dict | None:
    """Get rule by ID (with caching)."""
    key = _cache_key("rule", rule_id)
    cached = cache_service.get("rule", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(Rule).where(Rule.id == rule_id))
        rule = result.scalar_one_or_none()
        data = _to_dict(rule) if rule else None
        if data:
            cache_service.set("rule", key, data)
        return data


async def get_all_rules(rule_type: str | None = None) -> list[dict]:
    """Get all rules, optionally filtered by type (with caching)."""
    key = _cache_key("rule_list", rule_type)
    cached = cache_service.get("rule", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        query = select(Rule).order_by(Rule.id)
        if rule_type:
            query = query.where(Rule.type == rule_type)
        result = await session.execute(query)
        rules = result.scalars().all()
        data = [_to_dict(r) for r in rules]
        cache_service.set("rule", key, data)
        return data


async def create_rule(data: dict) -> int:
    """Create a new rule."""
    async with async_session_maker() as session:
        rule = Rule(
            name=data.get("name"),
            description=data.get("description"),
            type=data.get("type"),
        )
        session.add(rule)
        await session.flush()
        await session.refresh(rule)

        cache_service.delete_pattern("rule", "rule_list")
        return rule.id


async def update_rule(rule_id: int, data: dict) -> bool:
    """Update a rule."""
    async with async_session_maker() as session:
        result = await session.execute(select(Rule).where(Rule.id == rule_id))
        rule = result.scalar_one_or_none()
        if not rule:
            return False
        for key in ["name", "description", "type"]:
            if key in data:
                setattr(rule, key, data[key])
        await session.flush()

        cache_service.delete("rule", _cache_key("rule", rule_id))
        cache_service.delete_pattern("rule", "rule_list")
        return True


async def delete_rule(rule_id: int) -> bool:
    """Delete a rule."""
    async with async_session_maker() as session:
        result = await session.execute(select(Rule).where(Rule.id == rule_id))
        rule = result.scalar_one_or_none()
        if not rule:
            return False
        await session.delete(rule)
        await session.flush()

        cache_service.delete("rule", _cache_key("rule", rule_id))
        cache_service.delete_pattern("rule", "rule_list")
        return True


# ============ Outline CRUD ============

async def get_outline(outline_id: int) -> dict | None:
    """Get outline by ID (with caching)."""
    key = _cache_key("outline", outline_id)
    cached = cache_service.get("outline", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(Outline).where(Outline.id == outline_id))
        outline = result.scalar_one_or_none()
        data = _to_dict(outline) if outline else None
        if data:
            cache_service.set("outline", key, data)
        return data


async def get_all_outlines() -> list[dict]:
    """Get all outlines (with caching)."""
    key = _cache_key("outline_list")
    cached = cache_service.get("outline", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(Outline).order_by(Outline.id))
        outlines = result.scalars().all()
        data = [_to_dict(o) for o in outlines]
        cache_service.set("outline", key, data)
        return data


async def create_outline(data: dict) -> int:
    """Create a new outline."""
    async with async_session_maker() as session:
        outline = Outline(
            title=data.get("title"),
            description=data.get("description"),
        )
        session.add(outline)
        await session.flush()
        await session.refresh(outline)

        cache_service.delete_pattern("outline", "outline_list")
        return outline.id


async def update_outline(outline_id: int, data: dict) -> bool:
    """Update an outline."""
    async with async_session_maker() as session:
        result = await session.execute(select(Outline).where(Outline.id == outline_id))
        outline = result.scalar_one_or_none()
        if not outline:
            return False
        for key in ["title", "description"]:
            if key in data:
                setattr(outline, key, data[key])
        await session.flush()

        cache_service.delete("outline", _cache_key("outline", outline_id))
        cache_service.delete_pattern("outline", "outline_list")
        return True


async def delete_outline(outline_id: int) -> bool:
    """Delete an outline."""
    async with async_session_maker() as session:
        result = await session.execute(select(Outline).where(Outline.id == outline_id))
        outline = result.scalar_one_or_none()
        if not outline:
            return False
        await session.delete(outline)
        await session.flush()

        cache_service.delete("outline", _cache_key("outline", outline_id))
        cache_service.delete_pattern("outline", "outline_list")
        return True


# ============ IF Lines ============

async def get_if_line(if_line_id: int) -> dict | None:
    """Get IF line by ID (with caching)."""
    key = _cache_key("ifline", if_line_id)
    cached = cache_service.get("ifline", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(IFLine).where(IFLine.id == if_line_id))
        if_line = result.scalar_one_or_none()
        data = _to_dict(if_line) if if_line else None
        if data:
            cache_service.set("ifline", key, data)
        return data


async def get_all_if_lines(character_id: int | None = None) -> list[dict]:
    """Get all IF lines, optionally filtered by linked character (with caching)."""
    key = _cache_key("ifline_list", character_id)
    cached = cache_service.get("ifline", key)
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        query = select(IFLine).order_by(IFLine.id)
        if character_id is not None:
            query = query.where(IFLine.linked_character_id == character_id)
        result = await session.execute(query)
        if_lines = result.scalars().all()
        data = [_to_dict(i) for i in if_lines]
        cache_service.set("ifline", key, data)
        return data


async def create_if_line(data: dict) -> int:
    """Create a new IF line."""
    async with async_session_maker() as session:
        if_line = IFLine(
            title=data.get("title"),
            linked_character_id=data.get("linked_character_id"),
            description=data.get("description"),
            sync_mode=data.get("sync_mode", "auto"),
        )
        session.add(if_line)
        await session.flush()
        await session.refresh(if_line)

        cache_service.delete_pattern("ifline", "ifline_list")
        return if_line.id


async def update_if_line(if_line_id: int, data: dict) -> bool:
    """Update an IF line."""
    async with async_session_maker() as session:
        result = await session.execute(select(IFLine).where(IFLine.id == if_line_id))
        if_line = result.scalar_one_or_none()
        if not if_line:
            return False
        for key in ["title", "linked_character_id", "description", "sync_mode"]:
            if key in data:
                setattr(if_line, key, data[key])
        if_line.updated_at = datetime.utcnow()
        await session.flush()

        cache_service.delete("ifline", _cache_key("ifline", if_line_id))
        cache_service.delete_pattern("ifline", "ifline_list")
        return True


async def delete_if_line(if_line_id: int) -> bool:
    """Delete an IF line."""
    async with async_session_maker() as session:
        result = await session.execute(select(IFLine).where(IFLine.id == if_line_id))
        if_line = result.scalar_one_or_none()
        if not if_line:
            return False
        await session.delete(if_line)
        await session.flush()

        cache_service.delete("ifline", _cache_key("ifline", if_line_id))
        cache_service.delete_pattern("ifline", "ifline_list")
        return True


# ============ Chat Messages Helper (for export_import) ============

async def get_chat_messages(session_id: int) -> list[dict]:
    """Get all messages for a chat session."""
    return await get_all_messages(session_id)


# ============ Extracted Entities ============

async def get_extracted_entities(session_id: int, entity_type: str | None = None) -> list[dict]:
    """Get extracted entities for a session."""
    async with async_session_maker() as session:
        query = select(ExtractedEntity).where(ExtractedEntity.session_id == session_id)
        if entity_type:
            query = query.where(ExtractedEntity.type == entity_type)
        result = await session.execute(query.order_by(ExtractedEntity.created_at.desc()))
        entities = result.scalars().all()
        return [_to_dict(e) for e in entities]


async def create_extracted_entity(data: dict) -> int:
    """Create a new extracted entity."""
    async with async_session_maker() as session:
        entity = ExtractedEntity(
            session_id=data.get("session_id"),
            type=data.get("type"),
            name=data.get("name"),
            description=data.get("description"),
            confirmed=data.get("confirmed", 0),
        )
        session.add(entity)
        await session.flush()
        await session.refresh(entity)
        return entity.id


# ============ Draft Versions ============

async def get_draft_versions(chapter_id: int) -> list[dict]:
    """Get all draft versions for a chapter."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .order_by(DraftVersion.version_number.desc())
        )
        drafts = result.scalars().all()
        return [_to_dict(d) for d in drafts]


async def create_draft_version(data: dict) -> int:
    """Create a new draft version."""
    async with async_session_maker() as session:
        draft = DraftVersion(
            chapter_id=data.get("chapter_id"),
            content=data.get("content"),
            version_number=data.get("version_number"),
        )
        session.add(draft)
        await session.flush()
        await session.refresh(draft)

        cache_service.delete("chapter", _cache_key("chapter", data.get("chapter_id")))
        return draft.id


# ============ Plot Threads ============

async def get_all_plot_threads(status: str | None = None) -> list[dict]:
    """Get all plot threads, optionally filtered by status."""
    async with async_session_maker() as session:
        query = select(PlotThread).order_by(PlotThread.id)
        if status:
            query = query.where(PlotThread.status == status)
        result = await session.execute(query)
        threads = result.scalars().all()
        return [_to_dict(t) for t in threads]


async def create_plot_thread(data: dict) -> int:
    """Create a new plot thread."""
    async with async_session_maker() as session:
        thread = PlotThread(
            title=data.get("title"),
            description=data.get("description"),
            status=data.get("status", "active"),
            created_chapter_id=data.get("created_chapter_id"),
            reveal_chapter_id=data.get("reveal_chapter_id"),
        )
        session.add(thread)
        await session.flush()
        await session.refresh(thread)
        return thread.id


# ============ AI Inspection Results ============

async def get_ai_inspection_results(chapter_id: int) -> list[dict]:
    """Get all AI inspection results for a chapter."""
    async with async_session_maker() as session:
        result = await session.execute(
            select(AIInspectionResult)
            .where(AIInspectionResult.chapter_id == chapter_id)
            .order_by(AIInspectionResult.created_at.desc())
        )
        inspections = result.scalars().all()
        return [_to_dict(i) for i in inspections]


async def create_ai_inspection_result(data: dict) -> int:
    """Create a new AI inspection result."""
    async with async_session_maker() as session:
        inspection = AIInspectionResult(
            chapter_id=data.get("chapter_id"),
            inspection_type=data.get("inspection_type"),
            issues_json=data.get("issues_json"),
            suggestions_json=data.get("suggestions_json"),
            auto_fixed=data.get("auto_fixed", 0),
        )
        session.add(inspection)
        await session.flush()
        await session.refresh(inspection)
        return inspection.id


# ============ Writing Settings ============

async def get_writing_settings() -> dict | None:
    """Get writing settings (singleton) with caching."""
    cached = get_cached_writing_settings()
    if cached is not None:
        return cached

    async with async_session_maker() as session:
        result = await session.execute(select(WritingSettings))
        settings_obj = result.scalar_one_or_none()
        data = _to_dict(settings_obj)
        if data:
            set_cached_writing_settings(data)
        return data


async def upsert_writing_settings(data: dict) -> bool:
    """Upsert writing settings."""
    async with async_session_maker() as session:
        result = await session.execute(select(WritingSettings))
        settings_obj = result.scalar_one_or_none()

        if not settings_obj:
            settings_obj = WritingSettings()
            session.add(settings_obj)

        for key in ["human_ai_ratio", "writing_style", "target_word_count"]:
            if key in data:
                setattr(settings_obj, key, data[key])
        settings_obj.updated_at = datetime.utcnow()

        await session.flush()

        invalidate_writing_settings_cache()
        return True
