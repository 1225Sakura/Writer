# Project Export/Import Service
# Handles project data serialization and deserialization

import json
import zipfile
import io
from datetime import datetime
from typing import Any

from backend.database import async_session_maker
from backend.models.entities import (
    Character, CharacterRelationship, CharacterStoryline,
    Item, Location, Faction, WorldSetting, Rule,
    Outline, Chapter, IFLine,
    ChatSession, ChatMessage, ExtractedEntity,
    DraftVersion, PlotThread, AIInspectionResult, WritingSettings
)
from sqlalchemy import select
from sqlalchemy.orm import selectinload


def _model_to_dict(model: Any) -> dict | None:
    """Convert SQLAlchemy model to dict, excluding _sa_instance_state."""
    if model is None:
        return None
    result = {}
    for key, value in model.__dict__.items():
        if not key.startswith('_'):
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif hasattr(value, '__dict__'):
                continue
            else:
                result[key] = value
    return result


async def export_project() -> dict:
    """
    Export all project data as a dictionary.
    Used for both full project export and backup.
    """
    async with async_session_maker() as session:
        # Export all entities
        characters = await _get_all_characters_with_relations(session)
        items = await _get_all_items(session)
        locations = await _get_all_locations(session)
        factions = await _get_all_factions(session)
        world_settings = await _get_all_world_settings(session)
        rules = await _get_all_rules(session)
        outlines = await _get_all_outlines_with_chapters(session)
        if_lines = await _get_all_if_lines(session)
        chat_sessions = await _get_all_chat_sessions_with_messages(session)
        plot_threads = await _get_all_plot_threads(session)
        writing_settings = await _get_writing_settings(session)

        return {
            "version": "1.0",
            "exported_at": datetime.utcnow().isoformat(),
            "data": {
                "characters": characters,
                "character_relationships": await _get_all_character_relationships(session),
                "character_storylines": await _get_all_character_storylines(session),
                "items": items,
                "locations": locations,
                "factions": factions,
                "world_settings": world_settings,
                "rules": rules,
                "outlines": outlines,
                "if_lines": if_lines,
                "chat_sessions": chat_sessions,
                "plot_threads": plot_threads,
                "writing_settings": writing_settings,
            }
        }


async def _get_all_characters_with_relations(session):
    """Get all characters with their relationships and storylines."""
    result = await session.execute(
        select(Character).options(
            selectinload(Character.relationships),
            selectinload(Character.storylines)
        )
    )
    characters = result.scalars().all()
    return [_model_to_dict(c) for c in characters]


async def _get_all_character_relationships(session):
    result = await session.execute(select(CharacterRelationship))
    return [_model_to_dict(r) for r in result.scalars().all()]


async def _get_all_character_storylines(session):
    result = await session.execute(select(CharacterStoryline))
    return [_model_to_dict(s) for s in result.scalars().all()]


async def _get_all_items(session):
    result = await session.execute(select(Item))
    return [_model_to_dict(i) for i in result.scalars().all()]


async def _get_all_locations(session):
    result = await session.execute(select(Location))
    return [_model_to_dict(l) for l in result.scalars().all()]


async def _get_all_factions(session):
    result = await session.execute(select(Faction))
    return [_model_to_dict(f) for f in result.scalars().all()]


async def _get_all_world_settings(session):
    result = await session.execute(select(WorldSetting))
    return [_model_to_dict(s) for s in result.scalars().all()]


async def _get_all_rules(session):
    result = await session.execute(select(Rule))
    return [_model_to_dict(r) for r in result.scalars().all()]


async def _get_all_outlines_with_chapters(session):
    result = await session.execute(
        select(Outline).options(selectinload(Outline.chapters))
    )
    outlines = result.scalars().all()
    return [
        {
            **_model_to_dict(o),
            "chapters": [_model_to_dict(c) for c in o.chapters]
        }
        for o in outlines
    ]


async def _get_all_if_lines(session):
    result = await session.execute(select(IFLine))
    return [_model_to_dict(i) for i in result.scalars().all()]


