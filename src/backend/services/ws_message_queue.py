"""
SQLite-backed WebSocket message queue.

Persists queued messages so they survive server restarts and are replayed
when a client reconnects.

Table schema
~~~~~~~~~~~~
::

    CREATE TABLE IF NOT EXISTS ws_message_queue (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id  INTEGER NOT NULL,
        message_json TEXT   NOT NULL,
        created_at  REAL    NOT NULL,
        delivered   INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_wsmq_session
        ON ws_message_queue (session_id, delivered);
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import List, Optional

import aiosqlite

logger = logging.getLogger("writer-api.ws_queue")


class WSMessageQueue:
    """
    SQLite-backed message queue for WebSocket reconnection resilience.

    Usage::

        queue = WSMessageQueue(db_path="data/ws_queue.db")
        await queue.initialise()
        await queue.enqueue(session_id=1, message={"type": "msg", "content": "hello"})
        messages = await queue.dequeue_all(session_id=1)
    """

    _DDL = """
        CREATE TABLE IF NOT EXISTS ws_message_queue (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id   INTEGER NOT NULL,
            message_json TEXT    NOT NULL,
            created_at   REAL    NOT NULL,
            delivered    INTEGER NOT NULL DEFAULT 0
        );
        CREATE INDEX IF NOT EXISTS idx_wsmq_session
            ON ws_message_queue (session_id, delivered);
    """

    def __init__(
        self,
        db_path: str | Path = "data/ws_queue.db",
        max_queue_per_session: int = 100,
        max_message_age: float = 3600.0,  # 1 hour
    ):
        self._db_path = str(db_path)
        self._max_queue = max_queue_per_session
        self._max_age = max_message_age
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
        logger.info("WSMessageQueue initialised at %s", self._db_path)

    # ------------------------------------------------------------------
    # Core API
    # ------------------------------------------------------------------

    async def enqueue(self, session_id: int, message: dict) -> None:
        """
        Queue a message for *session_id*.

        If the queue for this session is full, the oldest undelivered
        message is dropped first.
        """
        if not self._initialised:
            await self.initialise()

        async with self._lock:
            async with aiosqlite.connect(self._db_path) as db:
                # Trim old entries for this session
                cutoff = time.time() - self._max_age
                await db.execute(
                    "DELETE FROM ws_message_queue "
                    "WHERE session_id = ? AND (delivered = 1 OR created_at < ?)",
                    (session_id, cutoff),
                )

                # Enforce per-session size cap
                cursor = await db.execute(
                    "SELECT COUNT(*) FROM ws_message_queue "
                    "WHERE session_id = ? AND delivered = 0",
                    (session_id,),
                )
                count = (await cursor.fetchone())[0]

                if count >= self._max_queue:
                    # Drop oldest undelivered message
                    await db.execute(
                        "DELETE FROM ws_message_queue WHERE id = ("
                        "  SELECT id FROM ws_message_queue "
                        "  WHERE session_id = ? AND delivered = 0 "
                        "  ORDER BY created_at ASC LIMIT 1"
                        ")",
                        (session_id,),
                    )

                await db.execute(
                    "INSERT INTO ws_message_queue (session_id, message_json, created_at) "
                    "VALUES (?, ?, ?)",
                    (session_id, json.dumps(message, ensure_ascii=False), time.time()),
                )
                await db.commit()

        logger.debug("Enqueued message for session %d", session_id)

    async def dequeue_all(self, session_id: int) -> List[dict]:
        """
        Retrieve and mark as delivered all queued messages for *session_id*.

        Returns the messages in chronological order and deletes them from
        the queue.
        """
        if not self._initialised:
            await self.initialise()

        messages: List[dict] = []

        async with self._lock:
            async with aiosqlite.connect(self._db_path) as db:
                cursor = await db.execute(
                    "SELECT id, message_json FROM ws_message_queue "
                    "WHERE session_id = ? AND delivered = 0 "
                    "ORDER BY created_at ASC",
                    (session_id,),
                )
                rows = await cursor.fetchall()

                for row_id, msg_json in rows:
                    try:
                        messages.append(json.loads(msg_json))
                    except json.JSONDecodeError:
                        logger.warning("Skipping malformed queued message id=%d", row_id)

                if rows:
                    ids = [r[0] for r in rows]
                    placeholders = ",".join("?" * len(ids))
                    await db.execute(
                        f"DELETE FROM ws_message_queue WHERE id IN ({placeholders})",
                        ids,
                    )

                await db.commit()

        if messages:
            logger.info("Dequeued %d message(s) for session %d", len(messages), session_id)

        return messages

    async def has_messages(self, session_id: int) -> bool:
        """Check whether there are pending messages for *session_id*."""
        if not self._initialised:
            await self.initialise()

        async with aiosqlite.connect(self._db_path) as db:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM ws_message_queue "
                "WHERE session_id = ? AND delivered = 0",
                (session_id,),
            )
            count = (await cursor.fetchone())[0]
            return count > 0

    async def queue_size(self, session_id: int) -> int:
        """Return the number of pending messages for *session_id*."""
        if not self._initialised:
            await self.initialise()

        async with aiosqlite.connect(self._db_path) as db:
            cursor = await db.execute(
                "SELECT COUNT(*) FROM ws_message_queue "
                "WHERE session_id = ? AND delivered = 0",
                (session_id,),
            )
            return (await cursor.fetchone())[0]

    async def cleanup(self, max_age: Optional[float] = None) -> int:
        """
        Remove delivered and stale entries.  Returns the number of rows
        deleted.
        """
        if not self._initialised:
            await self.initialise()

        age = max_age if max_age is not None else self._max_age
        cutoff = time.time() - age

        async with self._lock:
            async with aiosqlite.connect(self._db_path) as db:
                cursor = await db.execute(
                    "DELETE FROM ws_message_queue "
                    "WHERE delivered = 1 OR created_at < ?",
                    (cutoff,),
                )
                await db.commit()
                deleted = cursor.rowcount

        if deleted:
            logger.debug("WSMessageQueue cleanup: removed %d stale entries", deleted)
        return deleted

    async def close(self) -> None:
        """No persistent connection to close; provided for interface symmetry."""
        pass
