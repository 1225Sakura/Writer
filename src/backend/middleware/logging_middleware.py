"""Logging middleware for request tracking and observability."""

import time
import uuid
import logging
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger("writer-api")


async def logging_middleware(request: Request, call_next):
    """Enhanced logging middleware with request ID and timing."""
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id

    start_time = time.time()

    logger.info(
        "request_start",
        extra={
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "client": request.client.host if request.client else None,
        }
    )

    try:
        response = await call_next(request)
        duration = time.time() - start_time

        logger.info(
            "request_complete",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
                "duration_ms": round(duration * 1000, 2),
            }
        )

        response.headers["X-Request-ID"] = request_id
        return response

    except RuntimeError as e:
        duration = time.time() - start_time
        logger.error(
            "request_error",
            extra={
                "request_id": request_id,
                "method": request.method,
                "path": request.url.path,
                "duration_ms": round(duration * 1000, 2),
                "error": str(e),
            },
            exc_info=True
        )
        raise


async def request_logging_middleware(request: Request, call_next):
    """Simple request/response logging middleware."""
    start_time = time.time()
    method = request.method
    path = request.url.path

    logger.info(f"--> {method} {path}")

    response = await call_next(request)

    duration = time.time() - start_time
    logger.info(f"<-- {method} {path} {response.status_code} {duration:.3f}s")

    return response
