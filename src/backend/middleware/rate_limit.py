# Rate Limiting Middleware
# Per-IP rate limiting for API endpoints

import time
import asyncio
from typing import Optional

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from config import settings
from utils.logging import get_logger

logger = get_logger('writer-api')

# Thread-safe rate limit store with TTL cleanup
class RateLimitStore:
    """Thread-safe in-memory rate limit store with automatic cleanup."""

    def __init__(self):
        self._store: dict[str, list[float]] = {}
        self._lock = asyncio.Lock()
        self._last_cleanup = time.time()
        self._cleanup_interval = 60.0  # Cleanup every 60 seconds

    async def _cleanup_expired(self, max_age: float = 300.0):
        """Remove expired entries older than max_age seconds."""
        now = time.time()
        if now - self._last_cleanup < self._cleanup_interval:
            return

        async with self._lock:
            self._last_cleanup = now
            expired_ips = [
                ip for ip, timestamps in self._store.items()
                if all(now - t >= max_age for t in timestamps)
            ]
            for ip in expired_ips:
                del self._store[ip]

    async def check_rate_limit(
        self,
        client_ip: str,
        max_requests: int,
        window_seconds: float
    ) -> tuple[bool, int, int]:
        """
        Check if client is within rate limit.
        Returns (allowed, limit, remaining).
        """
        await self._cleanup_expired(max_age=window_seconds * 5)

        now = time.time()
        async with self._lock:
            if client_ip not in self._store:
                self._store[client_ip] = []

            # Remove old requests outside the window
            self._store[client_ip] = [
                t for t in self._store[client_ip]
                if now - t < window_seconds
            ]

            current_count = len(self._store[client_ip])
            remaining = max(0, max_requests - current_count)

            if current_count >= max_requests:
                return False, max_requests, 0

            self._store[client_ip].append(now)
            return True, max_requests, remaining - 1


# Global rate limit store
_rate_limit_store = RateLimitStore()

# Default rate limit configuration from settings
DEFAULT_RATE_LIMIT = settings.rate_limit_default
DEFAULT_WINDOW = settings.rate_limit_window


async def rate_limit_middleware(request: Request, call_next):
    """
    Rate limiting middleware that applies per-IP limits to /api/v1/chat and /api/v1/ai routes.
    Adds X-RateLimit-Limit and X-RateLimit-Remaining headers to responses.
    """
    path = request.url.path

    # Only apply rate limiting to specified routes
    if not (path.startswith("/api/v1/chat") or
            path.startswith("/api/v1/ai") or
            path.startswith("/ws")):
        return await call_next(request)

    client_ip = request.client.host if request.client else "unknown"

    # Use default limits (can be made configurable per-route)
    allowed, limit, remaining = await _rate_limit_store.check_rate_limit(
        client_ip,
        max_requests=DEFAULT_RATE_LIMIT,
        window_seconds=DEFAULT_WINDOW
    )

    if not allowed:
        logger.warning(f"Rate limit exceeded for IP: {client_ip}, path: {path}")
        return JSONResponse(
            status_code=429,
            content={
                "detail": "Too many requests. Please try again later.",
                "error_code": "RATE_LIMIT_EXCEEDED"
            },
            headers={
                "X-RateLimit-Limit": str(limit),
                "X-RateLimit-Remaining": str(remaining),
                "Retry-After": str(int(DEFAULT_WINDOW))
            }
        )

    # Process request
    response = await call_next(request)

    # Add rate limit headers to response
    response.headers["X-RateLimit-Limit"] = str(limit)
    response.headers["X-RateLimit-Remaining"] = str(remaining)

    return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Starlette middleware class for rate limiting."""

    def __init__(
        self,
        app,
        rate_limit: int = DEFAULT_RATE_LIMIT,
        window_seconds: float = DEFAULT_WINDOW
    ):
        super().__init__(app)
        self.rate_limit = rate_limit
        self.window_seconds = window_seconds

    async def dispatch(self, request: Request, call_next):
        return await rate_limit_middleware(request, call_next)


def get_rate_limit_store() -> RateLimitStore:
    """Get the global rate limit store instance."""
    return _rate_limit_store


# Stricter rate limit store for AI checker endpoints (they call external APIs)
_checker_rate_limit_store = RateLimitStore()
CHECKER_RATE_LIMIT = settings.rate_limit_checker
CHECKER_WINDOW = settings.rate_limit_checker_window


async def check_checker_rate_limit(client_ip: str) -> tuple[bool, int, int]:
    """Check rate limit for AI checker endpoints.

    Returns (allowed, limit, remaining).
    """
    return await _checker_rate_limit_store.check_rate_limit(
        client_ip,
        max_requests=CHECKER_RATE_LIMIT,
        window_seconds=CHECKER_WINDOW
    )