async def _get_all_chat_sessions_with_messages(session):
    result = await session.execute(
        select(ChatSession).options(
            selectinload(ChatSession.messages),
            selectinload(ChatSession.extracted_entities)
        )
    )
    sessions = result.scalars().all()
    return [
        {
            **_model_to_dict(s),
            "messages": [_model_to_dict(m) for m in s.messages],
            "extracted_entities": [_model_to_dict(e) for e in s.extracted_entities]
        }
        for s in sessions
    ]


async def _get_all_plot_threads(session):
    result = await session.execute(select(PlotThread))
    return [_model_to_dict(t) for t in result.scalars().all()]


async def _get_writing_settings(session):
    result = await session.execute(select(WritingSettings))
    settings = result.scalar_one_or_none()
    return _model_to_dict(settings)


def export_to_json(data: dict) -> str:
    """Export project data to JSON string."""
    return json.dumps(data, ensure_ascii=False, indent=2)


def export_to_zip(data: dict) -> bytes:
    """Export project data to a ZIP archive containing JSON."""
    json_data = export_to_json(data)
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("project_data.json", json_data)
    return zip_buffer.getvalue()


async def import_project(data: dict, mode: str = "merge") -> dict:
    """
    Import project data from dictionary.

    Args:
        data: Project data dictionary
        mode: "merge" (add to existing) or "replace" (clear and load)

    Returns:
        Summary of imported entities
    """
    if data.get("version") != "1.0":
        raise ValueError(f"Unsupported export version: {data.get('version')}")

    project_data = data.get("data", {})
    summary = {"imported": {}}

    async with async_session_maker() as session:
        if mode == "replace":
            await _clear_all_data(session)

        # Import entities
        summary["imported"]["characters"] = await _import_characters(session, project_data)
        summary["imported"]["items"] = await _import_items(session, project_data)
        summary["imported"]["locations"] = await _import_locations(session, project_data)
        summary["imported"]["factions"] = await _import_factions(session, project_data)
        summary["imported"]["world_settings"] = await _import_world_settings(session, project_data)
        summary["imported"]["rules"] = await _import_rules(session, project_data)
        summary["imported"]["outlines"] = await _import_outlines(session, project_data)
        summary["imported"]["if_lines"] = await _import_if_lines(session, project_data)
        summary["imported"]["chat_sessions"] = await _import_chat_sessions(session, project_data)
        summary["imported"]["plot_threads"] = await _import_plot_threads(session, project_data)
        summary["imported"]["writing_settings"] = await _import_writing_settings(session, project_data)

        await session.commit()

    return summary


async def _clear_all_data(session):
    """Clear all project data (for replace mode)."""
    from sqlalchemy import delete
    # Delete in reverse dependency order
    await session.execute(delete(AIInspectionResult))
    await session.execute(delete(DraftVersion))
    await session.execute(delete(PlotThread))
    await session.execute(delete(ExtractedEntity))
    await session.execute(delete(ChatMessage))
    await session.execute(delete(ChatSession))
    await session.execute(delete(Chapter))
    await session.execute(delete(Outline))
    await session.execute(delete(IFLine))
    await session.execute(delete(CharacterStoryline))
    await session.execute(delete(CharacterRelationship))
    await session.execute(delete(Character))
    await session.execute(delete(Item))
    await session.execute(delete(Location))
    await session.execute(delete(Faction))
    await session.execute(delete(WorldSetting))
    await session.execute(delete(Rule))
    await session.execute(delete(WritingSettings))


async def _import_characters(session, data):
    count = 0
    for char_data in data.get("characters", []):
        char = Character(
            id=char_data.get("id"),
            name=char_data.get("name"),
            gender=char_data.get("gender"),
            personality=char_data.get("personality"),
            desires=char_data.get("desires"),
            flaws=char_data.get("flaws"),
            description=char_data.get("description"),
            tier=char_data.get("tier"),
            cultivation_realm=char_data.get("cultivation_realm"),
        )
        session.add(char)
        count += 1
    return count


async def _import_items(session, data):
    count = 0
    for item_data in data.get("items", []):
        item = Item(
            id=item_data.get("id"),
            name=item_data.get("name"),
            description=item_data.get("description"),
            owner=item_data.get("owner"),
            location=item_data.get("location"),
        )
        session.add(item)
        count += 1
    return count


async def _import_locations(session, data):
    count = 0
    for loc_data in data.get("locations", []):
        loc = Location(
            id=loc_data.get("id"),
            name=loc_data.get("name"),
            description=loc_data.get("description"),
            importance=loc_data.get("importance"),
        )
        session.add(loc)
        count += 1
    return count


