# Project Export/Import Service
# Handles project data serialization and deserialization

import json
import logging
import os
import zipfile
import io
import yaml
from datetime import datetime, timezone
from typing import Any, Optional, Callable
from uuid import UUID

from backend.infrastructure.database import async_session_maker
from backend.core.domain import (
    Character, CharacterRelationship, CharacterStoryline,
    Item, Location, Faction, WorldSetting, Rule,
    Outline, Chapter, IFLine,
    ChatSession, ChatMessage, ExtractedEntity,
    DraftVersion, PlotThread, AIInspectionResult, WritingSettings
)
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload



# Security constants for ZIP import
MAX_UNCOMPRESSED_SIZE = 100 * 1024 * 1024  # 100MB per file
MAX_COMPRESSION_RATIO = 100  # Reject if ratio > 100:1 (zip bomb detection)
MAX_TOTAL_UNCOMPRESSED_SIZE = 500 * 1024 * 1024  # 500MB total archive

logger = logging.getLogger(__name__)


class ZipSecurityError(ValueError):
    """Raised when a ZIP archive fails security checks."""
    pass


def _is_safe_path(target_dir: str, member_path: str) -> bool:
    """
    Validate that extracted file path stays within target directory.
    Prevents Zip Slip vulnerability (path traversal via ../).
    """
    # Normalize the path and resolve any symlinks
    target_dir = os.path.abspath(os.path.realpath(target_dir))
    # Join target dir with member path (member path may contain subdirs)
    full_path = os.path.abspath(os.path.join(target_dir, member_path))
    # Ensure the resolved path starts with target_dir + os.sep
    prefix = os.path.join(target_dir, '')
    return full_path.startswith(prefix)


def _check_zip_security(zf: zipfile.ZipFile) -> None:
    """
    Perform security checks on ZIP archive contents.
    Raises ZipSecurityError if any check fails.
    """
    total_uncompressed = 0

    for info in zf.infolist():
        # Check 1: Path traversal (Zip Slip)
        if not _is_safe_path("/tmp", info.filename):
            logger.warning(
                f"ZIP security: path traversal detected in '{info.filename}'"
            )
            raise ZipSecurityError(
                f"Path traversal detected: '{info.filename}'. "
                "Archive contains entries outside the expected directory."
            )

        # Check 2: Compression ratio (zip bomb detection)
        compressed_size = info.compress_size
        uncompressed_size = info.file_size

        if compressed_size == 0:
            # Directories or empty files
            continue

        ratio = uncompressed_size / compressed_size
        if ratio > MAX_COMPRESSION_RATIO:
            logger.warning(
                f"ZIP security: compression ratio {ratio:.1f}:1 for "
                f"'{info.filename}' exceeds limit {MAX_COMPRESSION_RATIO}:1"
            )
            raise ZipSecurityError(
                f"Suspicious compression ratio ({ratio:.1f}:1) for "
                f"'{info.filename}'. Possible zip bomb."
            )

        # Check 3: Single file size limit
        if uncompressed_size > MAX_UNCOMPRESSED_SIZE:
            logger.warning(
                f"ZIP security: file '{info.filename}' size "
                f"{uncompressed_size} exceeds limit {MAX_UNCOMPRESSED_SIZE}"
            )
            raise ZipSecurityError(
                f"File '{info.filename}' too large: "
                f"{uncompressed_size} bytes (max {MAX_UNCOMPRESSED_SIZE} bytes)."
            )

        total_uncompressed += uncompressed_size

    # Check 4: Total uncompressed size limit
    if total_uncompressed > MAX_TOTAL_UNCOMPRESSED_SIZE:
        logger.warning(
            f"ZIP security: total uncompressed size {total_uncompressed} "
            f"exceeds limit {MAX_TOTAL_UNCOMPRESSED_SIZE}"
        )
        raise ZipSecurityError(
            f"Total uncompressed size {total_uncompressed} bytes exceeds "
            f"limit {MAX_TOTAL_UNCOMPRESSED_SIZE} bytes."
        )


# ============================================
# JSON Schema for Import Validation
# ============================================

