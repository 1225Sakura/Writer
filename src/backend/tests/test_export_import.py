"""Tests for export/import functionality."""
import pytest
import json
import os
import sys
import tempfile
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

# Setup path so backend can be imported
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
os.chdir(os.path.join(os.path.dirname(__file__), '..', '..'))

from backend.models.entities import (
    Character, CharacterRelationship, CharacterStoryline,
    Item, Location, Faction, WorldSetting, Rule, WritingSettings,
    Outline, Chapter
)
from backend.database import Base


@pytest.fixture
def test_db():
    """Create a temporary test database."""
    fd, db_path = tempfile.mkstemp(suffix='.db')
    os.close(fd)

    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)

    yield engine, db_path

    engine.dispose()
    try:
        os.unlink(db_path)
    except (PermissionError, FileNotFoundError):
        pass


@pytest.fixture
def populated_db(test_db):
    """Create a test database with sample data."""
    engine, db_path = test_db

    with Session(engine) as db:
        # Add characters
        char1 = Character(name="张三", personality="刚毅", tier="凡人")
        char2 = Character(name="李四", personality="狡黠", tier="修士")
        db.add_all([char1, char2])
        db.flush()

        # Add relationship
        rel = CharacterRelationship(character_id=char1.id, target_id=char2.id, type="兄弟", description="结拜兄弟")
        db.add(rel)

        # Add item
        item = Item(name="倚天剑", description="削铁如泥")
        db.add(item)

        # Add location
        loc = Location(name="华山", description="五岳之一")
        db.add(loc)

        # Add faction
        faction = Faction(name="丐帮", description="天下第一大帮")
        db.add(faction)

        # Add world setting
        ws = WorldSetting(name="筑基", description="修炼入门境界")
        db.add(ws)

        # Add rule
        rule = Rule(name="江湖规矩", description="侠之大者，为国为民")
        db.add(rule)

        db.commit()

    return engine, db_path


def export_all_data(db: Session, include_chapters: bool = False) -> dict:
    """Export all project data as a dictionary."""
    data = {
        "version": "1.0",
        "characters": [],
        "character_relationships": [],
        "character_storylines": [],
        "items": [],
        "locations": [],
        "factions": [],
        "world_settings": [],
        "rules": [],
        "writing_settings": None,
    }

    characters = db.execute(select(Character)).scalars().all()
    for c in characters:
        char_dict = {k: v for k, v in c.__dict__.items() if not k.startswith('_')}
        data["characters"].append(char_dict)

    relationships = db.execute(select(CharacterRelationship)).scalars().all()
    for r in relationships:
        rel_dict = {k: v for k, v in r.__dict__.items() if not k.startswith('_')}
        data["character_relationships"].append(rel_dict)

    storylines = db.execute(select(CharacterStoryline)).scalars().all()
    for s in storylines:
        story_dict = {k: v for k, v in s.__dict__.items() if not k.startswith('_')}
        data["character_storylines"].append(story_dict)

    items = db.execute(select(Item)).scalars().all()
    for i in items:
        item_dict = {k: v for k, v in i.__dict__.items() if not k.startswith('_')}
        data["items"].append(item_dict)

    locations = db.execute(select(Location)).scalars().all()
    for l in locations:
        loc_dict = {k: v for k, v in l.__dict__.items() if not k.startswith('_')}
        data["locations"].append(loc_dict)

    factions = db.execute(select(Faction)).scalars().all()
    for f in factions:
        fac_dict = {k: v for k, v in f.__dict__.items() if not k.startswith('_')}
        data["factions"].append(fac_dict)

    world_settings = db.execute(select(WorldSetting)).scalars().all()
    for w in world_settings:
        ws_dict = {k: v for k, v in w.__dict__.items() if not k.startswith('_')}
        data["world_settings"].append(ws_dict)

    rules = db.execute(select(Rule)).scalars().all()
    for r in rules:
        rule_dict = {k: v for k, v in r.__dict__.items() if not k.startswith('_')}
        data["rules"].append(rule_dict)

    if include_chapters:
        outlines = db.execute(select(Outline)).scalars().all()
        data["outlines"] = []
        for o in outlines:
            out_dict = {k: v for k, v in o.__dict__.items() if not k.startswith('_')}
            data["outlines"].append(out_dict)

        chapters = db.execute(select(Chapter)).scalars().all()
        data["chapters"] = []
        for ch in chapters:
            ch_dict = {k: v for k, v in ch.__dict__.items() if not k.startswith('_')}
            data["chapters"].append(ch_dict)

    return data


