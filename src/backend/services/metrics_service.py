"""Performance metrics collection service.

Aggregates request latency histograms, AI call success/failure rates,
database query statistics, and active WebSocket connection counts.
Uses in-memory ring buffers to avoid OOM.
"""

from __future__ import annotations

import asyncio
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

from backend.utils.logging import get_logger

logger = get_logger("writer-api.metrics")

# Default ring buffer sizes
DEFAULT_REQUEST_BUFFER_SIZE = 10_000
DEFAULT_AI_CALL_BUFFER_SIZE = 5_000
DEFAULT_DB_QUERY_BUFFER_SIZE = 10_000
DEFAULT_HISTORY_MINUTES = 5


@dataclass(slots=True)
class RequestRecord:
    """Single request performance record."""
    timestamp: float
    method: str
    path: str
    duration_ms: float
    query_count: int
    slow_query_count: int
    status_code: int


@dataclass(slots=True)
class AICallRecord:
    """Single AI API call record."""
    timestamp: float
    provider: str
    success: bool
    duration_ms: float
    error_type: str | None = None


@dataclass(slots=True)
class DBQueryRecord:
    """Single database query record."""
    timestamp: float
    query: str
    duration_ms: float
    is_slow: bool = False


@dataclass
class TimeSeriesPoint:
    """A single point in time-series metrics history."""
    timestamp: float
    requests_per_minute: float = 0.0
    avg_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    ai_success_rate: float = 0.0
    ai_calls_per_minute: float = 0.0
    db_queries_per_minute: float = 0.0
    slow_query_rate: float = 0.0
    active_websocket_connections: int = 0


