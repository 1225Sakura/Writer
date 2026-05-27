"""WebSocket ConnectionManager: connection lifecycle, heartbeat, queuing, rate limiting."""

import asyncio
import logging
import secrets
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Dict, List, Optional

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from backend.config import settings
from backend.utils.logging import get_logger

logger = get_logger('writer-api')

# ── Origin validation ────────────────────────────────────────────────

ALLOWED_WS_ORIGINS = {
    "http://localhost",
    "https://localhost",
    "http://127.0.0.1",
    "https://127.0.0.1",
    "http://[::1]",
    "https://[::1]",
    "http://localhost:5173",
    "https://localhost:5173",
    "http://127.0.0.1:5173",
    "https://127.0.0.1:5173",
}
ALLOWED_WS_ORIGINS.update(settings.cors_origins)


def is_allowed_websocket_origin(origin: Optional[str]) -> bool:
    """Validate WebSocket Origin header against allowed origins.

    Allows localhost, 127.0.0.1, ::1 and configured CORS origins.
    """
    if origin is None:
        return True
    if origin in ALLOWED_WS_ORIGINS:
        return True
    allowed_prefixes = [
        "http://localhost:",
        "https://localhost:",
        "http://127.0.0.1:",
        "https://127.0.0.1:",
    ]
    for prefix in allowed_prefixes:
        if origin.startswith(prefix):
            return True
    return False


# ── Auth helper ──────────────────────────────────────────────────────

async def verify_websocket_auth(api_key: Optional[str]) -> bool:
    """Verify API key for WebSocket connections."""
    if getattr(settings, 'auth_skip_localhost', True):
        return True
    if not api_key:
        return False
    from backend.middleware.auth import get_or_create_api_key
    valid_key = await get_or_create_api_key()
    return secrets.compare_digest(api_key, valid_key)


# ── Queued message ───────────────────────────────────────────────────

@dataclass
class QueuedMessage:
    """Message queued for a disconnected client."""
    data: dict
    timestamp: float
    retry_count: int = 0


# ── ConnectionManager ────────────────────────────────────────────────

