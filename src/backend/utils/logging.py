# Logging utilities
# Provides structured logging configuration for the Writer API

import logging
import logging.handlers
import sys
import json
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from pathlib import Path

from middleware.request_context import get_request_id, get_correlation_id, get_user_id


class JSONFormatter(logging.Formatter):
    """Format log records as structured JSON with correlation IDs."""

    def __init__(self, include_extra: bool = True, include_context: bool = True):
        super().__init__()
        self.include_extra = include_extra
        self.include_context = include_context

    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
            "thread": record.thread,
        }

        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Include request context (correlation IDs)
        if self.include_context:
            context: Dict[str, Any] = {}
            try:
                req_id = get_request_id()
                if req_id:
                    context["request_id"] = req_id
                corr_id = get_correlation_id()
                if corr_id:
                    context["correlation_id"] = corr_id
                user_id = get_user_id()
                if user_id:
                    context["user_id"] = user_id
            except Exception:
                pass  # Context vars may not be set
            if context:
                log_data["context"] = context

        if self.include_extra:
            # Extract extra fields that are not standard LogRecord attributes
            standard_attrs = set(logging.LogRecord(
                "", 0, "", 0, "", (), None
            ).__dict__.keys())
            extra_fields = {
                k: v for k, v in record.__dict__.items()
                if k not in standard_attrs and not k.startswith("_")
            }
            if extra_fields:
                log_data["extra"] = extra_fields

        return json.dumps(log_data, ensure_ascii=False, default=str)


class HumanReadableFormatter(logging.Formatter):
    """Format log records for human readability with context info."""

    def __init__(self, colorize: bool = True, include_context: bool = True):
        super().__init__()
        self.colorize = colorize
        self.include_context = include_context
        self.COLORS = {
            "DEBUG": "\033[36m",
            "INFO": "\033[32m",
            "WARNING": "\033[33m",
            "ERROR": "\033[31m",
            "CRITICAL": "\033[35m",
        }
        self.RESET = "\033[0m"

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, "") if self.colorize else ""
        reset = self.RESET if self.colorize else ""

        timestamp = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")
        level = f"{color}{record.levelname:<8}{reset}"
        logger_name = f"{record.name}"
        message = record.getMessage()

        # Build context string
        context_parts = []
        if self.include_context:
            try:
                req_id = get_request_id()
                if req_id:
                    context_parts.append(f"req={req_id[:8]}")
                corr_id = get_correlation_id()
                if corr_id:
                    context_parts.append(f"corr={corr_id[:8]}")
            except Exception:
                pass

        context_str = f" [{' '.join(context_parts)}]" if context_parts else ""

        formatted = f"{timestamp} | {level} | {logger_name}{context_str} | {message}"

        if record.exc_info:
            formatted += "\n" + self.formatException(record.exc_info)

        return formatted


class AccessLogFormatter(logging.Formatter):
    """Format access logs in a web-server-like style."""

    def format(self, record: logging.LogRecord) -> str:
        extra = getattr(record, "extra", {})
        timestamp = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d %H:%M:%S")
        method = extra.get("method", "-")
        path = extra.get("path", "-")
        status = extra.get("status_code", "-")
        duration = extra.get("duration_ms", "-")
        req_id = extra.get("request_id", "-")

        return (
            f'{timestamp} | {method} {path} | '
            f'status={status} | duration={duration}ms | req={req_id[:8] if req_id else "-"}'
        )


def setup_logging(
    level: str = "INFO",
    json_logs: bool = False,
    log_file: Optional[str] = None,
    log_dir: Optional[str] = None,
    max_bytes: int = 10 * 1024 * 1024,  # 10MB
    backup_count: int = 5,
    separate_error_logs: bool = True,
    separate_access_logs: bool = True,
) -> logging.Logger:
    """
    Configure application logging with rotation and structured output.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        json_logs: Use JSON formatting for structured logs
        log_file: Optional file path to write logs to
        log_dir: Directory for log files (used if log_file not specified)
        max_bytes: Maximum bytes per log file before rotation
        backup_count: Number of backup files to keep
        separate_error_logs: Write error logs to separate file
        separate_access_logs: Write access logs to separate file

    Returns:
        Configured root logger
    """
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Remove existing handlers
    root_logger.handlers.clear()

    # Choose formatter
    if json_logs:
        formatter = JSONFormatter()
    else:
        formatter = HumanReadableFormatter()

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(getattr(logging, level.upper(), logging.INFO))
    root_logger.addHandler(console_handler)

    # Determine log directory
    if log_dir:
        log_path = Path(log_dir)
    elif log_file:
        log_path = Path(log_file).parent
    else:
        log_path = None

    if log_path:
        log_path.mkdir(parents=True, exist_ok=True)

    # Main file handler with rotation
    if log_file:
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8",
        )
        file_handler.setFormatter(JSONFormatter())
        file_handler.setLevel(logging.DEBUG)
        root_logger.addHandler(file_handler)

    # Separate error log file
    if separate_error_logs and log_path:
        error_log_file = log_path / "error.log"
        error_handler = logging.handlers.RotatingFileHandler(
            str(error_log_file),
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8",
        )
        error_handler.setFormatter(JSONFormatter())
        error_handler.setLevel(logging.ERROR)
        root_logger.addHandler(error_handler)

    # Separate access log file
    if separate_access_logs and log_path:
        access_log_file = log_path / "access.log"
        access_handler = logging.handlers.RotatingFileHandler(
            str(access_log_file),
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8",
        )
        access_handler.setFormatter(JSONFormatter())
        access_handler.setLevel(logging.INFO)
        # Filter to only access log events
        access_handler.addFilter(lambda r: getattr(r, "event", "").startswith("request_"))
        root_logger.addHandler(access_handler)

    return root_logger


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance for a specific module."""
    return logging.getLogger(name)
