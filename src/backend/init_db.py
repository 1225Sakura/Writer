# Auto Novel Writer - Database Initialization Script
# Run this to create database tables from schema.sql

import sqlite3
import sys
from pathlib import Path


def init_db(schema_path: str = "schema.sql", db_path: str = "../data/writer.db"):
    """Initialize the database by running schema.sql."""
    # Resolve paths relative to this script
    base_dir = Path(__file__).parent
    schema_file = base_dir / schema_path
    db_file = base_dir / db_path

    # Create data directory if it doesn't exist
    db_file.parent.mkdir(parents=True, exist_ok=True)

    # Read schema
    if not schema_file.exists():
        print(f"Error: Schema file not found at {schema_file}")
        sys.exit(1)

    schema_sql = schema_file.read_text(encoding="utf-8")

    # Connect and execute schema
    conn = sqlite3.connect(db_file)
    try:
        conn.executescript(schema_sql)
        conn.commit()
        print(f"Database initialized successfully at {db_file}")
    except sqlite3.Error as e:
        print(f"Error initializing database: {e}")
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Initialize the database")
    parser.add_argument("--schema", default="schema.sql", help="Path to schema.sql")
    parser.add_argument("--db", default="../data/writer.db", help="Path to output database")
    args = parser.parse_args()

    init_db(args.schema, args.db)