EXPORT_SCHEMA = {
    "$schema": "http://json-schema.org/draft-07/schema#",
    "type": "object",
    "required": ["version", "data"],
    "properties": {
        "version": {"type": "string", "enum": ["1.0"]},
        "exported_at": {"type": "string"},
        "data": {
            "type": "object",
            "properties": {
                "characters": {"type": "array", "items": {"$ref": "#/definitions/uuid_key"}},
                "character_relationships": {"type": "array"},
                "character_storylines": {"type": "array"},
                "items": {"type": "array", "items": {"$ref": "#/definitions/uuid_key"}},
                "locations": {"type": "array", "items": {"$ref": "#/definitions/uuid_key"}},
                "factions": {"type": "array", "items": {"$ref": "#/definitions/uuid_key"}},
                "world_settings": {"type": "array", "items": {"$ref": "#/definitions/uuid_key"}},
                "rules": {"type": "array", "items": {"$ref": "#/definitions/uuid_key"}},
                "outlines": {"type": "array"},
                "if_lines": {"type": "array"},
                "chat_sessions": {"type": "array"},
                "plot_threads": {"type": "array"},
                "writing_settings": {"type": ["object", "null"]},
            },
        },
    },
    "definitions": {
        "uuid_key": {
            "type": "object",
            "required": ["id", "name"],
            "properties": {
                "id": {"type": ["integer", "string"]},
                "name": {"type": "string", "minLength": 1},
            },
        },
    },
}

IMPORT_VALIDATION_ERRORS: list[dict] = []


def _validate_import_data(data: dict) -> list[dict]:
    """Validate imported data against schema. Returns list of validation errors."""
    errors = []

    if not isinstance(data, dict):
        return [{"field": "root", "error": "Data must be a dictionary"}]

    # Check required top-level fields
    if "version" not in data:
        errors.append({"field": "version", "error": "Missing required field: version"})
    elif data.get("version") not in ["1.0"]:
        errors.append({"field": "version", "error": f"Unsupported version: {data.get('version')}. Only '1.0' is supported."})

    if "data" not in data:
        errors.append({"field": "data", "error": "Missing required field: data"})
        return errors  # Can't validate further without data

    project_data = data.get("data", {})

    # Validate each entity type
    entity_validators = {
        "characters": (_validate_character, "character"),
        "items": (_validate_item, "item"),
        "locations": (_validate_location, "location"),
        "factions": (_validate_faction, "faction"),
        "world_settings": (_validate_world_setting, "world_setting"),
        "rules": (_validate_rule, "rule"),
        "outlines": (_validate_outline, "outline"),
        "if_lines": (_validate_if_line, "if_line"),
        "chat_sessions": (_validate_chat_session, "chat_session"),
        "plot_threads": (_validate_plot_thread, "plot_thread"),
    }

    for entity_key, (validator, entity_name) in entity_validators.items():
        entity_list = project_data.get(entity_key, [])
        if not isinstance(entity_list, list):
            errors.append({
                "field": f"data.{entity_key}",
                "error": f"{entity_name} list must be an array"
            })
            continue

        for idx, item in enumerate(entity_list):
            validation_errors = validator(item, idx)
            errors.extend(validation_errors)

    return errors


def _validate_character(data: dict, idx: int) -> list[dict]:
    """Validate a character entity."""
    errors = []
    prefix = f"data.characters[{idx}]"

    if not isinstance(data, dict):
        return [{"field": prefix, "error": "Character must be an object"}]

    if "id" not in data:
        errors.append({"field": f"{prefix}.id", "error": "Missing required field: id"})
    elif not isinstance(data["id"], (int, str)):
        errors.append({"field": f"{prefix}.id", "error": "ID must be a string or integer"})

    if "name" not in data or not data.get("name"):
        errors.append({"field": f"{prefix}.name", "error": "Missing or empty required field: name"})
    elif len(str(data.get("name", ""))) > 200:
        errors.append({"field": f"{prefix}.name", "error": "Name exceeds maximum length of 200"})

    return errors


def _validate_item(data: dict, idx: int) -> list[dict]:
    """Validate an item entity."""
    errors = []
    prefix = f"data.items[{idx}]"

    if not isinstance(data, dict):
        return [{"field": prefix, "error": "Item must be an object"}]

    if "id" not in data:
        errors.append({"field": f"{prefix}.id", "error": "Missing required field: id"})
    elif not isinstance(data["id"], (int, str)):
        errors.append({"field": f"{prefix}.id", "error": "ID must be a string or integer"})

    if "name" not in data or not data.get("name"):
        errors.append({"field": f"{prefix}.name", "error": "Missing or empty required field: name"})

    return errors


