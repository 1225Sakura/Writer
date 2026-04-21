# Minimal diskcache stub for TieredCache
import json
import time
import sqlite3
from pathlib import Path


class Cache:
    """Minimal disk-backed cache using SQLite."""

    def __init__(self, directory, timeout=60):
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self._db_path = self.directory / "cache.db"
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(str(self._db_path)) as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value TEXT,
                    expire REAL
                )
                """
            )
            conn.execute("CREATE INDEX IF NOT EXISTS idx_expire ON cache(expire)")
            conn.commit()

    def get(self, key, default=None):
        with sqlite3.connect(str(self._db_path)) as conn:
            row = conn.execute(
                "SELECT value, expire FROM cache WHERE key = ?",
                (key,),
            ).fetchone()
            if row is None:
                return default
            value, expire = row
            if expire is not None and time.time() > expire:
                conn.execute("DELETE FROM cache WHERE key = ?", (key,))
                conn.commit()
                return default
            return json.loads(value)

    def set(self, key, value, expire=None):
        expire_at = time.time() + expire if expire else None
        with sqlite3.connect(str(self._db_path)) as conn:
            conn.execute(
                "INSERT OR REPLACE INTO cache (key, value, expire) VALUES (?, ?, ?)",
                (key, json.dumps(value), expire_at),
            )
            conn.commit()

    def delete(self, key):
        with sqlite3.connect(str(self._db_path)) as conn:
            cur = conn.execute("DELETE FROM cache WHERE key = ?", (key,))
            conn.commit()
            return cur.rowcount > 0

    def clear(self):
        with sqlite3.connect(str(self._db_path)) as conn:
            conn.execute("DELETE FROM cache")
            conn.commit()

    def __len__(self):
        with sqlite3.connect(str(self._db_path)) as conn:
            row = conn.execute("SELECT COUNT(*) FROM cache").fetchone()
            return row[0] if row else 0
