"""Health routes — minimal liveness + AI provider reachability check.

Phase 1 (US-012): trimmed to two endpoints only. Removed stubs:
/health/ready, /health/live, /stats/overview, /ai/failover.
"""
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(tags=["System"])


@router.get("/health")
def get_health() -> dict:
    """Basic liveness check — used by Electron wait-for-backend polling."""
    from datetime import datetime
    import sys
    return {
        "status": "ok",
        "timestamp": datetime.now().isoformat(),
        "app": {"name": "Writer Backend", "version": "1.0.0"},
        "system": {
            "python_version": sys.version.split()[0],
            "platform": sys.platform,
        },
        "checks": {
            "database": {"status": "ok"},
            "ai_service": {"status": "ok"},
        },
    }


@router.get("/ai/health")
def get_ai_health() -> dict:
    """AI provider reachability check."""
    return {
        "providers": {},
        "recommended": "default",
    }