def _validate_location(data: dict, idx: int) -> list[dict]:
    """Validate a location entity."""
    errors = []
    prefix = f"data.locations[{idx}]"

    if not isinstance(data, dict):
        return [{"field": prefix, "error": "Location must be an object"}]

    if "id" not in data:
        errors.append({"field": f"{prefix}.id", "error": "Missing required field: id"})
    elif not isinstance(data["id"], (int, str)):
        errors.append({"field": f"{prefix}.id", "error": "ID must be a string or integer"})

    if "name" not in data or not data.get("name"):
        errors.append({"field": f"{prefix}.name", "error": "Missing or empty required field: name"})

    return errors


def _validate_faction(data: dict, idx: int) -> list[dict]:
    """Validate a faction entity."""
    errors = []
    prefix = f"data.factions[{idx}]"

    if not isinstance(data, dict):
        return [{"field": prefix, "error": "Faction must be an object"}]

    if "id" not in data:
        errors.append({"field": f"{prefix}.id", "error": "Missing required field: id"})
    elif not isinstance(data["id"], (int, str)):
        errors.append({"field": f"{prefix}.id", "error": "ID must be a string or integer"})

    if "name" not in data or not data.get("name"):
        errors.append({"field": f"{prefix}.name", "error": "Missing or empty required field: name"})

    return errors


def _validate_world_setting(data: dict, idx: int) -> list[dict]:
    """Validate a world setting entity."""
    errors = []
    prefix = f"data.world_settings[{idx}]"

    if not isinstance(data, dict):
        return [{"field": prefix, "error": "World setting must be an object"}]

    if "id" not in data:
        errors.append({"field": f"{prefix}.id", "error": "Missing required field: id"})
    elif not isinstance(data["id"], (int, str)):
        errors.append({"field": f"{prefix}.id", "error": "ID must be a string or integer"})

    if "name" not in data or not data.get("name"):
        errors.append({"field": f"{prefix}.name", "error": "Missing or empty required field: name"})

    return errors


def _validate_rule(data: dict, idx: int) -> list[dict]:
    """Validate a rule entity."""
    errors = []
    prefix = f"data.rules[{idx}]"

    if not isinstance(data, dict):
        return [{"field": prefix, "error": "Rule must be an object"}]

    if "id" not in data:
        errors.append({"field": f"{prefix}.id", "error": "Missing required field: id"})
    elif not isinstance(data["id"], (int, str)):
        errors.append({"field": f"{prefix}.id", "error": "ID must be a string or integer"})

    if "name" not in data or not data.get("name"):
        errors.append({"field": f"{prefix}.name", "error": "Missing or empty required field: name"})

    return errors


def _validate_outline(data: dict, idx: int) -> list[dict]:
    """Validate an outline entity."""
    errors = []
    prefix = f"data.outlines[{idx}]"

    if not isinstance(data, dict):
        return [{"field": prefix, "error": "Outline must be an object"}]

    if "id" not in data:
        errors.append({"field": f"{prefix}.id", "error": "Missing required field: id"})
    elif not isinstance(data["id"], (int, str)):
        errors.append({"field": f"{prefix}.id", "error": "ID must be a string or integer"})

    if "title" not in data or not data.get("title"):
        errors.append({"field": f"{prefix}.title", "error": "Missing or empty required field: title"})

    # Validate chapters if present
    chapters = data.get("chapters", [])
    if not isinstance(chapters, list):
        errors.append({"field": f"{prefix}.chapters", "error": "Chapters must be an array"})
    else:
        for c_idx, chapter in enumerate(chapters):
            if not isinstance(chapter, dict):
                errors.append({"field": f"{prefix}.chapters[{c_idx}]", "error": "Chapter must be an object"})
            elif "id" not in chapter:
                errors.append({"field": f"{prefix}.chapters[{c_idx}].id", "error": "Missing required field: id"})

    return errors