def validate_import_data(data: dict) -> list[str]:
    """Validate import data and return list of warnings/errors."""
    issues = []

    if data.get("version") != "1.0":
        issues.append(f"Warning: Unknown version {data.get('version')}, expected '1.0'")

    required_fields = ["characters", "items", "locations", "factions", "world_settings", "rules"]
    for field in required_fields:
        if field not in data:
            issues.append(f"Error: Missing required field '{field}'")
        elif not isinstance(data[field], list):
            issues.append(f"Error: Field '{field}' must be a list")

    char_ids = {c.get("id") for c in data.get("characters", []) if c.get("id")}
    for rel in data.get("character_relationships", []):
        if rel.get("character_id") not in char_ids:
            issues.append(f"Warning: Relationship references missing character_id {rel.get('character_id')}")
        if rel.get("target_id") not in char_ids:
            issues.append(f"Warning: Relationship references missing target_id {rel.get('target_id')}")

    return issues


def import_data(db: Session, data: dict, merge: bool = False) -> dict:
    """Import project data into database."""
    counts = {
        "characters": 0,
        "character_relationships": 0,
        "character_storylines": 0,
        "items": 0,
        "locations": 0,
        "factions": 0,
        "world_settings": 0,
        "rules": 0,
        "outlines": 0,
        "chapters": 0,
    }

    if not merge:
        db.query(CharacterRelationship).delete()
        db.query(CharacterStoryline).delete()
        db.query(Character).delete()
        db.query(Item).delete()
        db.query(Location).delete()
        db.query(Faction).delete()
        db.query(WorldSetting).delete()
        db.query(Rule).delete()
        db.query(Outline).delete()
        db.query(Chapter).delete()
        db.commit()

    id_mapping: dict[int, int] = {}

    # Import characters
    for char_data in data.get("characters", []):
        char_clean = {k: v for k, v in char_data.items()
                     if k not in ("id", "created_at", "updated_at")}
        char = Character(**char_clean)
        db.add(char)
        db.flush()
        old_id = char_data.get("id")
        if old_id is not None:
            id_mapping[old_id] = char.id
        counts["characters"] += 1

    # Import relationships
    remaining_relationships = data.get("character_relationships", [])
    max_passes = len(data.get("characters", [])) + 1

    for _ in range(max_passes):
        if not remaining_relationships:
            break
        unresolved = []
        for rel_data in remaining_relationships:
            old_char_id = rel_data.get("character_id")
            old_target_id = rel_data.get("target_id")
            if old_char_id in id_mapping and old_target_id in id_mapping:
                rel_clean = {k: v for k, v in rel_data.items()
                            if k not in ("id", "created_at", "updated_at")}
                rel_clean["character_id"] = id_mapping[old_char_id]
                rel_clean["target_id"] = id_mapping[old_target_id]
                db.add(CharacterRelationship(**rel_clean))
                counts["character_relationships"] += 1
            else:
                unresolved.append(rel_data)
        remaining_relationships = unresolved

    # Import storylines
    for story_data in data.get("character_storylines", []):
        old_char_id = story_data.get("character_id")
        if old_char_id in id_mapping:
            story_clean = {k: v for k, v in story_data.items()
                          if k not in ("id", "created_at", "updated_at")}
            story_clean["character_id"] = id_mapping[old_char_id]
            db.add(CharacterStoryline(**story_clean))
            counts["character_storylines"] += 1

    # Import items
    for item_data in data.get("items", []):
        item_clean = {k: v for k, v in item_data.items()
                     if k not in ("id", "created_at", "updated_at")}
        db.add(Item(**item_clean))
        counts["items"] += 1

    # Import locations
    for loc_data in data.get("locations", []):
        loc_clean = {k: v for k, v in loc_data.items()
                    if k not in ("id", "created_at", "updated_at")}
        db.add(Location(**loc_clean))
        counts["locations"] += 1

    # Import factions
    for fac_data in data.get("factions", []):
        fac_clean = {k: v for k, v in fac_data.items()
                    if k not in ("id", "created_at", "updated_at")}
        db.add(Faction(**fac_clean))
        counts["factions"] += 1

    # Import world settings
    for ws_data in data.get("world_settings", []):
        ws_clean = {k: v for k, v in ws_data.items()
                   if k not in ("id", "created_at", "updated_at")}
        db.add(WorldSetting(**ws_clean))
        counts["world_settings"] += 1

    # Import rules
    for rule_data in data.get("rules", []):
        rule_clean = {k: v for k, v in rule_data.items()
                     if k not in ("id", "created_at", "updated_at")}
        db.add(Rule(**rule_clean))
        counts["rules"] += 1

    db.commit()
    return counts


