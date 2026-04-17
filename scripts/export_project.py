#!/usr/bin/env python3
"""
Export Project CLI - Standalone backup tool for Auto Novel Writer
Usage: python export_project.py [--output <file>] [--include-chapters]
"""

import argparse
import json
import sys
import os
from datetime import datetime

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session
from backend.models.entities import (
    Character, CharacterRelationship, CharacterStoryline,
    Item, Location, Faction, WorldSetting, Rule, WritingSettings,
    Outline, Chapter
)


def export_all_data(db: Session, include_chapters: bool = False) -> dict:
    """Export all project data as a dictionary."""
    data = {
        "version": "1.0",
        "exported_at": datetime.utcnow().isoformat(),
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

    # Characters
    characters = db.execute(select(Character)).scalars().all()
    for c in characters:
        char_dict = {k: v for k, v in c.__dict__.items() if not k.startswith('_')}
        data["characters"].append(char_dict)

    # Relationships
    relationships = db.execute(select(CharacterRelationship)).scalars().all()
    for r in relationships:
        rel_dict = {k: v for k, v in r.__dict__.items() if not k.startswith('_')}
        data["character_relationships"].append(rel_dict)

    # Storylines
    storylines = db.execute(select(CharacterStoryline)).scalars().all()
    for s in storylines:
        story_dict = {k: v for k, v in s.__dict__.items() if not k.startswith('_')}
        data["character_storylines"].append(story_dict)

    # Items
    items = db.execute(select(Item)).scalars().all()
    for i in items:
        item_dict = {k: v for k, v in i.__dict__.items() if not k.startswith('_')}
        data["items"].append(item_dict)

    # Locations
    locations = db.execute(select(Location)).scalars().all()
    for l in locations:
        loc_dict = {k: v for k, v in l.__dict__.items() if not k.startswith('_')}
        data["locations"].append(loc_dict)

    # Factions
    factions = db.execute(select(Faction)).scalars().all()
    for f in factions:
        fac_dict = {k: v for k, v in f.__dict__.items() if not k.startswith('_')}
        data["factions"].append(fac_dict)

    # World Settings
    world_settings = db.execute(select(WorldSetting)).scalars().all()
    for w in world_settings:
        ws_dict = {k: v for k, v in w.__dict__.items() if not k.startswith('_')}
        data["world_settings"].append(ws_dict)

    # Rules
    rules = db.execute(select(Rule)).scalars().all()
    for r in rules:
        rule_dict = {k: v for k, v in r.__dict__.items() if not k.startswith('_')}
        data["rules"].append(rule_dict)

    # Writing Settings
    writing_settings = db.execute(select(WritingSettings)).scalars().one_or_none()
    if writing_settings:
        ws = {k: v for k, v in writing_settings.__dict__.items() if not k.startswith('_')}
        data["writing_settings"] = ws

    # Optional: Chapters and Outlines
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


def main():
    parser = argparse.ArgumentParser(description="Export Auto Novel Writer project data")
    parser.add_argument("--output", "-o", default=None, help="Output file path (default: project_backup_YYYYMMDD_HHMMSS.json)")
    parser.add_argument("--db-path", default="data/story.db", help="Path to SQLite database")
    parser.add_argument("--include-chapters", action="store_true", help="Include chapters and outlines")
    args = parser.parse_args()

    # Resolve database path
    db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), args.db_path)
    if not os.path.exists(db_path):
        print(f"Error: Database not found at {db_path}", file=sys.stderr)
        sys.exit(1)

    # Create engine
    engine = create_engine(f"sqlite:///{db_path}")

    # Export data
    print(f"Exporting data from {db_path}...")
    with Session(engine) as db:
        data = export_all_data(db, include_chapters=args.include_chapters)

    # Determine output file
    if args.output:
        output_path = args.output
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        output_path = f"project_backup_{timestamp}.json"

    # Write output
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Summary
    print(f"Export complete: {output_path}")
    print(f"  Characters: {len(data['characters'])}")
    print(f"  Relationships: {len(data['character_relationships'])}")
    print(f"  Storylines: {len(data['character_storylines'])}")
    print(f"  Items: {len(data['items'])}")
    print(f"  Locations: {len(data['locations'])}")
    print(f"  Factions: {len(data['factions'])}")
    print(f"  World Settings: {len(data['world_settings'])}")
    print(f"  Rules: {len(data['rules'])}")


if __name__ == "__main__":
    main()
