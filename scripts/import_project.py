#!/usr/bin/env python3
"""
Import Project CLI - Standalone restore tool for Auto Novel Writer
Usage: python import_project.py <file> [--merge] [--validate-only]
"""

import argparse
import json
import sys
import os
from datetime import datetime

# Add src/backend to path for imports (project root is parent of parent)
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'src'))

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from backend.models.entities import (
    Character, CharacterRelationship, CharacterStoryline,
    Item, Location, Faction, WorldSetting, Rule, WritingSettings,
    Outline, Chapter
)


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

    # Check for orphaned relationships
    char_ids = {c.get("id") for c in data.get("characters", []) if c.get("id")}
    for rel in data.get("character_relationships", []):
        if rel.get("character_id") not in char_ids:
            issues.append(f"Warning: Relationship references missing character_id {rel.get('character_id')}")
        if rel.get("target_id") not in char_ids:
            issues.append(f"Warning: Relationship references missing target_id {rel.get('target_id')}")

    return issues


def import_data(db: Session, data: dict, merge: bool = False) -> dict:
    """Import project data into database. Returns import statistics."""
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
        # Clear existing data (except WritingSettings which may have user preferences)
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

    # Build ID mapping: old_id -> new_id
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

    # Import relationships with circular reference handling
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

    # Import outlines
    outline_mapping: dict[int, int] = {}
    for outline_data in data.get("outlines", []):
        out_clean = {k: v for k, v in outline_data.items()
                    if k not in ("id", "created_at", "updated_at")}
        outline = Outline(**out_clean)
        db.add(outline)
        db.flush()
        old_id = outline_data.get("id")
        if old_id is not None:
            outline_mapping[old_id] = outline.id
        counts["outlines"] += 1

    # Import chapters
    for chapter_data in data.get("chapters", []):
        ch_clean = {k: v for k, v in chapter_data.items()
                   if k not in ("id", "created_at", "updated_at")}
        old_outline_id = chapter_data.get("outline_id")
        if old_outline_id and old_outline_id in outline_mapping:
            ch_clean["outline_id"] = outline_mapping[old_outline_id]
        db.add(Chapter(**ch_clean))
        counts["chapters"] += 1

    # Import writing settings
    if data.get("writing_settings"):
        ws_data = data["writing_settings"]
        existing = db.query(WritingSettings).first()
        ws_clean = {k: v for k, v in ws_data.items()
                   if k not in ("id", "created_at", "updated_at")}
        if existing:
            for key, value in ws_clean.items():
                setattr(existing, key, value)
        else:
            db.add(WritingSettings(**ws_clean))

    db.commit()
    return counts


def main():
    parser = argparse.ArgumentParser(description="Import Auto Novel Writer project data")
    parser.add_argument("file", help="Path to JSON export file")
    parser.add_argument("--db-path", default="data/story.db", help="Path to SQLite database")
    parser.add_argument("--merge", action="store_true", help="Merge with existing data (preserve existing records)")
    parser.add_argument("--validate-only", action="store_true", help="Only validate without importing")
    args = parser.parse_args()

    # Resolve database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), args.db_path)
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}", file=sys.stderr)
        sys.exit(1)

    # Load JSON file
    if not os.path.exists(args.file):
        print(f"Error: Import file not found: {args.file}", file=sys.stderr)
        sys.exit(1)

    print(f"Loading {args.file}...")
    with open(args.file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Validate
    print("Validating import data...")
    issues = validate_import_data(data)
    for issue in issues:
        print(f"  {issue}")

    if any(i.startswith("Error:") for i in issues):
        print("\nImport aborted due to validation errors.")
        sys.exit(1)

    if args.validate_only:
        print("\nValidation complete. No errors found.")
        sys.exit(0)

    # Create engine and import
    engine = create_engine(f"sqlite:///{db_path}")

    print(f"\nImporting to {db_path} ({'merge mode' if args.merge else 'replace mode'})...")
    with Session(engine) as db:
        counts = import_data(db, data, merge=args.merge)

    # Summary
    print("\nImport complete!")
    print(f"  Characters: {counts['characters']}")
    print(f"  Relationships: {counts['character_relationships']}")
    print(f"  Storylines: {counts['character_storylines']}")
    print(f"  Items: {counts['items']}")
    print(f"  Locations: {counts['locations']}")
    print(f"  Factions: {counts['factions']}")
    print(f"  World Settings: {counts['world_settings']}")
    print(f"  Rules: {counts['rules']}")
    print(f"  Outlines: {counts['outlines']}")
    print(f"  Chapters: {counts['chapters']}")


if __name__ == "__main__":
    main()
