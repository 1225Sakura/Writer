"""Structured logging with correlation_id injection.

v0.4 P0-Sec8: Every log record carries the active correlation_id (from
`app.core.middleware._correlation_id_var`) so backend logs can be traced
end-to-end across middleware → router → service → repository layers.

v0.5 (Phase 2.3): Adds structlog pipeline + JSON renderer for
machine-readable logs. Both the stdlib `logging` path (for libraries
that use vanilla logging) and the structlog path (for explicit calls)
emit the same correlation_id. OTel FastAPI instrumentation is wired in
`app/main.py`.

Usage:
    from app.core.logging import configure_logging, get_logger
    configure_logging()  # call once at app startup

    logger = get_logger(__name__)
    logger.info("processing_request", user_id="...")  # JSON with correlation_id
"""
from __future__ import annotations

import logging
import sys
from typing import Optional

from app.core.middleware import get_correlation_id

__all__ = [
    "CorrelationIDFilter",
    "CorrelationIDFormatter",
    "configure_logging",
    "configure_structlog",
    "add_correlation_id",
    "get_logger",
]


# ---------------------------------------------------------------------------
# stdlib logging filter + formatter (Phase 0b.3, unchanged)
# ---------------------------------------------------------------------------


class CorrelationIDFilter(logging.Filter):
    """Inject `correlation_id` onto every log record.

    Records without an active correlation (e.g. startup logs before middleware
    runs) get the literal string `-` so the column stays consistent.
    """

    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = get_correlation_id() or "-"
        return True


class CorrelationIDFormatter(logging.Formatter):
    """Format log records with `[correlation_id]` prefix.

    Default format: `%(asctime)s [%(correlation_id)s] %(levelname)s %(name)s: %(message)s`
    """

    DEFAULT_FORMAT = (
        "%(asctime)s [%(correlation_id)s] %(levelname)s %(name)s: %(message)s"
    )

    def __init__(self, fmt: Optional[str] = None, datefmt: Optional[str] = None):
        super().__init__(fmt or self.DEFAULT_FORMAT, datefmt)


# ---------------------------------------------------------------------------
# structlog (Phase 2.3)
# ---------------------------------------------------------------------------


def add_correlation_id(_logger, _method_name, event_dict):
    """structlog processor that stamps the active correlation_id.

    Reads from the same contextvar the stdlib filter uses, so the two
    log paths are coherent.
    """
    event_dict["correlation_id"] = get_correlation_id() or "-"
    return event_dict


def configure_structlog(level: str = "INFO") -> None:
    """Configure structlog with correlation_id + JSON renderer.

    Idempotent. Safe to call repeatedly during tests / reload.

    We *try* to import structlog; if it's not installed (CI without the
    dep), we silently skip so the rest of the app keeps using stdlib
    logging. Production callers should `pip install structlog` per the
    v0.5 Phase 2.3 contract.
    """
    try:
        import structlog
    except ImportError:
        # structlog is optional; stdlib path still works.
        return

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso", utc=True),
            add_correlation_id,
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(getattr(logging, level)),
        logger_factory=structlog.PrintLoggerFactory(file=sys.stdout),
        cache_logger_on_first_use=True,
    )


def get_logger(name: Optional[str] = None):
    """Return a structlog logger with default settings.

    If structlog is not installed, falls back to a stdlib logger so
    callers can write `get_logger(__name__).info(...)` without try/except.
    """
    try:
        import structlog
        return structlog.get_logger(name) if name else structlog.get_logger()
    except ImportError:
        return logging.getLogger(name or "writer")


# ---------------------------------------------------------------------------
# stdlib logging wiring (called from configure_logging)
# ---------------------------------------------------------------------------


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logger with correlation_id filter + formatter.

    Also calls `configure_structlog()` so both pipelines are wired.

    Idempotent: replaces existing handlers to avoid duplicate output when
    reloaded by test fixtures or uvicorn reload.
    """
    root = logging.getLogger()
    # Remove pre-existing handlers to keep output clean on repeated calls.
    for handler in list(root.handlers):
        root.removeHandler(handler)

    handler = logging.StreamHandler(stream=sys.stdout)
    handler.setFormatter(CorrelationIDFormatter())
    handler.addFilter(CorrelationIDFilter())
    root.addHandler(handler)
    root.setLevel(level)

    # Wire structlog too (no-op if the package isn't installed).
    configure_structlog(level=logging.getLevelName(level))
