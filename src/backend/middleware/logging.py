# Request logging middleware with timing, request ID tracking, structured logging,
# slow request detection, and correlation ID propagation across async boundaries.

import time
import uuid
import logging
from typing import Callable, Optional
from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from utils.logging import get_logger
from middleware.request_context import set_request_context, get_request_id

logger = get_logger("writer-api.middleware")

# Configurable slow request threshold (milliseconds)
_slow_request_threshold_ms: int = 1000


def set_slow_request_threshold(threshold_ms: int) -> None:
    """Set the slow request threshold in milliseconds."""
    global _slow_request_threshold_ms
    _slow_request_threshold_ms = threshold_ms


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for comprehensive request logging with:
    - Request ID tracking (X-Request-ID header)
    - Correlation ID tracking (X-Correlation-ID header)
    - Timing information
    - Structured JSON logging
    - Proper log levels based on status codes
    - Request context propagation via contextvars
    - Slow request detection and warning logs
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate or extract request ID and correlation ID
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        correlation_id = request.headers.get("X-Correlation-ID")

        # Set request context for this async scope (propagates to all awaits)
        set_request_context(
            request_id=request_id,
            correlation_id=correlation_id,
        )

        # Store on request state for handlers
        request.state.request_id = request_id
        request.state.correlation_id = correlation_id

        # Start timing
        start_time = time.perf_counter()

        # Get request details
        method = request.method
        path = request.url.path
        query_params = dict(request.query_params) if request.query_params else {}

        # Log incoming request
        logger.info(
            "Request started",
            extra={
                "event": "request_start",
                "request_id": request_id,
                "correlation_id": correlation_id,
                "method": method,
                "path": path,
                "query_params": query_params,
                "client_host": request.client.host if request.client else None,
            }
        )

        # Process request
        try:
            response = await call_next(request)
            status_code = response.status_code
        except Exception as e:
            status_code = 500
            logger.error(
                "Request failed with exception",
                extra={
                    "event": "request_error",
                    "request_id": request_id,
                    "correlation_id": correlation_id,
                    "method": method,
                    "path": path,
                    "error": str(e),
                    "error_type": type(e).__name__,
                },
                exc_info=True,
            )
            raise

        # Calculate duration
        duration_ms = (time.perf_counter() - start_time) * 1000

        # Determine log level based on status code
        if status_code >= 500:
            log_level = logging.ERROR
        elif status_code >= 400:
            log_level = logging.WARNING
        else:
            log_level = logging.INFO

        # Log response
        log_data = {
            "event": "request_complete",
            "request_id": request_id,
            "correlation_id": correlation_id,
            "method": method,
            "path": path,
            "status_code": status_code,
            "duration_ms": round(duration_ms, 2),
            "operation_type": _get_operation_type(path),
        }

        logger.log(
            log_level,
            f"Request completed: {method} {path} {status_code} {duration_ms:.2f}ms",
            extra=log_data
        )

        # Slow request warning
        if duration_ms > _slow_request_threshold_ms:
            logger.warning(
                f"Slow request detected: {method} {path} took {duration_ms:.2f}ms (threshold: {_slow_request_threshold_ms}ms)",
                extra={
                    "event": "slow_request",
                    "request_id": request_id,
                    "correlation_id": correlation_id,
                    "method": method,
                    "path": path,
                    "duration_ms": round(duration_ms, 2),
                    "threshold_ms": _slow_request_threshold_ms,
                    "slow_threshold_exceeded_by_ms": round(duration_ms - _slow_request_threshold_ms, 2),
                }
            )

        # Add request ID and correlation ID to response headers
        response.headers["X-Request-ID"] = request_id
        if correlation_id:
            response.headers["X-Correlation-ID"] = correlation_id

        return response


def _get_operation_type(path: str) -> str:
    """Infer operation type from request path for structured logging."""
    if "/chat/" in path or "/conversation" in path:
        return "chat"
    elif "/ai/" in path:
        return "ai_generation"
    elif "/settings" in path or "/config" in path:
        return "configuration"
    elif "/chapters" in path or "/outline" in path:
        return "content_management"
    elif "/auth" in path:
        return "authentication"
    elif "/export" in path or "/import" in path:
        return "data_sync"
    else:
        return "general"


def setup_logging_middleware(app, slow_request_threshold_ms: int = 1000):
    """Register the logging middleware with the FastAPI app."""
    set_slow_request_threshold(slow_request_threshold_ms)
    app.add_middleware(RequestLoggingMiddleware)
