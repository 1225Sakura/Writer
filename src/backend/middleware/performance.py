"""Performance monitoring middleware.

Tracks request duration, database query count per request, and logs slow queries.
"""

import time
import logging
from typing import Callable, Optional

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from backend.utils.logging import get_logger

logger = get_logger("writer-api.performance")

# Threshold for slow query logging (milliseconds)
SLOW_QUERY_THRESHOLD_MS = 500


class PerformanceMiddleware(BaseHTTPMiddleware):
    """Middleware for performance monitoring.

    Tracks:
    - Request duration
    - Database query count per request
    - Logs slow queries (>500ms)
    """

    def __init__(self, app, slow_query_threshold_ms: float = SLOW_QUERY_THRESHOLD_MS):
        super().__init__(app)
        self.slow_query_threshold_ms = slow_query_threshold_ms

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Initialize performance tracking on request state
        request.state.query_count = 0
        request.state.query_times: list[dict] = []
        request.state.start_time = time.perf_counter()

        # Process request
        response = await call_next(request)

        # Calculate total duration
        duration_ms = (time.perf_counter() - request.state.start_time) * 1000

        # Get query stats from request state
        query_count = getattr(request.state, "query_count", 0)
        query_times = getattr(request.state, "query_times", [])

        # Build performance data
        perf_data = {
            "event": "request_performance",
            "method": request.method,
            "path": request.url.path,
            "duration_ms": round(duration_ms, 2),
            "query_count": query_count,
            "slow_queries": [
                q for q in query_times
                if q.get("duration_ms", 0) > self.slow_query_threshold_ms
            ],
        }

        # Log slow requests
        if duration_ms > self.slow_query_threshold_ms:
            logger.warning(
                f"Slow request: {request.method} {request.url.path} "
                f"took {duration_ms:.2f}ms with {query_count} queries",
                extra=perf_data,
            )
        else:
            logger.debug(
                f"Request: {request.method} {request.url.path} "
                f"{duration_ms:.2f}ms, {query_count} queries",
                extra=perf_data,
            )

        # Add performance headers to response
        response.headers["X-Request-Duration-Ms"] = str(round(duration_ms, 2))
        response.headers["X-Db-Query-Count"] = str(query_count)

        return response


class QueryTimer:
    """Context manager for timing database queries.

    Usage:
        async with QueryTimer(request, "SELECT ...") as timer:
            result = await session.execute(query)
    """

    def __init__(
        self,
        request: Optional[Request],
        query_description: str = "",
        slow_threshold_ms: float = SLOW_QUERY_THRESHOLD_MS,
    ):
        self.request = request
        self.query_description = query_description
        self.slow_threshold_ms = slow_threshold_ms
        self.start_time: Optional[float] = None
        self.duration_ms: float = 0.0

    async def __aenter__(self):
        self.start_time = time.perf_counter()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.start_time is not None:
            self.duration_ms = (time.perf_counter() - self.start_time) * 1000

        # Track on request state if available
        if self.request is not None:
            if not hasattr(self.request.state, "query_count"):
                self.request.state.query_count = 0
            if not hasattr(self.request.state, "query_times"):
                self.request.state.query_times = []

            self.request.state.query_count += 1
            self.request.state.query_times.append({
                "query": self.query_description,
                "duration_ms": round(self.duration_ms, 2),
            })

        # Log slow queries
        if self.duration_ms > self.slow_threshold_ms:
            logger.warning(
                f"Slow query ({self.duration_ms:.2f}ms): {self.query_description}",
                extra={
                    "event": "slow_query",
                    "duration_ms": round(self.duration_ms, 2),
                    "query": self.query_description,
                },
            )

        return False  # Don't suppress exceptions


def setup_performance_middleware(app, slow_query_threshold_ms: float = SLOW_QUERY_THRESHOLD_MS):
    """Register the performance monitoring middleware with the FastAPI app."""
    app.add_middleware(
        PerformanceMiddleware,
        slow_query_threshold_ms=slow_query_threshold_ms,
    )
