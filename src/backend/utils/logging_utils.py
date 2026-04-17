"""Logging utilities for structured logging."""

import logging
import sys
from typing import Optional


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