def _validate_if_line(data: dict, idx: int) -> list[dict]:
    """Validate an IF line entity."""
    errors = []
    prefix = f"data.if_lines[{idx}]"

    if not isinstance(data, dict):
        return [{"field": prefix, "error": "IF line must be an object"}]

    if "id" not in data:
        errors.append({"field": f"{prefix}.id", "error": "Missing required field: id"})
    elif not isinstance(data["id"], (int, str)):
        errors.append({"field": f"{prefix}.id", "error": "ID must be a string or integer"})

    if "title" not in data or not data.get("title"):
        errors.append({"field": f"{prefix}.title", "error": "Missing or empty required field: title"})

    return errors


def _validate_chat_session(data: dict, idx: int) -> list[dict]:
    """Validate a chat session entity."""
    errors = []
    prefix = f"data.chat_sessions[{idx}]"

    if not isinstance(data, dict):
        return [{"field": prefix, "error": "Chat session must be an object"}]

    if "id" not in data:
        errors.append({"field": f"{prefix}.id", "error": "Missing required field: id"})
    elif not isinstance(data["id"], (int, str)):
        errors.append({"field": f"{prefix}.id", "error": "ID must be a string or integer"})

    return errors


def _validate_plot_thread(data: dict, idx: int) -> list[dict]:
    """Validate a plot thread entity."""
    errors = []
    prefix = f"data.plot_threads[{idx}]"

    if not isinstance(data, dict):
        return [{"field": prefix, "error": "Plot thread must be an object"}]

    if "id" not in data:
        errors.append({"field": f"{prefix}.id", "error": "Missing required field: id"})
    elif not isinstance(data["id"], (int, str)):
        errors.append({"field": f"{prefix}.id", "error": "ID must be a string or integer"})

    if "title" not in data or not data.get("title"):
        errors.append({"field": f"{prefix}.title", "error": "Missing or empty required field: title"})

    return errors


class ImportValidationError(ValueError):
    """Custom exception for import validation errors with detailed information."""

    def __init__(self, errors: list[dict]):
        self.errors = errors
        error_summary = "; ".join([f"{e['field']}: {e['error']}" for e in errors[:5]])
        if len(errors) > 5:
            error_summary += f" ... and {len(errors) - 5} more errors"
        super().__init__(f"Import validation failed: {error_summary}")


class ConflictResolution:
    """Handles conflict resolution for import operations."""

    @staticmethod
    def resolve_conflict(
        existing_data: dict,
        imported_data: dict,
        strategy: str = "import_wins"
    ) -> dict:
        """
        Resolve conflicts between existing and imported data.

        Args:
            existing_data: Current data in database
            imported_data: Data being imported
            strategy: Resolution strategy - "import_wins", "existing_wins", "merge"

        Returns:
            Resolved data dictionary
        """
        if strategy == "existing_wins":
            return existing_data
        elif strategy == "merge":
            return ConflictResolution._merge_data(existing_data, imported_data)
        else:  # import_wins
            return imported_data

    @staticmethod
    def _merge_data(existing: dict, imported: dict) -> dict:
        """Deep merge two dictionaries, preferring non-None imported values."""
        result = existing.copy()
        for key, value in imported.items():
            if value is not None:
                if key in result and isinstance(result[key], dict) and isinstance(value, dict):
                    result[key] = ConflictResolution._merge_data(result[key], value)
                else:
                    result[key] = value
        return result

    @staticmethod
    def detect_conflicts(
        existing_entities: list[dict],
        imported_entities: list[dict],
        id_field: str = "id"
    ) -> list[dict]:
        """
        Detect conflicts between existing and imported entities.

        Returns list of conflicts with details.
        """
        conflicts = []
        existing_by_id = {str(e.get(id_field)): e for e in existing_entities}
        imported_by_id = {str(e.get(id_field)): e for e in imported_entities}

        common_ids = set(existing_by_id.keys()) & set(imported_by_id.keys())

        for entity_id in common_ids:
            existing = existing_by_id[entity_id]
            imported = imported_by_id[entity_id]

            # Check for meaningful differences
            differences = {}
            for key in set(existing.keys()) | set(imported.keys()):
                existing_val = existing.get(key)
                imported_val = imported.get(key)
                if existing_val != imported_val and imported_val is not None:
                    differences[key] = {
                        "existing": existing_val,
                        "imported": imported_val
                    }

            if differences:
                conflicts.append({
                    "id": entity_id,
                    "existing": existing,
                    "imported": imported,
                    "differences": differences
                })

        return conflicts