class MetricsService:
    """Centralized metrics collection service with ring buffers.

    Thread-safe for async usage. All public methods are async.
    """

    def __init__(
        self,
        request_buffer_size: int = DEFAULT_REQUEST_BUFFER_SIZE,
        ai_call_buffer_size: int = DEFAULT_AI_CALL_BUFFER_SIZE,
        db_query_buffer_size: int = DEFAULT_DB_QUERY_BUFFER_SIZE,
        history_minutes: int = DEFAULT_HISTORY_MINUTES,
    ) -> None:
        self._request_buffer_size = request_buffer_size
        self._ai_call_buffer_size = ai_call_buffer_size
        self._db_query_buffer_size = db_query_buffer_size
        self._history_minutes = history_minutes

        # Ring buffers
        self._requests: deque[RequestRecord] = deque(maxlen=request_buffer_size)
        self._ai_calls: deque[AICallRecord] = deque(maxlen=ai_call_buffer_size)
        self._db_queries: deque[DBQueryRecord] = deque(maxlen=db_query_buffer_size)

        # Time-series history (one point per minute)
        self._history: deque[TimeSeriesPoint] = deque(maxlen=history_minutes * 60)

        # Counters for current minute (reset by _flush_history)
        self._current_minute_requests: list[float] = []
        self._current_minute_ai_calls: list[tuple[bool, float]] = []
        self._current_minute_db_queries: list[tuple[float, bool]] = []

        # WebSocket connection count (updated externally)
        self._active_ws_connections: int = 0

        # Async lock for thread safety
        self._lock = asyncio.Lock()

        # Background task for flushing history
        self._flush_task: asyncio.Task | None = None
        self._shutdown_event = asyncio.Event()

    # ------------------------------------------------------------------
    # Recording methods
    # ------------------------------------------------------------------

    async def record_request(
        self,
        *,
        method: str,
        path: str,
        duration_ms: float,
        query_count: int = 0,
        slow_query_count: int = 0,
        status_code: int = 200,
    ) -> None:
        """Record a completed HTTP request."""
        async with self._lock:
            record = RequestRecord(
                timestamp=time.time(),
                method=method,
                path=path,
                duration_ms=duration_ms,
                query_count=query_count,
                slow_query_count=slow_query_count,
                status_code=status_code,
            )
            self._requests.append(record)
            self._current_minute_requests.append(duration_ms)

    async def record_ai_call(
        self,
        *,
        provider: str,
        success: bool,
        duration_ms: float,
        error_type: str | None = None,
    ) -> None:
        """Record an AI API call result."""
        async with self._lock:
            record = AICallRecord(
                timestamp=time.time(),
                provider=provider,
                success=success,
                duration_ms=duration_ms,
                error_type=error_type,
            )
            self._ai_calls.append(record)
            self._current_minute_ai_calls.append((success, duration_ms))

    async def record_db_query(
        self,
        *,
        query: str,
        duration_ms: float,
        is_slow: bool = False,
    ) -> None:
        """Record a database query execution."""
        async with self._lock:
            record = DBQueryRecord(
                timestamp=time.time(),
                query=query,
                duration_ms=duration_ms,
                is_slow=is_slow,
            )
            self._db_queries.append(record)
            self._current_minute_db_queries.append((duration_ms, is_slow))

    async def set_active_websocket_connections(self, count: int) -> None:
        """Update the active WebSocket connection count."""
        async with self._lock:
            self._active_ws_connections = max(0, count)

    # ------------------------------------------------------------------
    # Aggregation / summary
    # ------------------------------------------------------------------

    async def get_summary(self, window_seconds: float = 60.0) -> dict[str, Any]:
        """Return aggregated metrics summary for the given time window.

        Args:
            window_seconds: Time window for aggregation (default: last 60s).

        Returns:
            Dictionary with request, AI, DB, and WebSocket metrics.
        """
        now = time.time()
        cutoff = now - window_seconds

        async with self._lock:
            # Filter records within window
            requests = [r for r in self._requests if r.timestamp >= cutoff]
            ai_calls = [c for c in self._ai_calls if c.timestamp >= cutoff]
            db_queries = [q for q in self._db_queries if q.timestamp >= cutoff]

            # Request latency percentiles
            request_latencies = sorted(r.duration_ms for r in requests)
            req_summary = self._compute_latency_summary(request_latencies)

            # AI call summary
            ai_success = sum(1 for c in ai_calls if c.success)
            ai_total = len(ai_calls)
            ai_latencies = sorted(c.duration_ms for c in ai_calls)
            ai_summary = self._compute_latency_summary(ai_latencies)

            # DB query summary
            db_total = len(db_queries)
            db_slow = sum(1 for q in db_queries if q.is_slow)
            db_latencies = sorted(q.duration_ms for q in db_queries)
            db_summary = self._compute_latency_summary(db_latencies)

            # Status code distribution
            status_counts: dict[int, int] = {}
            for r in requests:
                status_counts[r.status_code] = status_counts.get(r.status_code, 0) + 1

            return {
                "window_seconds": window_seconds,
                "timestamp": now,
                "requests": {
                    "total": len(requests),
                    "per_minute": round(len(requests) * 60.0 / window_seconds, 2),
                    **req_summary,
                    "status_codes": status_counts,
                },
                "ai_calls": {
                    "total": ai_total,
                    "success": ai_success,
                    "failed": ai_total - ai_success,
                    "success_rate": round(ai_success / ai_total, 4) if ai_total else 0.0,
                    "per_minute": round(ai_total * 60.0 / window_seconds, 2),
                    **ai_summary,
                },
                "db_queries": {
                    "total": db_total,
                    "slow_queries": db_slow,
                    "slow_query_rate": round(db_slow / db_total, 4) if db_total else 0.0,
                    "per_minute": round(db_total * 60.0 / window_seconds, 2),
                    **db_summary,
                },
                "websockets": {
                    "active_connections": self._active_ws_connections,
                },
            }

    async def get_history(self, minutes: int | None = None) -> list[dict[str, Any]]:
        """Return time-series metrics history.

        Args:
            minutes: Number of minutes to return. Defaults to _history_minutes.

        Returns:
            List of time-series points, one per minute.
        """
        minutes = minutes or self._history_minutes
        cutoff = time.time() - minutes * 60

        async with self._lock:
            points = [p for p in self._history if p.timestamp >= cutoff]
            return [
                {
                    "timestamp": p.timestamp,
                    "datetime": time.strftime(
                        "%Y-%m-%d %H:%M:%S", time.localtime(p.timestamp)
                    ),
                    "requests_per_minute": p.requests_per_minute,
                    "avg_latency_ms": p.avg_latency_ms,
                    "p95_latency_ms": p.p95_latency_ms,
                    "ai_success_rate": p.ai_success_rate,
                    "ai_calls_per_minute": p.ai_calls_per_minute,
                    "db_queries_per_minute": p.db_queries_per_minute,
                    "slow_query_rate": p.slow_query_rate,
                    "active_websocket_connections": p.active_websocket_connections,
                }
                for p in points
            ]

    # ------------------------------------------------------------------
    # Background history flushing
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start the background history flush task."""
        if self._flush_task is not None:
            return
        self._shutdown_event.clear()
        self._flush_task = asyncio.create_task(self._flush_loop())
        logger.info("MetricsService started")

    async def stop(self) -> None:
        """Stop the background history flush task."""
        self._shutdown_event.set()
        if self._flush_task is not None:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
            self._flush_task = None
        # Final flush
        await self._flush_history()
        logger.info("MetricsService stopped")

    async def _flush_loop(self) -> None:
        """Periodically flush per-minute aggregates to history."""
        while not self._shutdown_event.is_set():
            try:
                await asyncio.wait_for(
                    self._shutdown_event.wait(), timeout=60.0
                )
            except asyncio.TimeoutError:
                await self._flush_history()

    async def _flush_history(self) -> None:
        """Aggregate current-minute data and append to history."""
        async with self._lock:
            # Requests
            req_latencies = sorted(self._current_minute_requests)
            req_count = len(req_latencies)
            avg_latency = sum(req_latencies) / req_count if req_count else 0.0
            p95_latency = self._percentile(req_latencies, 0.95) if req_latencies else 0.0

            # AI calls
            ai_results = self._current_minute_ai_calls
            ai_success = sum(1 for s, _ in ai_results if s)
            ai_total = len(ai_results)
            ai_rate = round(ai_success / ai_total, 4) if ai_total else 0.0

            # DB queries
            db_results = self._current_minute_db_queries
            db_total = len(db_results)
            db_slow = sum(1 for _, slow in db_results if slow)
            db_slow_rate = round(db_slow / db_total, 4) if db_total else 0.0

            point = TimeSeriesPoint(
                timestamp=time.time(),
                requests_per_minute=float(req_count),
                avg_latency_ms=round(avg_latency, 2),
                p95_latency_ms=round(p95_latency, 2),
                ai_success_rate=ai_rate,
                ai_calls_per_minute=float(ai_total),
                db_queries_per_minute=float(db_total),
                slow_query_rate=db_slow_rate,
                active_websocket_connections=self._active_ws_connections,
            )
            self._history.append(point)

            # Reset current-minute accumulators
            self._current_minute_requests.clear()
            self._current_minute_ai_calls.clear()
            self._current_minute_db_queries.clear()

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _percentile(sorted_values: list[float], p: float) -> float:
        """Compute percentile from a sorted list."""
        if not sorted_values:
            return 0.0
        n = len(sorted_values)
        if n == 1:
            return sorted_values[0]
        k = (n - 1) * p
        f = int(k)
        c = f + 1
        if c >= n:
            return sorted_values[-1]
        d = k - f
        return sorted_values[f] * (1 - d) + sorted_values[c] * d

    @classmethod
    def _compute_latency_summary(cls, sorted_latencies: list[float]) -> dict[str, float]:
        """Compute p50/p95/p99/min/max/avg from sorted latencies."""
        if not sorted_latencies:
            return {
                "p50_ms": 0.0,
                "p95_ms": 0.0,
                "p99_ms": 0.0,
                "min_ms": 0.0,
                "max_ms": 0.0,
                "avg_ms": 0.0,
            }
        return {
            "p50_ms": round(cls._percentile(sorted_latencies, 0.50), 2),
            "p95_ms": round(cls._percentile(sorted_latencies, 0.95), 2),
            "p99_ms": round(cls._percentile(sorted_latencies, 0.99), 2),
            "min_ms": round(sorted_latencies[0], 2),
            "max_ms": round(sorted_latencies[-1], 2),
            "avg_ms": round(sum(sorted_latencies) / len(sorted_latencies), 2),
        }


# Global singleton instance
metrics_service = MetricsService()