async def _import_factions(session, data):
    count = 0
    for fact_data in data.get("factions", []):
        fact = Faction(
            id=fact_data.get("id"),
            name=fact_data.get("name"),
            description=fact_data.get("description"),
            type=fact_data.get("type"),
        )
        session.add(fact)
        count += 1
    return count


async def _import_world_settings(session, data):
    count = 0
    for ws_data in data.get("world_settings", []):
        ws = WorldSetting(
            id=ws_data.get("id"),
            name=ws_data.get("name"),
            description=ws_data.get("description"),
            details_json=ws_data.get("details_json"),
        )
        session.add(ws)
        count += 1
    return count


async def _import_rules(session, data):
    count = 0
    for rule_data in data.get("rules", []):
        rule = Rule(
            id=rule_data.get("id"),
            name=rule_data.get("name"),
            description=rule_data.get("description"),
            type=rule_data.get("type"),
        )
        session.add(rule)
        count += 1
    return count


async def _import_outlines(session, data):
    count = 0
    for outline_data in data.get("outlines", []):
        outline = Outline(
            id=outline_data.get("id"),
            title=outline_data.get("title"),
            description=outline_data.get("description"),
        )
        session.add(outline)

        for chapter_data in outline_data.get("chapters", []):
            chapter = Chapter(
                id=chapter_data.get("id"),
                outline_id=outline.id,
                title=chapter_data.get("title"),
                summary=chapter_data.get("summary"),
                status=chapter_data.get("status"),
                word_count=chapter_data.get("word_count", 0),
                chapter_order=chapter_data.get("chapter_order", 0),
            )
            session.add(chapter)
        count += 1
    return count


async def _import_if_lines(session, data):
    count = 0
    for if_data in data.get("if_lines", []):
        if_line = IFLine(
            id=if_data.get("id"),
            title=if_data.get("title"),
            linked_character_id=if_data.get("linked_character_id"),
            description=if_data.get("description"),
            sync_mode=if_data.get("sync_mode", "auto"),
        )
        session.add(if_line)
        count += 1
    return count


async def _import_chat_sessions(session, data):
    count = 0
    for cs_data in data.get("chat_sessions", []):
        chat_session = ChatSession(
            id=cs_data.get("id"),
        )
        session.add(chat_session)

        for msg_data in cs_data.get("messages", []):
            msg = ChatMessage(
                id=msg_data.get("id"),
                session_id=chat_session.id,
                role=msg_data.get("role"),
                content=msg_data.get("content"),
            )
            session.add(msg)

        for ent_data in cs_data.get("extracted_entities", []):
            entity = ExtractedEntity(
                id=ent_data.get("id"),
                session_id=chat_session.id,
                type=ent_data.get("type"),
                name=ent_data.get("name"),
                description=ent_data.get("description"),
                confirmed=ent_data.get("confirmed", 0),
            )
            session.add(entity)
        count += 1
    return count


async def _import_plot_threads(session, data):
    count = 0
    for pt_data in data.get("plot_threads", []):
        thread = PlotThread(
            id=pt_data.get("id"),
            title=pt_data.get("title"),
            description=pt_data.get("description"),
            status=pt_data.get("status", "active"),
            created_chapter_id=pt_data.get("created_chapter_id"),
            reveal_chapter_id=pt_data.get("reveal_chapter_id"),
        )
        session.add(thread)
        count += 1
    return count


async def _import_writing_settings(session, data):
    ws_data = data.get("writing_settings")
    if ws_data:
        ws = WritingSettings(
            human_ai_ratio=ws_data.get("human_ai_ratio", 0.5),
            writing_style=ws_data.get("writing_style", "default"),
            target_word_count=ws_data.get("target_word_count", 3000),
        )
        session.add(ws)
        return 1
    return 0


def import_from_json(json_str: str) -> dict:
    """Parse JSON string to project data dict."""
    return json.loads(json_str)


def import_from_zip(zip_bytes: bytes) -> dict:
    """Extract project data from ZIP archive."""
    with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
        with zf.open("project_data.json") as f:
            return json.loads(f.read().decode('utf-8'))
