"""FastAPI application entry point.

2026 Decision: sync SQLAlchemy + FastAPI sync endpoints (thread pool) for local desktop.
No async engine complexity needed. SQLite WAL mode handles concurrency well enough.

v0.4 P0-Sec8: X-Request-ID middleware generates/mints correlation_id per request.

v0.5 Phase 2.3: OpenTelemetry FastAPI instrumentation + structlog JSON
logs wired via app.core.logging.configure_logging.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.core.logging import configure_logging
from app.core.middleware import CorrelationIDMiddleware
from app.routers import api_router, chat_ws_router
from app.routers.auth import router as auth_router
from app.core.exceptions import (
    WriterException,
    writer_exception_handler,
    validation_exception_handler,
    generic_exception_handler,
)
# Tables managed by Alembic (alembic upgrade head on deploy)

# Configure root logger with correlation_id filter + formatter (idempotent).
# Also configures structlog JSON pipeline (no-op if structlog missing).
configure_logging()

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

# v0.5 Phase 2.3: OpenTelemetry FastAPI instrumentation. Wraps request
# handlers to emit spans for incoming HTTP traffic. The default OTLP
# HTTP exporter is disabled by default — traces land in-memory unless
# OTEL_EXPORTER_OTLP_ENDPOINT is configured. The instrumentation is
# wrapped in a try/except so CI without the opentelemetry package
# doesn't crash the app at import time.
try:
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor  # type: ignore
    FastAPIInstrumentor.instrument_app(app)
    logging.getLogger(__name__).info(
        "opentelemetry.fastapi.instrumentation.enabled",
        extra={"otel_instrumentation": "fastapi"},
    )
except Exception as exc:  # pragma: no cover — defensive
    logging.getLogger(__name__).debug(
        "opentelemetry.fastapi.instrumentation.skipped",
        extra={"reason": str(exc)},
    )

# v0.4 P0-Sec8: Register CorrelationIDMiddleware so X-Request-ID is captured
# at the outermost layer (caller-supplied or freshly minted).
# Starlette's add_middleware does `user_middleware.insert(0, ...)` — each
# later call is PREPENDED. After build_middleware_stack wraps in order,
# the first element of user_middleware becomes the OUTERMOST wrapper.
# Therefore we add CORSMiddleware FIRST, then CorrelationIDMiddleware —
# so the final wrap order is: CorrelationID → CORS → router.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite dev server
        "http://localhost:8000",   # Backend health check from browser
        "app://writer",            # Electron renderer (custom protocol)
    ],
    allow_origin_regex=r"^https?://(127\.0\.0\.1|localhost)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-API-Key", "X-Request-ID"],
    expose_headers=["X-Request-ID"],
)
app.add_middleware(CorrelationIDMiddleware)

# Exception handlers
app.add_exception_handler(WriterException, writer_exception_handler)
app.add_exception_handler(Exception, generic_exception_handler)

app.include_router(api_router)
# WebSocket router is mounted at root (no /api/v1 prefix) — see app/routers/__init__.py.
app.include_router(chat_ws_router)
# v0.4 P0-Sec1a: auth router mounted at /auth/* for key init/status/refresh
app.include_router(auth_router)

# No startup seed — first project created via ProjectService.create_with_defaults()
