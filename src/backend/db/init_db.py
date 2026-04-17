# Auto Novel Writer - Database Initialization
# Creates all tables from schema.sql

import os
import sqlite3
from pathlib import Path


def get_db_path() -> Path:
    """Get the database file path."""
    return Path(__file__).parent / "novel_writer.db"


def get_schema_path() -> Path:
    """Get the schema.sql file path."""
    return Path(__file__).parent / "schema.sql"


def create_database(db_path: Path | None = None) -> None:
    """Create the database and initialize all tables."""
    if db_path is None:
        db_path = get_db_path()

    schema_path = get_schema_path()
    if not schema_path.exists():
        raise FileNotFoundError(f"Schema file not found: {schema_path}")

    # Ensure directory exists
    db_path.parent.mkdir(parents=True, exist_ok=True)

    # Read schema
    with open(schema_path, "r", encoding="utf-8") as f:
        schema_sql = f.read()

    # Create database and execute schema
    conn = sqlite3.connect(str(db_path))
    try:
        conn.executescript(schema_sql)
        conn.commit()
        print(f"Database created successfully: {db_path}")
    finally:
        conn.close()


def reset_database(db_path: Path | None = None) -> None:
    """Delete existing database and recreate all tables."""
    if db_path is None:
        db_path = get_db_path()

    # Delete existing database if it exists
    if db_path.exists():
        db_path.unlink()
        print(f"Deleted existing database: {db_path}")

    # Create fresh database
    create_database(db_path)


def init_database() -> None:
    """Initialize database if it doesn't exist, otherwise do nothing."""
    db_path = get_db_path()

    if db_path.exists():
        print(f"Database already exists: {db_path}")
        return

    create_database(db_path)


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Initialize the novel writer database")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing database and recreate all tables",
    )
    args = parser.parse_args()

    if args.reset:
        reset_database()
    else:
        init_database()
