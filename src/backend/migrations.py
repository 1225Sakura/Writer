#!/usr/bin/env python3
"""
Database Migrations Script
Manages database schema versioning and migrations.
"""

import asyncio
import sys
from pathlib import Path

# Add src to path so 'from backend.models.entities' works
_src_dir = Path(__file__).parent.parent / "src"
sys.path.insert(0, str(_src_dir))

from sqlalchemy import text
from database import engine, async_session_maker, Base
from models.entities import (
    Character, CharacterRelationship, CharacterStoryline,
    Item, Location, Faction, WorldSetting, Rule,
    Outline, Chapter, IFLine, DraftVersion, PlotThread,
    ChatSession, ChatMessage, ExtractedEntity,
    WritingSettings, AIInspectionResult
)

# Current schema version
CURRENT_SCHEMA_VERSION = 1

MIGRATIONS = [
    {
        "version": 1,
        "name": "initial_schema",
        "description": "Create all initial tables using SQLAlchemy models",
        "up": None,  # Uses Base.metadata.create_all()
        "down": """
            -- Drop all tables in reverse order of creation
            DROP TABLE IF EXISTS ai_inspection_results;
            DROP TABLE IF EXISTS writing_settings;
            DROP TABLE IF EXISTS extracted_entities;
            DROP TABLE IF EXISTS plot_threads;
            DROP TABLE IF EXISTS draft_versions;
            DROP TABLE IF EXISTS if_lines;
            DROP TABLE IF EXISTS chapters;
            DROP TABLE IF EXISTS outlines;
            DROP TABLE IF EXISTS chat_messages;
            DROP TABLE IF EXISTS chat_sessions;
            DROP TABLE IF EXISTS rules;
            DROP TABLE IF EXISTS world_settings;
            DROP TABLE IF EXISTS factions;
            DROP TABLE IF EXISTS locations;
            DROP TABLE IF EXISTS items;
            DROP TABLE IF EXISTS character_storylines;
            DROP TABLE IF EXISTS character_relationships;
            DROP TABLE IF EXISTS characters;
        """
    },
]


async def get_current_version(session) -> int:
    """Get the current database schema version from meta table."""
    try:
        result = await session.execute(text("SELECT MAX(version) FROM schema_migrations"))
        version = result.scalar()
        return version or 0
    except Exception:
        return 0


async def create_migrations_table(session):
    """Create the migrations tracking table if it doesn't exist."""
    await session.execute(text("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version INTEGER NOT NULL UNIQUE,
            name TEXT NOT NULL,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """))


async def apply_migration(session, migration: dict):
    """Apply a single migration."""
    print(f"  -> Applying migration {migration['version']}: {migration['name']}")
    print(f"    {migration['description']}")

    # Execute the SQL (for manual SQL migrations)
    if migration.get('up'):
        await session.execute(text(migration['up']))

    # Record the migration
    await session.execute(text(
        "INSERT INTO schema_migrations (version, name) VALUES (:version, :name)"
    ), {"version": migration["version"], "name": migration["name"]})

    await session.commit()


def init_db():
    """Initialize database - create all tables using schema.sql."""
    import sqlite3
    from pathlib import Path

    # Use the data directory at project root (D:/writer/data/)
    data_dir = Path(__file__).parent.parent.parent / "data"
    data_dir.mkdir(exist_ok=True)
    db_path = data_dir / "writer.db"

    # Read schema.sql from db directory
    schema_path = Path(__file__).parent / "db" / "schema.sql"
    if not schema_path.exists():
        print(f"Error: Schema file not found at {schema_path}")
        return

    schema_sql = schema_path.read_text(encoding="utf-8")

    # Create connection and enable foreign keys
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA foreign_keys = ON")
    conn.executescript(schema_sql)

    # Record the initial migration as applied
    conn.execute(
        "INSERT OR IGNORE INTO schema_migrations (version, name) VALUES (1, 'initial_schema')"
    )

    conn.commit()
    conn.close()

    print(f"Database initialized at {db_path}")
    return db_path


async def migrate(target_version: int = None):
    """Run all pending migrations."""
    print("Starting database migration...")
    print("=" * 50)

    async with async_session_maker() as session:
        await create_migrations_table(session)
        current_version = await get_current_version(session)

        print(f"Current schema version: {current_version}")
        print(f"Target schema version: {target_version or 'latest'}")

        # Get migrations to apply
        migrations_to_apply = [
            m for m in MIGRATIONS
            if m["version"] > current_version
            and (target_version is None or m["version"] <= target_version)
        ]

        if not migrations_to_apply:
            print("No migrations to apply.")
            return

        print(f"\nFound {len(migrations_to_apply)} migration(s) to apply:\n")

        for migration in migrations_to_apply:
            await apply_migration(session, migration)

        print(f"\n[MIGRATION COMPLETE] Schema version is now {target_version or MIGRATIONS[-1]['version']}")


async def rollback(steps: int = 1):
    """Rollback the last N migrations."""
    print(f"Rolling back {steps} migration(s)...")
    print("=" * 50)

    async with async_session_maker() as session:
        await create_migrations_table(session)
        current_version = await get_current_version(session)

        if current_version == 0:
            print("No migrations to rollback.")
            return

        # Get migrations to rollback
        migrations_to_rollback = [
            m for m in reversed(MIGRATIONS)
            if m["version"] <= current_version
        ][:steps]

        for migration in migrations_to_rollback:
            print(f"  -> Rolling back: {migration['name']}")
            if migration.get('down'):
                # Split statements and execute one at a time
                for stmt in migration['down'].split(';'):
                    stmt = stmt.strip()
                    if stmt:
                        await session.execute(text(stmt))
            await session.execute(text(
                "DELETE FROM schema_migrations WHERE version = :version"
            ), {"version": migration["version"]})
            await session.commit()

        new_version = await get_current_version(session)
        print(f"\n[ROLLBACK COMPLETE] Schema version is now {new_version}")


async def status():
    """Show migration status."""
    async with async_session_maker() as session:
        await create_migrations_table(session)
        current_version = await get_current_version(session)

        print("Migration Status")
        print("=" * 50)
        print(f"Current version:  {current_version}")
        print(f"Total migrations: {len(MIGRATIONS)}")
        print(f"Latest version:    {MIGRATIONS[-1]['version']}")
        print()

        if current_version == MIGRATIONS[-1]['version']:
            print("[OK] Database is up to date")
        else:
            pending = [m for m in MIGRATIONS if m["version"] > current_version]
            print(f"Pending migrations ({len(pending)}):")
            for m in pending:
                print(f"  {m['version']}: {m['name']}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Database migrations")
    parser.add_argument("--target", type=int, help="Target schema version")
    parser.add_argument("--rollback", type=int, const=1, nargs="?", help="Rollback N steps")
    parser.add_argument("--status", action="store_true", help="Show migration status")
    parser.add_argument("--init", action="store_true", help="Initialize database tables")

    args = parser.parse_args()

    if args.init:
        init_db()
    elif args.status:
        asyncio.run(status())
    elif args.rollback:
        asyncio.run(rollback(args.rollback))
    else:
        asyncio.run(migrate(args.target))
