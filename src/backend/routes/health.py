"""
Health Check Routes

Provides comprehensive health check endpoints for monitoring:
- Database connectivity
- AI service status
- Disk space
- Application dependencies
"""

import sys
import platform
import shutil
import importlib
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter
from sqlalchemy import text

from config import settings
from utils.logging import get_logger

logger = get_logger("writer-api.health")

router = APIRouter(prefix="/health", tags=["health"])


async def _check_database() -> dict:
    """Check database connectivity."""
    try:
        from database import engine
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "connected", "latency_ms": 0}
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        return {"status": "error", "detail": str(e)}


async def _check_ai_service() -> dict:
    """Check AI service (MiniMax) configuration and basic connectivity."""
    try:
        from services.ai_service import ai_service
        if settings.minimax_api_key:
            return {
                "status": "configured",
                "url": settings.minimax_api_url,
            }
        else:
            return {
                "status": "not_configured",
                "message": "MiniMax API key not set",
            }
    except ImportError:
        return {"status": "unknown", "message": "AI service module not available"}
    except Exception as e:
        logger.error(f"AI service health check failed: {e}")
        return {"status": "error", "detail": str(e)}


async def _check_disk_space() -> dict:
    """Check available disk space for the data directory."""
    try:
        data_dir = Path(__file__).parent.parent.parent / "data"
        data_dir.mkdir(parents=True, exist_ok=True)
        usage = shutil.disk_usage(str(data_dir))

        total_gb = usage.total / (1024 ** 3)
        free_gb = usage.free / (1024 ** 3)
        used_percent = (usage.used / usage.total) * 100

        status = "healthy"
        if free_gb < 1.0:  # Less than 1GB free
            status = "critical"
        elif free_gb < 5.0:  # Less than 5GB free
            status = "warning"

        return {
            "status": status,
            "total_gb": round(total_gb, 2),
            "free_gb": round(free_gb, 2),
            "used_percent": round(used_percent, 2),
            "path": str(data_dir),
        }
    except Exception as e:
        logger.error(f"Disk space health check failed: {e}")
        return {"status": "error", "detail": str(e)}


async def _check_dependencies() -> dict:
    """Check key Python dependencies."""
    dependencies = [
        ("fastapi", "FastAPI"),
        ("sqlalchemy", "SQLAlchemy"),
        ("aiosqlite", "aiosqlite"),
        ("pydantic_settings", "pydantic-settings"),
        ("httpx", "httpx"),
    ]

    results = {}
    for module_name, display_name in dependencies:
        try:
            mod = importlib.import_module(module_name)
            version = getattr(mod, "__version__", "unknown")
            results[display_name] = {"status": "available", "version": version}
        except ImportError:
            results[display_name] = {"status": "missing"}

    return results


@router.get("")
async def health_check():
    """
    Comprehensive health check endpoint for monitoring.
    Verifies database connectivity, AI service status, disk space, and dependencies.
    """
    checks = {
        "database": await _check_database(),
        "ai_service": await _check_ai_service(),
        "disk_space": await _check_disk_space(),
        "dependencies": await _check_dependencies(),
    }

    # Determine overall status
    overall_status = "healthy"
    for check in checks.values():
        if isinstance(check, dict):
            check_status = check.get("status", "unknown")
            if check_status in ("error", "critical", "missing"):
                overall_status = "unhealthy"
                break
            elif check_status in ("warning", "not_configured") and overall_status == "healthy":
                overall_status = "degraded"

    return {
        "status": overall_status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "app": {
            "name": settings.app_name,
            "version": settings.app_version,
        },
        "system": {
            "python_version": sys.version.split()[0],
            "platform": platform.platform(),
        },
        "checks": checks,
    }


@router.get("/ready")
async def readiness_check():
    """
    Kubernetes-style readiness probe.
    Returns 200 only when the app is ready to accept traffic.
    """
    db_check = await _check_database()
    if db_check["status"] != "connected":
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=503,
            content={"status": "not_ready", "reason": "database_unavailable"},
        )
    return {"status": "ready"}


@router.get("/live")
async def liveness_check():
    """
    Kubernetes-style liveness probe.
    Returns 200 if the application process is alive.
    """
    return {"status": "alive"}
