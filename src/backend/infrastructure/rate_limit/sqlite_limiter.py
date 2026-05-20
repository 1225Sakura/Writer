"""
SQLite-backed rate limiter.

Persists rate-limit counters across process restarts.  Uses a dedicated
``rate_limit_entries`` table with automatic TTL cleanup.

Table schema
~~~~~~~~~~~~
::

    CREATE TABLE IF NOT EXISTS rate_limit_entries (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        client_key  TEXT    NOT NULL,
        window_key  TEXT    NOT NULL,
        timestamp   REAL    NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_rl_client_window
        ON rate_limit_entries (client_key, window_key);

``client_key`` is typically an IP address or session identifier.
``window_key`` identifies the rate-limit tier (e.g. "default", "checker").
``timestamp`` is ``time.time()`` when the request was recorded.
"""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path
from typing import Optional

import aiosqlite

logger = logging.getLogger("writer-api.rate_limit")


class SQLiteRateLimiter:
    """
    Async rate limiter backed by a local SQLite database.

    Usage::

        limiter = SQLiteRateLimiter(db_path="data/rate_limit.db")
        await limiter.initialise()
        allowed, limit, remaining = await limiter.check("127.0.0.1", 60, 60.0)
    """

    _DDL = """
        CREATE TABLE IF NOT EXISTS rate_limit_entries (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            client_key  TEXT    NOT NULL,
            window_key  TEXT    NOT NULL,
            timestamp   REAL    NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_rl_client_window
            ON rate_limit_entries (client_key, window_key);
    """

    def __init__(
        self,
        db_path: str | Path = "data/rate_limit.db",
        cleanup_interval: float = 120.0,
        max_age: float = 300.0,
    ):
        self._db_path = str(db_path)
        self._cleanup_interval = cleanup_interval
        self._max_age = max_age
        self._last_cleanup: float = 0.0
        self._lock = asyncio.Lock()
        self._initialised = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def initialise(self) -> None:
        """Create the table if it does not exist."""
        async with aiosqlite.connect(self._db_path) as db:
            await db.executescript(self._DDL)
            await db.commit()
        self._initialised = True
        logger.info("SQLiteRateLimiter initialised at %s", self._db_path)

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------

    async def check(
        self,
        client_key: str,
        max_requests: int,
        window_seconds: float,
        window_name: str = "default",
    ) -> tuple[bool, int, int]:
        """
        Record a request and check whether the client is within the limit.

        Returns ``(allowed, limit, remaining)``.
        """
        if not self._initialised:
            await self.initialise()

        now = time.time()

        async with self._lock:
            async with aiosqlite.connect(self._db_path) as db:
                # Purge old entries for this client+window
                cutoff = now - window_seconds
                await db.execute(
                    "DELETE FROM rate_limit_entries "
                    "WHERE client_key = ? AND window_key = ? AND timestamp < ?",
                    (client_key, window_name, cutoff),
                )

                # Count current entries
                cursor = await db.execute(
                    "SELECT COUNT(*) FROM rate_limit_entries "
                    "WHERE client_key = ? AND window_key = ?",
                    (client_key, window_name),
                )
                count = (await cursor.fetchone())[0]

                remaining = max(0, max_requests - count)

                if count >= max_requests:
                    await db.commit()
                    return False, max_requests, 0

                # Insert the new timestamp
                await db.execute(
                    "INSERT INTO rate_limit_entries (client_key, window_key, timestamp) "
                    "VALUES (?, ?, ?)",
                    (client_key, window_name, now),
                )
                await db.commit()

                # Opportunistic cleanup of stale entries
                await self._maybe_cleanup(db, now)

                return True, max_requests, remaining - 1

    # ------------------------------------------------------------------
    # Housekeeping
    # ------------------------------------------------------------------

    async def _maybe_cleanup(self, db: aiosqlite.Connection, now: float) -> None:
        """Delete entries older than ``max_age`` if enough time has passed."""
        if now - self._last_cleanup < self._cleanup_interval:
            return
        self._last_cleanup = now
        cutoff = now - self._max_age
        await db.execute(
            "DELETE FROM rate_limit_entries WHERE timestamp < ?", (cutoff,)
        )
        logger.debug("SQLiteRateLimiter: cleaned up entries older than %.0f", cutoff)

    async def reset(self, client_key: Optional[str] = None) -> None:
        """Reset rate-limit counters.  If *client_key* is given, only that key."""
        async with aiosqlite.connect(self._db_path) as db:
            if client_key:
                await db.execute(
                    "DELETE FROM rate_limit_entries WHERE client_key = ?",
                    (client_key,),
                )
            else:
                await db.execute("DELETE FROM rate_limit_entries")
            await db.commit()

    async def close(self) -> None:
        """No persistent connection to close, but provided for interface symmetry."""
        pass