class ConnectionManager:
    """Manage WebSocket connections for real-time chat with heartbeat, queuing, and rate limiting."""

    def __init__(
        self,
        heartbeat_interval: float = 30.0,
        heartbeat_timeout: float = 90.0,
        max_queue_size: int = 100,
        max_message_size: int = 65536,
        rate_limit_window: float = 60.0,
        rate_limit_max_messages: int = 120,
    ):
        self.active_connections: Dict[int, List[WebSocket]] = {}
        self.connection_status: Dict[int, str] = {}
        self.connection_last_pong: Dict[int, float] = {}

        self.heartbeat_interval = heartbeat_interval
        self.heartbeat_timeout = heartbeat_timeout

        self.message_queues: Dict[int, List[QueuedMessage]] = defaultdict(list)
        self.max_queue_size = max_queue_size

        self.ws_queue = None  # Optional[WSMessageQueue]

        self.rate_limit_tracking: Dict[int, List[float]] = defaultdict(list)
        self.rate_limit_window = rate_limit_window
        self.rate_limit_max_messages = rate_limit_max_messages

        self.max_message_size = max_message_size

        self.connection_metadata: Dict[tuple, dict] = {}

    @property
    def total_connections(self) -> int:
        """Total number of active WebSocket connections across all sessions."""
        return sum(len(conns) for conns in self.active_connections.values())

    async def connect(self, websocket: WebSocket, session_id: int, metadata: Optional[dict] = None):
        """Accept WebSocket connection and register it."""
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
            self.connection_status[session_id] = "connected"
        self.active_connections[session_id].append(websocket)
        self.connection_last_pong[id(websocket)] = time.time()

        if metadata:
            self.connection_metadata[(id(websocket), session_id)] = metadata

        logger.info("WebSocket connected: session=%s, total=%d", session_id, len(self.active_connections[session_id]))
        from backend.infrastructure.observability.metrics_service import metrics_service
        asyncio.create_task(
            metrics_service.set_active_websocket_connections(self.total_connections)
        )

    def disconnect(self, websocket: WebSocket, session_id: int):
        """Remove WebSocket from active connections and clean up."""
        ws_id = id(websocket)
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
                if session_id in self.connection_status:
                    del self.connection_status[session_id]
                if session_id in self.rate_limit_tracking:
                    del self.rate_limit_tracking[session_id]
        self.connection_last_pong.pop(ws_id, None)
        self.connection_metadata.pop((ws_id, session_id), None)
        logger.info("WebSocket disconnected: session=%s", session_id)
        from backend.infrastructure.observability.metrics_service import metrics_service
        asyncio.create_task(
            metrics_service.set_active_websocket_connections(self.total_connections)
        )

    async def close_all(self):
        """Close all WebSocket connections gracefully."""
        for session_id, connections in list(self.active_connections.items()):
            for ws in connections:
                try:
                    if ws.client_state == WebSocketState.CONNECTED:
                        await ws.close(code=1001, reason="Server shutting down")
                except Exception as e:
                    logger.debug("Error closing WebSocket during shutdown: %s", e)
        self.active_connections.clear()
        self.connection_status.clear()
        self.connection_last_pong.clear()
        self.message_queues.clear()
        self.rate_limit_tracking.clear()
        self.connection_metadata.clear()
        logger.info("All WebSocket connections closed")

    async def send_to_session(self, session_id: int, message: dict):
        """Send message to all connections in a session."""
        if session_id not in self.active_connections:
            return

        dead_connections = []
        for connection in self.active_connections[session_id]:
            try:
                if connection.client_state == WebSocketState.CONNECTED:
                    await connection.send_json(message)
                else:
                    dead_connections.append(connection)
            except Exception as e:
                logger.debug("WebSocket send failed, marking as dead: %s", e)
                dead_connections.append(connection)

        for ws in dead_connections:
            self.disconnect(ws, session_id)

    async def send_personal(self, websocket: WebSocket, message: dict):
        """Send message to a specific WebSocket connection."""
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json(message)
        except Exception as e:
            logger.warning("Failed to send personal message: %s", e)

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        for session_id, connections in list(self.active_connections.items()):
            await self.send_to_session(session_id, message)

    def check_rate_limit(self, session_id: int) -> tuple[bool, dict]:
        """Check if session is within rate limit."""
        now = time.time()
        self.rate_limit_tracking[session_id] = [
            ts for ts in self.rate_limit_tracking[session_id]
            if now - ts < self.rate_limit_window
        ]

        count = len(self.rate_limit_tracking[session_id])
        if count >= self.rate_limit_max_messages:
            return False, {
                "allowed": False,
                "limit": self.rate_limit_max_messages,
                "window": self.rate_limit_window,
                "current_count": count,
                "retry_after": self.rate_limit_window - (now - self.rate_limit_tracking[session_id][0]) if self.rate_limit_tracking[session_id] else 0
            }

        self.rate_limit_tracking[session_id].append(now)
        return True, {
            "allowed": True,
            "limit": self.rate_limit_max_messages,
            "remaining": self.rate_limit_max_messages - count - 1,
            "window": self.rate_limit_window
        }

    def is_connected(self, websocket: WebSocket, session_id: int) -> bool:
        """Check if a WebSocket is still connected."""
        return (
            session_id in self.active_connections and
            websocket in self.active_connections[session_id] and
            websocket.client_state == WebSocketState.CONNECTED
        )

    def update_pong(self, websocket: WebSocket):
        """Record that a pong was received from a client."""
        self.connection_last_pong[id(websocket)] = time.time()

    def is_stale(self, websocket: WebSocket, session_id: int) -> bool:
        """Check if connection is stale (hasn't responded to pings)."""
        ws_id = id(websocket)
        if ws_id not in self.connection_last_pong:
            return False
        return time.time() - self.connection_last_pong[ws_id] > self.heartbeat_timeout

    def set_ws_queue(self, ws_queue):
        """Attach a SQLite-backed WSMessageQueue for persistent message queuing."""
        self.ws_queue = ws_queue
        logger.info("ConnectionManager: SQLite-backed message queue attached")

    async def queue_message(self, session_id: int, message: dict):
        """Queue a message for a session that may be temporarily disconnected."""
        if session_id not in self.message_queues:
            self.message_queues[session_id] = []

        if len(self.message_queues[session_id]) >= self.max_queue_size:
            self.message_queues[session_id].pop(0)

        self.message_queues[session_id].append(QueuedMessage(
            data=message,
            timestamp=time.time(),
            retry_count=0
        ))

        if self.ws_queue is not None:
            try:
                await self.ws_queue.enqueue(session_id, message)
            except Exception as e:
                logger.warning("Failed to persist queued message to SQLite: %s", e)

        logger.debug("Queued message for session %s, queue size: %d", session_id, len(self.message_queues[session_id]))

    async def get_queued_messages(self, session_id: int) -> List[dict]:
        """Get all queued messages for a session and clear the queue."""
        messages = [q.data for q in self.message_queues.get(session_id, [])]
        self.message_queues.pop(session_id, None)

        if self.ws_queue is not None:
            try:
                persisted = await self.ws_queue.dequeue_all(session_id)
                if persisted:
                    messages.extend(persisted)
            except Exception as e:
                logger.warning("Failed to dequeue persisted messages: %s", e)

        return messages

    async def has_queued_messages(self, session_id: int) -> bool:
        """Check if a session has queued messages (in-memory or SQLite)."""
        if session_id in self.message_queues and len(self.message_queues[session_id]) > 0:
            return True
        if self.ws_queue is not None:
            try:
                return await self.ws_queue.has_messages(session_id)
            except Exception as e:
                logger.debug("SQLite has_messages check failed: %s", e)
        return False

    async def get_queue_size(self, session_id: int) -> int:
        """Get the number of queued messages for a session (in-memory + SQLite)."""
        count = len(self.message_queues.get(session_id, []))
        if self.ws_queue is not None:
            try:
                count += await self.ws_queue.queue_size(session_id)
            except Exception as e:
                logger.debug("SQLite queue_size check failed: %s", e)
        return count

    def validate_message_size(self, message: str) -> tuple[bool, str]:
        """Validate that a message doesn't exceed the size limit."""
        size = len(message.encode('utf-8'))
        if size > self.max_message_size:
            return False, f"Message size {size} exceeds limit of {self.max_message_size}"
        return True, ""

    async def get_status(self, session_id: int) -> dict:
        """Get connection status for a session."""
        queue_size = await self.get_queue_size(session_id)
        return {
            "session_id": session_id,
            "status": self.connection_status.get(session_id, "unknown"),
            "connections": len(self.active_connections.get(session_id, [])),
            "queued_messages": queue_size,
            "rate_limit": {
                "remaining": self.rate_limit_max_messages - len(self.rate_limit_tracking.get(session_id, [])),
                "limit": self.rate_limit_max_messages,
                "window": self.rate_limit_window
            }
        }

    async def get_all_status(self) -> dict:
        """Get status of all sessions."""
        sessions_info = {}
        for sid in set(list(self.connection_status.keys()) + list(self.active_connections.keys())):
            status = self.connection_status.get(sid, "unknown")
            conns = self.active_connections.get(sid, [])
            queue_size = await self.get_queue_size(sid)
            sessions_info[sid] = {
                "status": status,
                "connections": len(conns),
                "queued_messages": queue_size,
                "rate_limit_remaining": self.rate_limit_max_messages - len(self.rate_limit_tracking.get(sid, []))
            }

        return {
            "total_sessions": len(self.active_connections),
            "total_connections": sum(len(conns) for conns in self.active_connections.values()),
            "sessions": sessions_info,
        }


manager = ConnectionManager()
