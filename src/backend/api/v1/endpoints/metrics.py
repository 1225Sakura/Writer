"""Metrics API Routes.

Provides performance monitoring endpoints:
- /api/v1/metrics         : Current metrics summary
- /api/v1/metrics/history : Time-series history
"""

from __future__ import annotations

from fastapi import APIRouter, Query

from backend.middleware.auth import require_auth
from backend.infrastructure.observability.metrics_service import metrics_service

router = APIRouter(prefix="/metrics", tags=["metrics"])


@router.get("", dependencies=[require_auth])
async def get_metrics_summary(
    window_seconds: int = Query(default=60, ge=10, le=3600),
):
    """
    Get current performance metrics summary.

    Returns aggregated statistics for the specified time window:
    - Request latency histograms (p50/p95/p99)
    - AI call success/failure rates
    - Database query counts and slow query statistics
    - Active WebSocket connection count

    Args:
        window_seconds: Time window for aggregation (10-3600s, default 60s).
    """
    return await metrics_service.get_summary(window_seconds=window_seconds)


@router.get("/history", dependencies=[require_auth])
async def get_metrics_history(
    minutes: int = Query(default=5, ge=1, le=60),
):
    """
    Get time-series metrics history.

    Returns per-minute aggregated metrics for the specified number of minutes.

    Args:
        minutes: Number of minutes of history to return (1-60, default 5).
    """
    return {
        "minutes": minutes,
        "points": await metrics_service.get_history(minutes=minutes),
    }
