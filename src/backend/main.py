# Auto Novel Writer - FastAPI Main Application
# Python 3.11+

import logging
import json
import asyncio
import signal
import time
from collections import defaultdict
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, timedelta

from config import settings
from routes import api_router
from middleware.logging import setup_logging_middleware
from middleware.errors import register_exception_handlers
from middleware.rate_limit import RateLimitMiddleware
from middleware.performance import setup_performance_middleware
from middleware.request_context import set_request_context
from utils.logging import setup_logging, get_logger

# WebSocket auth - verify API key from query param
async def verify_websocket_auth(api_key: Optional[str]) -> bool:
    """Verify API key for WebSocket connections."""
    if getattr(settings, 'auth_skip_localhost', True):
        # Allow localhost without auth
        return True
    if not api_key:
        return False
    from middleware.auth import get_or_create_api_key
    valid_key = await get_or_create_api_key()
    import secrets
    return secrets.compare_digest(api_key, valid_key)

# Setup structured logging
setup_logging(level="INFO", json_logs=False)
logger = get_logger('writer-api')

# Allowed WebSocket origins (localhost + configured CORS origins)
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
# Add configured CORS origins
ALLOWED_WS_ORIGINS.update(settings.cors_origins)


def _is_allowed_websocket_origin(origin):
    """
    Validate WebSocket Origin header against allowed origins.
    Allows localhost, 127.0.0.1, ::1 and configured CORS origins.
    """
    if origin is None:
        # Some local clients may not send Origin; allow for local desktop app
        return True

    # Exact match
    if origin in ALLOWED_WS_ORIGINS:
        return True

    # Check prefix match for localhost origins with any port
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

# Graceful shutdown state
_shutdown_event = asyncio.Event()
_pending_tasks: set = set()


