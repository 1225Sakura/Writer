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

from sqlalchemy import text

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
        """Return aggregated metrics summary for the given time window."""
        now = time.time()
        cutoff = now - window_seconds

        async with self._lock:
            requests = [r for r in self._requests if r.timestamp >= cutoff]
            ai_calls = [c for c in self._ai_calls if c.timestamp >= cutoff]
            db_queries = [q for q in self._db_queries if q.timestamp >= cutoff]

            request_latencies = sorted(r.duration_ms for r in requests)
            req_summary = self._compute_latency_summary(request_latencies)

            ai_success = sum(1 for c in ai_calls if c.success)
            ai_total = len(ai_calls)
            ai_latencies = sorted(c.duration_ms for c in ai_calls)
            ai_summary = self._compute_latency_summary(ai_latencies)

            db_total = len(db_queries)
            db_slow = sum(1 for q in db_queries if q.is_slow)
            db_latencies = sorted(q.duration_ms for q in db_queries)
            db_summary = self._compute_latency_summary(db_latencies)

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
        """Return time-series metrics history."""
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
                logger.debug("MetricsService flush task cancelled")
            self._flush_task = None
        await self._flush_history()
        await self._flush_to_db()
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
                await self._flush_to_db()
                await self._aggregate_5min()

    async def _flush_history(self) -> None:
        """Aggregate current-minute data and append to history."""
        async with self._lock:
            req_latencies = sorted(self._current_minute_requests)
            req_count = len(req_latencies)
            avg_latency = sum(req_latencies) / req_count if req_count else 0.0
            p95_latency = self._percentile(req_latencies, 0.95) if req_latencies else 0.0

            ai_results = self._current_minute_ai_calls
            ai_success = sum(1 for s, _ in ai_results if s)
            ai_total = len(ai_results)
            ai_rate = round(ai_success / ai_total, 4) if ai_total else 0.0

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

            self._current_minute_requests.clear()
            self._current_minute_ai_calls.clear()
            self._current_minute_db_queries.clear()

    # ------------------------------------------------------------------
    # SQLite persistence
    # ------------------------------------------------------------------

    async def init_persistence(self, db_session_factory) -> None:
        """Initialize SQLite persistence. Call once at startup.

        Creates metric_samples and metric_agg_5min tables if they don't exist.
        Starts background flush task.
        """
        self._db_factory = db_session_factory
        # Create tables
        async with self._db_factory() as session:
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS metric_samples (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    ts REAL NOT NULL,
                    metric_name TEXT NOT NULL,
                    value REAL NOT NULL
                )
            """))
            await session.execute(text("""
                CREATE TABLE IF NOT EXISTS metric_agg_5min (
                    bucket_ts REAL NOT NULL,
                    metric_name TEXT NOT NULL,
                    count INTEGER NOT NULL,
                    sum REAL NOT NULL,
                    min REAL NOT NULL,
                    max REAL NOT NULL,
                    PRIMARY KEY (bucket_ts, metric_name)
                )
            """))
            await session.commit()
        # Load recent history from DB
        await self._load_history()
        logger.info("Metrics persistence initialized")

    async def _flush_to_db(self) -> None:
        """Flush in-memory samples to SQLite. Called by background task."""
        if not hasattr(self, '_db_factory'):
            return

        async with self._lock:
            # Collect samples to flush
            samples = []
            now = time.time()
            for r in list(self._requests)[-100:]:  # last 100
                if r.timestamp > (self._last_flush_ts if hasattr(self, '_last_flush_ts') else 0):
                    samples.append((r.timestamp, "request_latency", r.duration_ms))
            for c in list(self._ai_calls)[-50:]:
                if c.timestamp > (self._last_flush_ts if hasattr(self, '_last_flush_ts') else 0):
                    samples.append((c.timestamp, "ai_call_duration", c.duration_ms))
                    samples.append((c.timestamp, "ai_call_success", 1.0 if c.success else 0.0))
            for q in list(self._db_queries)[-100:]:
                if q.timestamp > (self._last_flush_ts if hasattr(self, '_last_flush_ts') else 0):
                    samples.append((q.timestamp, "db_query_duration", q.duration_ms))
            self._last_flush_ts = now

        if not samples:
            return

        try:
            async with self._db_factory() as session:
                for ts, name, val in samples:
                    await session.execute(
                        text("INSERT INTO metric_samples (ts, metric_name, value) VALUES (:ts, :name, :val)"),
                        {"ts": ts, "name": name, "val": val}
                    )
                await session.commit()
            logger.debug("Flushed %d metric samples to DB", len(samples))
        except Exception as e:
            logger.warning("Failed to flush metrics to DB: %s", e)

    async def _aggregate_5min(self) -> None:
        """Roll up raw samples into 5-minute buckets."""
        if not hasattr(self, '_db_factory'):
            return

        try:
            async with self._db_factory() as session:
                # Find unaggregated samples (older than 5 min)
                cutoff = time.time() - 300
                result = await session.execute(text("""
                    SELECT metric_name,
                           MIN(ts) as bucket_start,
                           COUNT(*) as cnt,
                           SUM(value) as val_sum,
                           MIN(value) as val_min,
                           MAX(value) as val_max
                    FROM metric_samples
                    WHERE ts < :cutoff
                    GROUP BY metric_name, CAST(ts / 300 AS INTEGER)
                """), {"cutoff": cutoff})

                for row in result.fetchall():
                    bucket_ts = float(row[1]) // 300 * 300
                    await session.execute(text("""
                        INSERT OR REPLACE INTO metric_agg_5min
                        (bucket_ts, metric_name, count, sum, min, max)
                        VALUES (:bt, :mn, :cnt, :s, :mi, :ma)
                    """), {
                        "bt": bucket_ts, "mn": row[0], "cnt": row[2],
                        "s": row[3], "mi": row[4], "ma": row[5]
                    })

                # Delete old raw samples (keep 1 hour)
                old_cutoff = time.time() - 3600
                await session.execute(
                    text("DELETE FROM metric_samples WHERE ts < :cutoff"),
                    {"cutoff": old_cutoff}
                )
                await session.commit()
        except Exception as e:
            logger.warning("Failed to aggregate metrics: %s", e)

    async def _load_history(self) -> None:
        """Load recent aggregated history from DB into memory."""
        if not hasattr(self, '_db_factory'):
            return

        try:
            async with self._db_factory() as session:
                cutoff = time.time() - self._history_minutes * 60
                result = await session.execute(text("""
                    SELECT bucket_ts, metric_name, count, sum, min, max
                    FROM metric_agg_5min
                    WHERE bucket_ts > :cutoff
                    ORDER BY bucket_ts
                """), {"cutoff": cutoff})

                # Group by bucket
                buckets: dict[float, dict] = {}
                for row in result.fetchall():
                    ts = row[0]
                    if ts not in buckets:
                        buckets[ts] = {}
                    buckets[ts][row[1]] = {"count": row[2], "sum": row[3], "min": row[4], "max": row[5]}

                for ts, data in sorted(buckets.items()):
                    point = TimeSeriesPoint(
                        timestamp=ts,
                        requests_per_minute=float(data.get("request_latency", {}).get("count", 0)),
                        avg_latency_ms=round(data.get("request_latency", {}).get("sum", 0) / max(data.get("request_latency", {}).get("count", 1), 1), 2),
                        ai_calls_per_minute=float(data.get("ai_call_duration", {}).get("count", 0)),
                    )
                    self._history.append(point)

                logger.info("Loaded %d historical metric buckets", len(buckets))
        except Exception as e:
            logger.warning("Could not load metric history: %s", e)

    async def get_historical_metrics(self, hours: int = 24) -> list[dict]:
        """Query aggregated historical metrics from SQLite."""
        if not hasattr(self, '_db_factory'):
            return []

        try:
            async with self._db_factory() as session:
                cutoff = time.time() - hours * 3600
                result = await session.execute(text("""
                    SELECT bucket_ts, metric_name, count, sum, min, max
                    FROM metric_agg_5min
                    WHERE bucket_ts > :cutoff
                    ORDER BY bucket_ts
                """), {"cutoff": cutoff})

                buckets: dict[float, dict] = {}
                for row in result.fetchall():
                    ts = row[0]
                    if ts not in buckets:
                        buckets[ts] = {"timestamp": ts}
                    buckets[ts][f"{row[1]}_count"] = row[2]
                    buckets[ts][f"{row[1]}_avg"] = round(row[3] / max(row[2], 1), 2)

                return sorted(buckets.values(), key=lambda x: x["timestamp"])
        except Exception as e:
            logger.warning("Failed to query historical metrics: %s", e)
            return []

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
