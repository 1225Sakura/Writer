# Auto Novel Writer - FastAPI Main Application
# Python 3.11+

import logging
import json
import asyncio
import signal
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, List

from config import settings
from routes import api_router
from middleware.logging import setup_logging_middleware
from middleware.errors import register_exception_handlers
from middleware.rate_limit import RateLimitMiddleware
from middleware.performance import setup_performance_middleware
from middleware.request_context import set_request_context
from utils.logging import setup_logging, get_logger

# Setup structured logging
setup_logging(level="INFO", json_logs=False)
logger = get_logger('writer-api')

# Graceful shutdown state
_shutdown_event = asyncio.Event()
_pending_tasks: set = set()


# WebSocket connection manager
class ConnectionManager:
    """Manage WebSocket connections for real-time chat."""
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}
        self.connection_status: Dict[int, str] = {}  # Track connection status per session

    async def connect(self, websocket: WebSocket, session_id: int):
        await websocket.accept()
        if session_id not in self.active_connections:
            self.active_connections[session_id] = []
            self.connection_status[session_id] = "connected"
        self.active_connections[session_id].append(websocket)
        logger.info(f"WebSocket connected: session={session_id}, total={len(self.active_connections[session_id])}")

    def disconnect(self, websocket: WebSocket, session_id: int):
        if session_id in self.active_connections:
            if websocket in self.active_connections[session_id]:
                self.active_connections[session_id].remove(websocket)
            if not self.active_connections[session_id]:
                del self.active_connections[session_id]
                self.connection_status[session_id] = "disconnected"
                del self.connection_status[session_id]
        logger.info(f"WebSocket disconnected: session={session_id}")

    async def close_all(self):
        """Close all WebSocket connections gracefully."""
        for session_id, connections in list(self.active_connections.items()):
            for ws in connections:
                try:
                    await ws.close(code=1001, reason="Server shutting down")
                except Exception:
                    pass
        self.active_connections.clear()
        self.connection_status.clear()
        logger.info("All WebSocket connections closed")

    async def send_to_session(self, session_id: int, message: dict):
        if session_id in self.active_connections:
            for connection in self.active_connections[session_id]:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    async def broadcast(self, message: dict):
        for connections in self.active_connections.values():
            for connection in connections:
                try:
                    await connection.send_json(message)
                except Exception:
                    pass

    def get_status(self, session_id: int) -> dict:
        """Get connection status for a session."""
        return {
            "session_id": session_id,
            "status": self.connection_status.get(session_id, "unknown"),
            "connections": len(self.active_connections.get(session_id, []))
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
async def websocket_chat(websocket: WebSocket, session_id: int):
    """WebSocket endpoint for real-time chat streaming."""
    await manager.connect(websocket, session_id)
    ping_task = None

    async def send_ping():
        """Send ping every 30 seconds to keep connection alive."""
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_json({"type": "ping", "timestamp": __import__("time").time()})
            except Exception:
                break

    try:
        # Start ping task
        ping_task = asyncio.create_task(send_ping())
        _pending_tasks.add(ping_task)

        while True:
            # Receive message from client
            data = await websocket.receive_text()

            # Handle pong response from client
            if data == "pong":
                continue

            message_data = json.loads(data)

            # Broadcast to all connections in this session
            await manager.send_to_session(session_id, {
                "type": "message",
                "content": message_data.get("content", ""),
                "role": message_data.get("role", "user"),
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket, session_id)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket, session_id)
    finally:
        if ping_task:
            ping_task.cancel()
            _pending_tasks.discard(ping_task)


@app.websocket("/ws")
async def websocket_general(websocket: WebSocket):
    """General WebSocket endpoint for real-time updates."""
    await websocket.accept()

    async def send_ping():
        """Send ping every 30 seconds to keep connection alive."""
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_json({"type": "ping", "timestamp": __import__("time").time()})
            except Exception:
                break

    ping_task = asyncio.create_task(send_ping())
    _pending_tasks.add(ping_task)
    try:
        while True:
            data = await websocket.receive_text()
            # Handle pong response from client
            if data == "pong":
                continue
            message_data = json.loads(data)
            # Handle general messages (could be expanded)
            await websocket.send_json({"type": "ack", "received": True})
    except WebSocketDisconnect:
        pass
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
    finally:
        ping_task.cancel()
        _pending_tasks.discard(ping_task)