# WebSocket connection manager
@dataclass
class QueuedMessage:
    """Message queued for a disconnected client."""
    data: dict
    timestamp: float
    retry_count: int = 0


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
        self.connection_last_pong: Dict[int, float] = {}  # Track last pong received

        # Heartbeat configuration
        self.heartbeat_interval = heartbeat_interval
        self.heartbeat_timeout = heartbeat_timeout

        # Message queue for disconnected clients: session_id -> list of QueuedMessage
        self.message_queues: Dict[int, List[QueuedMessage]] = defaultdict(list)
        self.max_queue_size = max_queue_size

        # Rate limiting: session_id -> list of timestamps
        self.rate_limit_tracking: Dict[int, List[float]] = defaultdict(list)
        self.rate_limit_window = rate_limit_window
        self.rate_limit_max_messages = rate_limit_max_messages

        # Message size limit
        self.max_message_size = max_message_size

        # Track connection metadata
        self.connection_metadata: Dict[tuple, dict] = {}

    async def connect(self, websocket: WebSocket, session_id: int, metadata: Optional[dict] = None):
        """Accept WebSocket connection and register it."""
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
            self.connection_status[session_id] = "connected"
        self.active_connections[session_id].append(websocket)
        self.connection_last_pong[id(websocket)] = time.time()

        # Store metadata
        if metadata:
            self.connection_metadata[(id(websocket), session_id)] = metadata

        logger.info(f"WebSocket connected: session={session_id}, total={len(self.active_connections[session_id])}")

    def disconnect(self, websocket: WebSocket, session_id: int):
        """Remove WebSocket from active connections and clean up."""
        ws_id = id(websocket)
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
                self.connection_status[session_id] = "disconnected"
                del self.connection_status[session_id]
                # Clean up rate limiting data
                if session_id in self.rate_limit_tracking:
                    del self.rate_limit_tracking[session_id]
        # Clean up pong tracking
        self.connection_last_pong.pop(ws_id, None)
        # Clean up metadata
        self.connection_metadata.pop((ws_id, session_id), None)
        logger.info(f"WebSocket disconnected: session={session_id}")

    async def close_all(self):
        """Close all WebSocket connections gracefully."""
        for session_id, connections in list(self.active_connections.items()):
            for ws in connections:
                try:
                    if ws.client_state == WebSocketState.CONNECTED:
                        await ws.close(code=1001, reason="Server shutting down")
                except Exception:
                    pass
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
            except Exception:
                dead_connections.append(connection)

        # Clean up dead connections
        for ws in dead_connections:
            self.disconnect(ws, session_id)

    async def send_personal(self, websocket: WebSocket, message: dict):
        """Send message to a specific WebSocket connection."""
        try:
            if websocket.client_state == WebSocketState.CONNECTED:
                await websocket.send_json(message)
        except Exception:
            pass

    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        for session_id, connections in list(self.active_connections.items()):
            await self.send_to_session(session_id, message)

    def check_rate_limit(self, session_id: int) -> tuple[bool, dict]:
        """
        Check if session is within rate limit.
        Returns (allowed, info_dict).
        """
        now = time.time()
        # Clean old entries
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

    async def queue_message(self, session_id: int, message: dict):
        """
        Queue a message for a session that may be temporarily disconnected.
        Messages are stored for later delivery when client reconnects.
        """
        if session_id not in self.message_queues:
            self.message_queues[session_id] = []

        if len(self.message_queues[session_id]) >= self.max_queue_size:
            # Remove oldest message if queue is full
            self.message_queues[session_id].pop(0)

        self.message_queues[session_id].append(QueuedMessage(
            data=message,
            timestamp=time.time(),
            retry_count=0
        ))
        logger.debug(f"Queued message for session {session_id}, queue size: {len(self.message_queues[session_id])}")

    def get_queued_messages(self, session_id: int) -> List[dict]:
        """Get all queued messages for a session and clear the queue."""
        messages = [q.data for q in self.message_queues.get(session_id, [])]
        self.message_queues.pop(session_id, None)
        return messages

    def has_queued_messages(self, session_id: int) -> bool:
        """Check if a session has queued messages."""
        return session_id in self.message_queues and len(self.message_queues[session_id]) > 0

    def get_queue_size(self, session_id: int) -> int:
        """Get the number of queued messages for a session."""
        return len(self.message_queues.get(session_id, []))

    def validate_message_size(self, message: str) -> tuple[bool, str]:
        """Validate that a message doesn't exceed the size limit."""
        size = len(message.encode('utf-8'))
        if size > self.max_message_size:
            return False, f"Message size {size} exceeds limit of {self.max_message_size}"
        return True, ""

    def get_status(self, session_id: int) -> dict:
        """Get connection status for a session."""
        return {
            "session_id": session_id,
            "status": self.connection_status.get(session_id, "unknown"),
            "connections": len(self.active_connections.get(session_id, [])),
            "queued_messages": self.get_queue_size(session_id),
            "rate_limit": {
                "remaining": self.rate_limit_max_messages - len(self.rate_limit_tracking.get(session_id, [])),
                "limit": self.rate_limit_max_messages,
                "window": self.rate_limit_window
            }
        }

    def get_all_status(self) -> dict:
        """Get status of all sessions."""
        return {
            "total_sessions": len(self.active_connections),
            "total_connections": sum(len(conns) for conns in self.active_connections.values()),
            "sessions": {
                sid: {
                    "status": status,
                    "connections": len(conns),
                    "queued_messages": self.get_queue_size(sid),
                    "rate_limit_remaining": self.rate_limit_max_messages - len(self.rate_limit_tracking.get(sid, []))
                }
                for sid, (status, conns) in [
                    (sid, (self.connection_status.get(sid, "unknown"), self.active_connections.get(sid, [])))
                    for sid in set(list(self.connection_status.keys()) + list(self.active_connections.keys()))
                ]
            }
        }


manager = ConnectionManager()


def _handle_signal(sig: int, frame):
    """Handle OS signals for graceful shutdown."""
    sig_name = signal.Signals(sig).name
    logger.info(f"Received signal {sig_name}, initiating graceful shutdown...")
    _shutdown_event.set()


