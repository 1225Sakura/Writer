# Auto Novel Writer - FastAPI Main Application
# Python 3.11+

import logging
import json
from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from sqlalchemy import text
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from typing import Dict, List

from config import settings
from routes import api_router
from middleware.logging import setup_logging_middleware
from middleware.errors import register_exception_handlers
from middleware.rate_limit import RateLimitMiddleware
from utils.logging import setup_logging, get_logger

# Setup structured logging
setup_logging(level="INFO", json_logs=False)
logger = get_logger('writer-api')

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

# Create FastAPI app
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
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

# Setup error handling with custom exceptions
register_exception_handlers(app)


@app.get("/")
async def root():
    return {"message": "Writer API", "version": settings.app_version}


@app.get("/health")
async def health_check():
    """
    Comprehensive health check endpoint for monitoring.
    Verifies database connectivity and dependency status.
    """
    import sys
    import platform
    import importlib

    health_status = {
        "status": "healthy",
        "app": {
            "name": settings.app_name,
            "version": settings.app_version,
        },
        "dependencies": {},
        "database": {"status": "unknown"},
        "system": {
            "python_version": sys.version,
            "platform": platform.platform(),
        }
    }

    # Check database connection
    try:
        from database import engine
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        health_status["database"] = {"status": "connected"}
    except Exception as e:
        health_status["database"] = {"status": "error", "detail": str(e)}
        health_status["status"] = "degraded"

    # Check key dependencies
    dependencies = [
        ("fastapi", "FastAPI"),
        ("sqlalchemy", "SQLAlchemy"),
        ("aiosqlite", "aiosqlite"),
        ("pydantic_settings", "pydantic-settings"),
    ]

    for module_name, display_name in dependencies:
        try:
            mod = importlib.import_module(module_name)
            version = getattr(mod, "__version__", "unknown")
            health_status["dependencies"][display_name] = {"status": "available", "version": version}
        except ImportError:
            health_status["dependencies"][display_name] = {"status": "missing"}
            health_status["status"] = "degraded"

    # Check AI service availability (if configured)
    try:
        from services.ai_service import ai_service
        if settings.minimax_api_key:
            health_status["dependencies"]["minimax_api"] = {
                "status": "configured",
                "url": settings.minimax_api_url,
            }
        else:
            health_status["dependencies"]["minimax_api"] = {
                "status": "not_configured",
            }
    except Exception:
        pass

    return health_status


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
    import asyncio
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


@app.websocket("/ws")
async def websocket_general(websocket: WebSocket):
    """General WebSocket endpoint for real-time updates."""
    await websocket.accept()
    import asyncio

    async def send_ping():
        """Send ping every 30 seconds to keep connection alive."""
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_json({"type": "ping", "timestamp": __import__("time").time()})
            except Exception:
                break

    ping_task = asyncio.create_task(send_ping())
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