class TestExportImport:
    def test_export_contains_all_entity_types(self, populated_db):
        """Test that export contains all expected entity types."""
        engine, _ = populated_db

        with Session(engine) as db:
            data = export_all_data(db, include_chapters=True)

        assert "characters" in data
        assert "character_relationships" in data
        assert "character_storylines" in data
        assert "items" in data
        assert "locations" in data
        assert "factions" in data
        assert "world_settings" in data
        assert "rules" in data
        assert "version" in data

    def test_export_characters(self, populated_db):
        """Test character export."""
        engine, _ = populated_db

        with Session(engine) as db:
            data = export_all_data(db)

        assert len(data["characters"]) == 2
        names = {c["name"] for c in data["characters"]}
        assert "张三" in names
        assert "李四" in names

    def test_export_relationships(self, populated_db):
        """Test relationship export."""
        engine, _ = populated_db

        with Session(engine) as db:
            data = export_all_data(db)

        assert len(data["character_relationships"]) == 1
        assert data["character_relationships"][0]["type"] == "兄弟"

    def test_validation_passes_for_valid_data(self, populated_db):
        """Test validation passes for valid export data."""
        engine, _ = populated_db

        with Session(engine) as db:
            data = export_all_data(db)

        issues = validate_import_data(data)
        error_issues = [i for i in issues if i.startswith("Error:")]
        assert len(error_issues) == 0

    def test_import_replaces_data(self, populated_db):
        """Test that non-merge import replaces all data."""
        engine, _ = populated_db

        with Session(engine) as db:
            data = export_all_data(db)

        # Add more data
        with Session(engine) as db:
            char3 = Character(name="王五", personality="稳重")
            db.add(char3)
            db.commit()

        # Import with merge=False
        with Session(engine) as db:
            import_data(db, data, merge=False)

        with Session(engine) as db:
            chars = db.execute(select(Character)).scalars().all()
            # Should be back to original 2 characters (张三, 李四)
            assert len(chars) == 2

    def test_import_merge_preserves_existing(self, populated_db):
        """Test that merge import preserves existing data."""
        engine, _ = populated_db

        with Session(engine) as db:
            data = export_all_data(db)

        # Add more data
        with Session(engine) as db:
            char3 = Character(name="王五", personality="稳重")
            db.add(char3)
            db.commit()

        # Import with merge=True (should add to existing)
        with Session(engine) as db:
            import_data(db, data, merge=True)

        with Session(engine) as db:
            chars = db.execute(select(Character)).scalars().all()
            # Should have original 2 + 1 new + 2 imported = 5
            assert len(chars) == 5

    def test_import_relationship_id_mapping(self, populated_db):
        """Test that relationship ID mapping works correctly."""
        engine, _ = populated_db

        with Session(engine) as db:
            data = export_all_data(db)

        # Delete and re-import to test ID remapping
        with Session(engine) as db:
            db.query(CharacterRelationship).delete()
            db.query(Character).delete()
            db.commit()

        with Session(engine) as db:
            import_data(db, data, merge=False)

        with Session(engine) as db:
            chars = db.execute(select(Character)).scalars().all()
            rels = db.execute(select(CharacterRelationship)).scalars().all()

            assert len(chars) == 2
            assert len(rels) == 1
            # Verify relationship references valid character IDs
            char_ids = {c.id for c in chars}
            assert rels[0].character_id in char_ids
            assert rels[0].target_id in char_ids