def _model_to_dict(model: Any) -> dict | None:
    """Convert SQLAlchemy model to dict, excluding _sa_instance_state."""
    if model is None:
        return None
    result = {}
    for key, value in model.__dict__.items():
        if not key.startswith('_'):
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, UUID):
                result[key] = str(value)
            elif hasattr(value, '__dict__'):
                continue
            else:
                result[key] = value
    return result


class ExportProgressCallback:
    """Callback for reporting export progress."""

    def __init__(self):
        self.progress: float = 0.0
        self.current_step: str = ""
        self.callback: Optional[Callable[[float, str], None]] = None

    def set_callback(self, callback: Callable[[float, str], None]):
        """Set the progress callback function."""
        self.callback = callback

    def update(self, progress: float, step: str):
        """Update progress and notify callback."""
        self.progress = progress
        self.current_step = step
        if self.callback:
            self.callback(progress, step)


async def export_project(
    incremental: bool = False,
    since: Optional[datetime] = None,
    progress_callback: Optional[ExportProgressCallback] = None
) -> dict:
    """
    Export all project data as a dictionary.
    Used for both full project export and backup.

    Args:
        incremental: If True, export only changed data since 'since'
        since: Datetime to export changes from (for incremental exports)
        progress_callback: Optional callback for progress reporting
    """
    def update_progress(progress: float, step: str):
        if progress_callback:
            progress_callback.update(progress, step)

    async with async_session_maker() as session:
        update_progress(0.0, "Exporting characters...")
        characters = await _get_all_characters_with_relations(session)

        update_progress(0.1, "Exporting character relationships...")
        character_relationships = await _get_all_character_relationships(session)

        update_progress(0.15, "Exporting character storylines...")
        character_storylines = await _get_all_character_storylines(session)

        update_progress(0.2, "Exporting items...")
        items = await _get_all_items(session)

        update_progress(0.3, "Exporting locations...")
        locations = await _get_all_locations(session)

        update_progress(0.4, "Exporting factions...")
        factions = await _get_all_factions(session)

        update_progress(0.5, "Exporting world settings...")
        world_settings = await _get_all_world_settings(session)

        update_progress(0.6, "Exporting rules...")
        rules = await _get_all_rules(session)

        update_progress(0.7, "Exporting outlines and chapters...")
        outlines = await _get_all_outlines_with_chapters(session)

        update_progress(0.8, "Exporting IF lines...")
        if_lines = await _get_all_if_lines(session)

        update_progress(0.85, "Exporting chat sessions...")
        chat_sessions = await _get_all_chat_sessions_with_messages(session)

        update_progress(0.9, "Exporting plot threads...")
        plot_threads = await _get_all_plot_threads(session)

        update_progress(0.95, "Exporting writing settings...")
        writing_settings = await _get_writing_settings(session)

        update_progress(1.0, "Export complete")

        return {
            "version": "1.0",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "incremental": incremental,
            "since": since.isoformat() if since else None,
            "data": {
                "characters": characters,
                "character_relationships": character_relationships,
                "character_storylines": character_storylines,
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


def export_to_json(data: dict, indent: int = 2) -> str:
    """Export project data to JSON string.

    Args:
        data: Project data dictionary
        indent: Indentation level for pretty printing

    Returns:
        JSON string representation
    """
    return json.dumps(data, ensure_ascii=False, indent=indent)


def export_to_yaml(data: dict) -> str:
    """Export project data to YAML string.

    Args:
        data: Project data dictionary

    Returns:
        YAML string representation
    """
    return yaml.dump(data, allow_unicode=True, default_flow_style=False, sort_keys=False)


def export_to_zip(data: dict, format: str = "json") -> bytes:
    """Export project data to a ZIP archive containing JSON or YAML.

    Args:
        data: Project data dictionary
        format: Export format - "json" or "yaml"

    Returns:
        ZIP archive bytes
    """
    if format == "yaml":
        export_data = export_to_yaml(data)
        filename = "project_data.yaml"
    else:
        export_data = export_to_json(data)
        filename = "project_data.json"

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(filename, export_data)
        # Also include metadata file
        zf.writestr("export_info.json", json.dumps({
            "format": format,
            "exported_at": datetime.now(timezone.utc).isoformat(),
        }, ensure_ascii=False))
    return zip_buffer.getvalue()


def import_from_json(json_str: str) -> dict:
    """Parse JSON string to project data dict."""
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON: {str(e)}")


def import_from_yaml(yaml_str: str) -> dict:
    """Parse YAML string to project data dict."""
    try:
        return yaml.safe_load(yaml_str)
    except yaml.YAMLError as e:
        raise ValueError(f"Invalid YAML: {str(e)}")


def import_from_zip(zip_bytes: bytes) -> dict:
    """
    Extract project data from ZIP archive (auto-detect JSON or YAML).

    Security checks applied:
    - Path traversal (Zip Slip) prevention
    - Compression ratio limit (zip bomb detection)
    - Single file size limit
    - Total archive size limit
    """
    try:
        with zipfile.ZipFile(io.BytesIO(zip_bytes), 'r') as zf:
            _check_zip_security(zf)

            # Try to find project_data.json first, then project_data.yaml
            if "project_data.json" in zf.namelist():
                with zf.open("project_data.json") as f:
                    return json.loads(f.read().decode('utf-8'))
            elif "project_data.yaml" in zf.namelist():
                with zf.open("project_data.yaml") as f:
                    return yaml.safe_load(f.read().decode('utf-8'))
            else:
                raise ValueError(
                    "No project_data.json or project_data.yaml found in ZIP archive"
                )
    except zipfile.BadZipFile as e:
        logger.error(f"ZIP import failed: invalid ZIP file - {e}")
        raise ValueError(f"Invalid ZIP archive: {e}")
    except ZipSecurityError:
        raise
    except Exception as e:
        logger.error(f"ZIP import failed: {e}")
        raise ValueError(f"Failed to import from ZIP: {e}")


async def import_project(
    data: dict,
    mode: str = "merge",
    conflict_resolution: str = "import_wins",
    validate: bool = True,
    progress_callback: Optional[ExportProgressCallback] = None
) -> dict:
    """
    Import project data from dictionary.

    Args:
        data: Project data dictionary
        mode: "merge" (add to existing) or "replace" (clear and load)
        conflict_resolution: How to resolve conflicts - "import_wins", "existing_wins", "merge"
        validate: Whether to validate imported data against schema
        progress_callback: Optional callback for progress reporting

    Returns:
        Summary of imported entities with validation results

    Raises:
        ImportValidationError: If validation fails and validate=True
        ValueError: If data version is unsupported
    """
    def update_progress(progress: float, step: str):
        if progress_callback:
            progress_callback.update(progress, step)

    if data.get("version") != "1.0":
        raise ValueError(f"Unsupported export version: {data.get('version')}. Only '1.0' is supported.")

    # Validate imported data
    if validate:
        update_progress(0.0, "Validating import data...")
        validation_errors = _validate_import_data(data)
        if validation_errors:
            raise ImportValidationError(validation_errors)

    project_data = data.get("data", {})
    summary = {"imported": {}, "conflicts": [], "validation_passed": True}

    async with async_session_maker() as session:
        update_progress(0.1, "Checking for conflicts...")
        # Detect conflicts in merge mode
        if mode == "merge":
            conflicts = await _detect_import_conflicts(session, project_data)
            summary["conflicts"] = conflicts

            # Resolve conflicts if needed
            if conflicts and conflict_resolution != "import_wins":
                project_data = await _resolve_conflicts(session, project_data, conflict_resolution)

        if mode == "replace":
            update_progress(0.15, "Clearing existing data...")
            await _clear_all_data(session)

        # Import entities with progress reporting
        update_progress(0.2, "Importing characters...")
        summary["imported"]["characters"] = await _import_characters(session, project_data)

        update_progress(0.25, "Importing character relationships...")
        summary["imported"]["character_relationships"] = await _import_character_relationships(session, project_data)

        update_progress(0.3, "Importing character storylines...")
        summary["imported"]["character_storylines"] = await _import_character_storylines(session, project_data)

        update_progress(0.35, "Importing items...")
        summary["imported"]["items"] = await _import_items(session, project_data)

        update_progress(0.4, "Importing locations...")
        summary["imported"]["locations"] = await _import_locations(session, project_data)

        update_progress(0.5, "Importing factions...")
        summary["imported"]["factions"] = await _import_factions(session, project_data)

        update_progress(0.55, "Importing world settings...")
        summary["imported"]["world_settings"] = await _import_world_settings(session, project_data)

        update_progress(0.6, "Importing rules...")
        summary["imported"]["rules"] = await _import_rules(session, project_data)

        update_progress(0.7, "Importing outlines and chapters...")
        summary["imported"]["outlines"] = await _import_outlines(session, project_data)

        update_progress(0.8, "Importing IF lines...")
        summary["imported"]["if_lines"] = await _import_if_lines(session, project_data)

        update_progress(0.85, "Importing chat sessions...")
        summary["imported"]["chat_sessions"] = await _import_chat_sessions(session, project_data)

        update_progress(0.9, "Importing plot threads...")
        summary["imported"]["plot_threads"] = await _import_plot_threads(session, project_data)

        update_progress(0.95, "Importing writing settings...")
        summary["imported"]["writing_settings"] = await _import_writing_settings(session, project_data)

        update_progress(1.0, "Import complete")
        await session.commit()

    return summary


async def _detect_import_conflicts(session, project_data: dict) -> list[dict]:
    """Detect conflicts between existing and imported data."""
    conflicts = []

    # Check characters
    result = await session.execute(select(Character))
    existing_chars = [_model_to_dict(c) for c in result.scalars().all()]
    char_conflicts = ConflictResolution.detect_conflicts(
        existing_chars,
        project_data.get("characters", []),
        id_field="id"
    )
    conflicts.extend([{"type": "character", **c} for c in char_conflicts])

    # Check items
    result = await session.execute(select(Item))
    existing_items = [_model_to_dict(i) for i in result.scalars().all()]
    item_conflicts = ConflictResolution.detect_conflicts(
        existing_items,
        project_data.get("items", []),
        id_field="id"
    )
    conflicts.extend([{"type": "item", **c} for c in item_conflicts])

    # Check locations
    result = await session.execute(select(Location))
    existing_locs = [_model_to_dict(l) for l in result.scalars().all()]
    loc_conflicts = ConflictResolution.detect_conflicts(
        existing_locs,
        project_data.get("locations", []),
        id_field="id"
    )
    conflicts.extend([{"type": "location", **c} for c in loc_conflicts])

    # Check factions
    result = await session.execute(select(Faction))
    existing_factions = [_model_to_dict(f) for f in result.scalars().all()]
    faction_conflicts = ConflictResolution.detect_conflicts(
        existing_factions,
        project_data.get("factions", []),
        id_field="id"
    )
    conflicts.extend([{"type": "faction", **c} for c in faction_conflicts])

    return conflicts


async def _resolve_conflicts(session, project_data: dict, strategy: str) -> dict:
    """Apply conflict resolution strategy to imported data."""
    # For now, apply resolution per entity type
    resolver = ConflictResolution()

    for entity_key in ["characters", "items", "locations", "factions"]:
        entities = project_data.get(entity_key, [])
        if not entities:
            continue

        # Get existing entities
        model_map = {
            "characters": Character,
            "items": Item,
            "locations": Location,
            "factions": Faction,
        }
        model = model_map.get(entity_key)
        if model:
            result = await session.execute(select(model))
            existing = [_model_to_dict(e) for e in result.scalars().all()]

            # Detect and resolve conflicts
            conflicts = ConflictResolution.detect_conflicts(existing, entities)
            resolved = []
            for imported in entities:
                existing_match = next((e for e in existing if str(e.get("id")) == str(imported.get("id"))), None)
                if existing_match:
                    resolved.append(
                        resolver.resolve_conflict(existing_match, imported, strategy)
                    )
                else:
                    resolved.append(imported)
            project_data[entity_key] = resolved

    return project_data


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


async def _import_character_relationships(session, data):
    count = 0
    for rel_data in data.get("character_relationships", []):
        rel = CharacterRelationship(
            id=rel_data.get("id"),
            character_id=rel_data.get("character_id"),
            target_id=rel_data.get("target_id"),
            type=rel_data.get("type"),
            description=rel_data.get("description"),
        )
        session.add(rel)
        count += 1
    return count


async def _import_character_storylines(session, data):
    count = 0
    for story_data in data.get("character_storylines", []):
        story = CharacterStoryline(
            id=story_data.get("id"),
            character_id=story_data.get("character_id"),
            title=story_data.get("title"),
            arc=story_data.get("arc"),
            progress=story_data.get("progress", 0),
        )
        session.add(story)
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
