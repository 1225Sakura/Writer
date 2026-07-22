"""Structured logging with correlation_id injection.

v0.4 P0-Sec8: Every log record carries the active correlation_id (from
`app.core.middleware._correlation_id_var`) so backend logs can be traced
end-to-end across middleware → router → service → repository layers.

Usage:
    from app.core.logging import configure_logging
    configure_logging()  # call once at app startup

    import logging
    logger = logging.getLogger(__name__)
    logger.info("processing request")  # automatically tagged with correlation_id
"""
from __future__ import annotations

import logging
import sys
from typing import Optional

from app.core.middleware import get_correlation_id


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


def configure_logging(level: int = logging.INFO) -> None:
    """Configure root logger with correlation_id filter + formatter.

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
