"""Logging utilities for structured logging with correlation IDs."""

import logging
import sys
from typing import Optional

from backend.middleware.request_context import get_request_id, get_correlation_id


def setup_logging(
    level: str = "INFO",
    format: str = "text",
    log_file: Optional[str] = None
) -> None:
    """Configure application logging.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        format: Log format ("text" or "json")
        log_file: Optional file path for file logging
    """
    log_level = getattr(logging, level.upper(), logging.INFO)

    if format == "json":
        formatter = logging.Formatter(
            '{"time":"%(asctime)s","level":"%(levelname)s","name":"%(name)s","message":"%(message)s"}',
            datefmt="%Y-%m-%dT%H:%M:%S"
        )
    else:
        formatter = logging.Formatter(
            "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )

    handlers = [logging.StreamHandler(sys.stdout)]

    if log_file:
        handlers.append(logging.FileHandler(log_file))

    logging.basicConfig(
        level=log_level,
        format="%(message)s",
        handlers=handlers,
        force=True
    )

    for handler in handlers:
        handler.setFormatter(formatter)


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


def log_with_context(
    logger: logging.Logger,
    level: int,
    message: str,
    extra: Optional[dict] = None,
    **kwargs
) -> None:
    """Log a message with automatic request context injection.

    Args:
        logger: Logger instance
        level: Logging level (e.g., logging.INFO)
        message: Log message
        extra: Additional extra fields
        **kwargs: Additional fields to include in extra
    """
    merged_extra = extra or {}
    merged_extra.update(kwargs)

    # Inject request context
    try:
        req_id = get_request_id()
        if req_id:
            merged_extra["request_id"] = req_id
        corr_id = get_correlation_id()
        if corr_id:
            merged_extra["correlation_id"] = corr_id
    except LookupError:
        pass

    logger.log(level, message, extra=merged_extra)
