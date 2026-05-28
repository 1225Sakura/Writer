"""Migrate existing BLOB embeddings from the chunks table to sqlite-vec vec0 table.

Run this once after upgrading to sqlite-vec:
    python scripts/migrate_embeddings_to_vec.py
    python scripts/migrate_embeddings_to_vec.py --db path/to/vectors.db
"""

from __future__ import annotations

import argparse
import sqlite3
import sys

import sqlite_vec


def migrate(db_path: str = "data/rag/vectors.db", dimension: int = 1536) -> None:
    """Read embeddings from the chunks/vectors table and insert into vec0.

    Args:
        db_path: Path to the SQLite database
        dimension: Expected embedding dimension (default 1536 for MiniMax embo-01)
    """
    expected_bytes = dimension * 4  # float32 = 4 bytes each

    conn = sqlite3.connect(db_path)
    conn.enable_load_extension(True)
    sqlite_vec.load(conn)
    conn.enable_load_extension(False)

    # Discover which source table exists
    tables = {
        r[0]
        for r in conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        ).fetchall()
    }

    source_table: str | None = None
    for candidate in ("chunks", "vectors"):
        if candidate in tables:
            source_table = candidate
            break

    if source_table is None:
        print("No chunks or vectors table found — nothing to migrate.")
        conn.close()
        return

    # Read existing embeddings
    rows = conn.execute(
        f"SELECT chunk_id, embedding FROM {source_table} WHERE embedding IS NOT NULL"
    ).fetchall()
    print(f"Found {len(rows)} embeddings in '{source_table}' table.")

    if not rows:
        conn.close()
        return

    # Ensure vec0 table exists
    conn.execute(f"""
        CREATE VIRTUAL TABLE IF NOT EXISTS vec_chunks USING vec0(
            chunk_id TEXT PRIMARY KEY,
            embedding float[{dimension}]
        )
    """)
    conn.commit()

    inserted = 0
    skipped = 0
    for chunk_id, blob in rows:
        if blob is None:
            skipped += 1
            continue
        if len(blob) != expected_bytes:
            print(
                f"  SKIP {chunk_id}: expected {expected_bytes} bytes, got {len(blob)}"
            )
            skipped += 1
            continue
        conn.execute(
            "INSERT OR REPLACE INTO vec_chunks(chunk_id, embedding) VALUES (?, ?)",
            (chunk_id, blob),
        )
        inserted += 1

    conn.commit()

    total = conn.execute("SELECT COUNT(*) FROM vec_chunks").fetchone()[0]
    conn.close()

    print(f"Migration complete: inserted={inserted}, skipped={skipped}, total_in_vec={total}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Migrate BLOB embeddings to sqlite-vec vec0 table"
    )
    parser.add_argument(
        "--db",
        default="data/rag/vectors.db",
        help="Path to the SQLite database (default: data/rag/vectors.db)",
    )
    parser.add_argument(
        "--dimension",
        type=int,
        default=1536,
        help="Embedding dimension (default: 1536)",
    )
    args = parser.parse_args()

    try:
        migrate(db_path=args.db, dimension=args.dimension)
    except sqlite3.OperationalError as exc:
        print(f"Database error: {exc}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
