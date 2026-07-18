"""FastAPI application entry point.

2026 Decision: sync SQLAlchemy + FastAPI sync endpoints (thread pool) for local desktop.
No async engine complexity needed. SQLite WAL mode handles concurrency well enough.
"""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import api_router, chat_ws_router
from app.core.exceptions import (
    WriterException,
    writer_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
)
# Tables managed by Alembic (alembic upgrade head on deploy)

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# CORS — allow Electron renderer origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:8000", "file://"],  # Vite dev + Electron file://
    allow_origin_regex=r"http://(127\.0\.0\.1|localhost)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Exception handlers
app.add_exception_handler(WriterException, writer_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.include_router(api_router)
# WebSocket router is mounted at root (no /api/v1 prefix) — see app/routers/__init__.py.
app.include_router(chat_ws_router)

# No startup seed — first project created via ProjectService.create_with_defaults()
