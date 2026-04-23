# Auto Novel Writer - Database Initialization
# Creates all tables from SQLAlchemy model definitions.

import argparse
import shutil
import sqlite3
import sys
from pathlib import Path


# Ensure backend directory is on path for imports
backend_dir = Path(__file__).parent.parent.resolve()
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
parent_dir = backend_dir.parent
if str(parent_dir) not in sys.path:
    sys.path.insert(0, str(parent_dir))

from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from database import Base
from config import settings

# Import all models so they register with Base.metadata
from core.domain.entities import (
    Project,
    GenreConfiguration,
    BackgroundTask,
    Character,
    CharacterRelationship,
    CharacterStoryline,
    Item,
    Location,
    Faction,
    WorldSetting,
    Rule,
    Outline,
    Chapter,
    IFLine,
    ChatSession,
    ChatMessage,
    ExtractedEntity,
    DraftVersion,
    PlotThread,
    AIInspectionResult,
    WritingSettings,
    WorkflowExecution,
    AgentExecutionLog,
)
from core.domain.extensions import (
    ContextChunk,
    QueryLog,
    EngagementScore,
    HookAnalysis,
    StrandAnalysis,
    PacingRedLineLog,
    GenreProfile,
    WritingGuidanceRecord,
    SnapshotRecord,
    BackupScheduleRecord,
    ArchiveRecord,
    IndexDebtRecord,
    QualityTrendPoint,
    ConstraintRuleRecord,
    ConstraintViolationRecord,
    GraphRelationship,
    SystemMetricPoint,
    NarrativeDebtRecord,
)


def get_db_path() -> Path:
    """Get the database file path from config."""
    url = settings.database_url
    if url.startswith("sqlite+aiosqlite:///"):
        return Path(url[len("sqlite+aiosqlite:///"):])
    return backend_dir / "data" / "writer.db"


def get_sync_database_url() -> str:
    """Convert async aiosqlite URL to sync sqlite URL for init scripts."""
    url = settings.database_url
    if url.startswith("sqlite+aiosqlite:///"):
        return "sqlite:///" + url[len("sqlite+aiosqlite:///"):]
    return url


def create_tables() -> None:
    """Create all tables from SQLAlchemy model metadata to a temp file."""
    db_path = get_db_path()
    temp_db = db_path.parent / "temp_init.db"

    # Clean up any existing temp file
    if temp_db.exists():
        temp_db.unlink()

    temp_url = f"sqlite:///{temp_db}"
    engine = create_engine(temp_url, poolclass=NullPool, echo=False)
    with engine.begin() as conn:
        Base.metadata.create_all(bind=conn)
    engine.dispose()

    # Copy data from temp to actual db using raw sqlite3 to avoid engine issues
    if db_path.exists():
        # Copy WAL and shm files too if they exist
        for suffix in ["-wal", "-shm"]:
            wal_file = Path(str(db_path) + suffix)
            if wal_file.exists():
                wal_file.unlink()
        db_path.unlink()

    # Copy temp to final location
    shutil.copy(str(temp_db), str(db_path))
    temp_db.unlink()

    print("Database tables created successfully.")


def create_database(db_path: Path | None = None) -> None:
    """Create the database and initialize all tables."""
    if db_path is None:
        db_path = get_db_path()

    db_path.parent.mkdir(parents=True, exist_ok=True)
    create_tables()
    print(f"Database created successfully: {db_path}")


def reset_database(db_path: Path | None = None) -> None:
    """Delete all tables and recreate them from model definitions."""
    if db_path is None:
        db_path = get_db_path()

    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Delete all tables using raw SQL
    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = [r[0] for r in cursor.fetchall()]
    for table in tables:
        cursor.execute(f"DROP TABLE IF EXISTS {table}")
    conn.commit()
    conn.close()
    print(f"Dropped {len(tables)} tables")

    # Create all tables fresh
    create_tables()
    print(f"Database reset successfully at: {db_path}")


def init_database() -> None:
    """Initialize database if it doesn't exist, otherwise do nothing."""
    db_path = get_db_path()

    if db_path.exists():
        print(f"Database already exists: {db_path}")
        return

    create_database(db_path)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Initialize the novel writer database")
    parser.add_argument(
        "--db",
        default=None,
        help="Path to output database file (overrides config default)",
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing tables and recreate all tables",
    )
    args = parser.parse_args()

    db_path = Path(args.db) if args.db else None

    if args.reset:
        reset_database(db_path)
    else:
        init_database()