async def _wait_for_pending_tasks(timeout: float = 30.0):
    """Wait for pending background tasks to complete."""
    if not _pending_tasks:
        return

    logger.info(f"Waiting for {len(_pending_tasks)} pending tasks to complete...")
    pending = list(_pending_tasks)
    done, not_done = await asyncio.wait(pending, timeout=timeout)

    for task in not_done:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    logger.info(f"Completed {len(done)} tasks, cancelled {len(not_done)} tasks")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager with graceful startup/shutdown."""
    # Register signal handlers
    try:
        signal.signal(signal.SIGTERM, _handle_signal)
        signal.signal(signal.SIGINT, _handle_signal)
    except (ValueError, OSError):
        pass  # May fail in some environments (e.g., Windows with certain configs)

    # Startup
    logger.info("Application starting up...")

    # Check database migrations are current
    try:
        from utils.migrations import check_migrations_current
        migrations_ok = await check_migrations_current()
        if migrations_ok:
            logger.info("Database migrations are current")
        else:
            logger.warning("Database migrations are NOT current. Run: alembic upgrade head")
    except ImportError:
        logger.debug("Migration check utility not available")
    except Exception as e:
        logger.warning(f"Migration check failed: {e}")

    # Start background task queue if available
    try:
        from services.task_queue import task_queue
        await task_queue.start()
        logger.info("Background task queue started")
    except ImportError:
        logger.debug("Task queue not available")
    except Exception as e:
        logger.warning(f"Failed to start task queue: {e}")

    logger.info("Application startup complete")

    yield

    # Shutdown
    logger.info("Application shutting down...")

    # Close all WebSocket connections
    await manager.close_all()

    # Wait for pending tasks
    await _wait_for_pending_tasks(timeout=30.0)

    # Stop background task queue
    try:
        from services.task_queue import task_queue
        await task_queue.stop()
        logger.info("Background task queue stopped")
    except ImportError:
        pass
    except Exception as e:
        logger.warning(f"Failed to stop task queue: {e}")

    logger.info("Application shutdown complete")


# Create FastAPI app with lifespan
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
    description="Auto Novel Writer API - AI-powered Chinese web novel writing assistant",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiting middleware for /api/v1/chat and /api/v1/ai routes
app.add_middleware(RateLimitMiddleware, rate_limit=60, window_seconds=60.0)

# Include API routes
app.include_router(api_router)


# Setup comprehensive logging middleware
setup_logging_middleware(app)

# Setup performance monitoring middleware
setup_performance_middleware(app)

# Setup error handling with custom exceptions
register_exception_handlers(app)


@app.get("/")
async def root():
    return {"message": "Writer API", "version": settings.app_version}


# Legacy health check - redirects to the new health router
@app.get("/health")
async def legacy_health_check():
    """Legacy health check - redirects to /api/v1/health."""
    from routes.health import health_check
    return await health_check()


# WebSocket status endpoint
@app.get("/ws/status/{session_id}")
async def websocket_status(session_id: int):
    """Get WebSocket connection status for a session."""
    return manager.get_status(session_id)


# WebSocket endpoint for real-time chat
@app.websocket("/ws/chat/{session_id}")
async def websocket_chat(
    websocket: WebSocket,
    session_id: int,
    api_key: Optional[str] = None
):
    """WebSocket endpoint for real-time chat streaming with heartbeat and rate limiting."""
    # Verify auth first
    if not await verify_websocket_auth(api_key):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    # Check rate limit before accepting
    allowed, rate_info = manager.check_rate_limit(session_id)
    if not allowed:
        await websocket.accept()
        await websocket.send_json({
            "type": "error",
            "code": "rate_limit_exceeded",
            "message": "Too many messages",
            "retry_after": rate_info.get("retry_after", 60)
        })
        await websocket.close(code=1008, reason="Rate limit exceeded")
        return

    # Validate Origin header after accept
    origin = websocket.headers.get("origin")
    if not _is_allowed_websocket_origin(origin):
        logger.warning(
            f"WebSocket rejected: invalid origin '{origin}' for session={session_id}"
        )
        await websocket.close(code=4002, reason="Invalid Origin")
        return

    await manager.connect(websocket, session_id)
    ping_task = None
    stale_task = None

    async def send_ping():
        """Send ping at configured interval to keep connection alive."""
        while True:
            await asyncio.sleep(manager.heartbeat_interval)
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json({"type": "ping", "timestamp": time.time()})
                else:
                    break
            except Exception:
                break

    async def check_stale():
        """Periodically check if connection has become stale."""
        while True:
            await asyncio.sleep(manager.heartbeat_interval)
            if manager.is_stale(websocket, session_id):
                logger.warning(f"Closing stale connection: session={session_id}")
                try:
                    await websocket.close(code=1002, reason="Connection stale - no pong received")
                except Exception:
                    pass
                break

    try:
        # Start ping and stale-check tasks
        ping_task = asyncio.create_task(send_ping())
        stale_task = asyncio.create_task(check_stale())
        _pending_tasks.add(ping_task)
        _pending_tasks.add(stale_task)

        # Deliver any queued messages on connect
        queued = manager.get_queued_messages(session_id)
        for msg in queued:
            await manager.send_personal(websocket, {**msg, "type": "queued_message"})

        while True:
            # Receive message from client
            data = await websocket.receive_text()

            # Handle pong response from client
            if data == "pong":
                manager.update_pong(websocket)
                continue

            # Validate message size
            valid, error_msg = manager.validate_message_size(data)
            if not valid:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "code": "message_too_large",
                    "message": error_msg
                })
                continue

            # Check rate limit for this message
            allowed, rate_info = manager.check_rate_limit(session_id)
            if not allowed:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "code": "rate_limit_exceeded",
                    "message": "Too many messages",
                    "retry_after": rate_info.get("retry_after", 60)
                })
                continue

            try:
                message_data = json.loads(data)
            except json.JSONDecodeError as e:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "code": "invalid_json",
                    "message": f"Invalid JSON: {str(e)}"
                })
                continue

            # Broadcast to all connections in this session
            await manager.send_to_session(session_id, {
                "type": "message",
                "content": message_data.get("content", ""),
                "role": message_data.get("role", "user"),
            })
    except WebSocketDisconnect:
        logger.debug(f"WebSocket disconnected normally: session={session_id}")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        manager.disconnect(websocket, session_id)
        if ping_task:
            ping_task.cancel()
            _pending_tasks.discard(ping_task)
        if stale_task:
            stale_task.cancel()
            _pending_tasks.discard(stale_task)


@app.websocket("/ws")
async def websocket_general(
    websocket: WebSocket,
    api_key: Optional[str] = None
):
    """General WebSocket endpoint for real-time updates with heartbeat."""
    # Verify auth first
    if not await verify_websocket_auth(api_key):
        await websocket.close(code=4001, reason="Unauthorized")
        return

    await websocket.accept()

    # Validate Origin header after accept
    origin = websocket.headers.get("origin")
    if not _is_allowed_websocket_origin(origin):
        logger.warning(
            f"WebSocket rejected: invalid origin '{origin}' for general endpoint"
        )
        await websocket.close(code=4002, reason="Invalid Origin")
        return

    async def send_ping():
        """Send ping at configured interval to keep connection alive."""
        while True:
            await asyncio.sleep(manager.heartbeat_interval)
            try:
                if websocket.client_state == WebSocketState.CONNECTED:
                    await websocket.send_json({"type": "ping", "timestamp": time.time()})
                else:
                    break
            except Exception:
                break

    ping_task = asyncio.create_task(send_ping())
    _pending_tasks.add(ping_task)
    try:
        while True:
            data = await websocket.receive_text()

            # Handle pong response from client
            if data == "pong":
                manager.update_pong(websocket)
                continue

            # Validate message size
            valid, error_msg = manager.validate_message_size(data)
            if not valid:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "code": "message_too_large",
                    "message": error_msg
                })
                continue

            try:
                message_data = json.loads(data)
            except json.JSONDecodeError as e:
                await manager.send_personal(websocket, {
                    "type": "error",
                    "code": "invalid_json",
                    "message": f"Invalid JSON: {str(e)}"
                })
                continue

            # Handle general messages
            await websocket.send_json({"type": "ack", "received": True})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ping_task.cancel()
        _pending_tasks.discard(ping_task)
