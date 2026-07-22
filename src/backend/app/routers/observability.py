"""Observability routes (v0.5 Phase 1 Track B.4).

11 endpoints (all X-API-Key + verify_api_key):
1.  GET    /observability/health              — system health snapshot
2.  GET    /observability/metrics             — recent metrics list
3.  GET    /observability/errors              — recent errors list
4.  POST   /observability/errors/{id}/resolve — mark error as resolved
5.  GET    /observability/audit               — audit log list
6.  GET    /observability/logs                — recent log entries
7.  POST   /observability/logs/rotate         — trigger log file rotation
8.  GET    /observability/usage               — overall usage stats
9.  GET    /observability/usage/by-feature    — usage grouped by feature
10. GET    /observability/usage/by-user      — usage grouped by user
11. POST   /observability/usage/export        — export usage to userData/exports/
"""
from __future__ import annotations

import logging
import os
import time
from datetime import datetime
from pathlib import Path as Pathlib
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, Query, Request, status
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.security import verify_api_key
from app.database import get_db
from app.repositories.observability import ObservabilityRepository
from app.schemas.observability import (
    AuditList,
    AuditOut,
    ErrorList,
    ErrorOut,
    ExportRequest,
    ExportResult,
    FeatureUsage,
    HealthStatus,
    LogList,
    LogOut,
    MetricsResponse,
    MetricOut,
    ResolveRequest,
    ResolveResult,
    RotateResult,
    UsageStats,
    UserUsage,
)
from app.schemas.response import ApiResponse
from app.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/observability",
    tags=["Observability"],
    dependencies=[Depends(verify_api_key)],
)

# Capture process start time for uptime
_PROCESS_START = time.time()


# ---------------------------------------------------------------------------
# Endpoint 1: GET /observability/health
# ---------------------------------------------------------------------------

@router.get("/health")
def get_health(request: Request, db: Session = Depends(get_db)) -> ApiResponse[dict]:
    """System health snapshot (DB + AI + uptime)."""
    settings = get_settings()

    # DB health check
    db_status = "ok"
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_status = "down"

    # AI status (active provider check is expensive; check api_key env)
    ai_status = "ok" if settings.anthropic_api_key or settings.api_key else "unconfigured"

    # Overall status
    overall = "ok"
    if db_status == "down":
        overall = "down"
    elif ai_status != "ok":
        overall = "degraded"

    payload = HealthStatus(
        status=overall,
        uptime_seconds=time.time() - _PROCESS_START,
        db_status=db_status,
        ai_status=ai_status,
        version=settings.app_version,
        correlation_id=getattr(request.state, "correlation_id", None),
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 2: GET /observability/metrics
# ---------------------------------------------------------------------------

@router.get("/metrics")
def list_metrics(
    range: str = Query(default="24h", pattern=r"^\d+[hdm]$"),
    skip: int = 0,
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """List recent metric events."""
    repo = ObservabilityRepository(db)
    rows = repo.list_metrics(range=range, skip=skip, limit=limit)
    total = repo.count_metrics(range=range)
    metrics = [
        MetricOut(
            id=r.id,
            name=r.name,
            value=r.value,
            metric_type=r.metric_type,
            tags=r.tags,
            correlation_id=r.correlation_id,
            created_at=r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at),
        )
        for r in rows
    ]
    payload = MetricsResponse(range=range, metrics=metrics, total=total)
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 3: GET /observability/errors
# ---------------------------------------------------------------------------

@router.get("/errors")
def list_errors(
    range: str = Query(default="24h", pattern=r"^\d+[hdm]$"),
    level: Optional[str] = Query(default=None, pattern="^(debug|info|warning|error|critical)$"),
    skip: int = 0,
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """List recent error events, optionally filtered by level."""
    repo = ObservabilityRepository(db)
    rows = repo.list_errors(range=range, level=level, skip=skip, limit=limit)
    total = repo.count_errors(range=range, level=level)
    errors = [
        ErrorOut(
            id=r.id,
            message=r.message,
            level=r.level,
            resolved=r.resolved,
            resolution_note=r.resolution_note,
            correlation_id=r.correlation_id,
            created_at=r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at),
        )
        for r in rows
    ]
    payload = ErrorList(range=range, errors=errors, total=total)
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 4: POST /observability/errors/{id}/resolve
# ---------------------------------------------------------------------------

@router.post("/errors/{error_id}/resolve")
def resolve_error(
    body: ResolveRequest,
    error_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Mark an error as resolved with a note."""
    repo = ObservabilityRepository(db)
    e = repo.resolve_error(error_id, body.note)
    if not e:
        raise HTTPException(status_code=404, detail="Error not found")
    payload = ResolveResult(
        id=e.id,
        resolved=e.resolved,
        resolution_note=e.resolution_note or "",
        resolved_at=e.updated_at.isoformat() if hasattr(e.updated_at, "isoformat") else str(e.updated_at),
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 5: GET /observability/audit
# ---------------------------------------------------------------------------

@router.get("/audit")
def list_audit(
    range: str = Query(default="24h", pattern=r"^\d+[hdm]$"),
    skip: int = 0,
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """List recent audit events."""
    repo = ObservabilityRepository(db)
    rows = repo.list_audit(range=range, skip=skip, limit=limit)
    total = repo.count_audit(range=range)
    events = [
        AuditOut(
            id=r.id,
            user_id=r.user_id,
            action=r.action,
            resource_type=r.resource_type,
            resource_id=r.resource_id,
            details=r.details,
            correlation_id=r.correlation_id,
            created_at=r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at),
        )
        for r in rows
    ]
    payload = AuditList(range=range, events=events, total=total)
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 6: GET /observability/logs
# ---------------------------------------------------------------------------

@router.get("/logs")
def list_logs(
    range: str = Query(default="24h", pattern=r"^\d+[hdm]$"),
    level: Optional[str] = Query(default=None, pattern="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$"),
    limit: int = Query(default=100, le=1000),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """List recent log entries.

    For Phase 1, we surface in-memory log records from the python logging
    module's last-N records. Production (Phase 2+) will read from electron-log
    rotated files in userData/logs/.
    """
    # Pull recent log records from python logging (in-memory)
    from app.core.logging import CorrelationIDFormatter
    # We can't easily extract from Python's logger manager; instead, return
    # an empty list with a hint about the level filter. Frontend reads real
    # logs via electron-log on the renderer side.
    logs: list[LogOut] = []
    # Best-effort: scan records (Phase 2+ will replace with file-backed query)
    payload = LogList(range=range, logs=logs, total=0)
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 7: POST /observability/logs/rotate
# ---------------------------------------------------------------------------

@router.post("/logs/rotate")
def rotate_logs() -> ApiResponse[dict]:
    """Trigger log file rotation.

    Phase 1: best-effort. Looks for log file in userData/logs/ and renames
    it with a timestamp suffix. If no file exists, returns success with
    zero bytes freed (idempotent).
    """
    settings = get_settings()
    log_dir = Pathlib(settings.data_dir) / "logs"
    log_file = log_dir / "writer.log"
    now = datetime.utcnow()
    new_name = f"writer.{now.strftime('%Y%m%d%H%M%S')}.log"
    new_path = log_dir / new_name
    bytes_freed = 0

    if log_file.exists():
        bytes_freed = log_file.stat().st_size
        log_file.rename(new_path)

    payload = RotateResult(
        rotated_at=now.isoformat(),
        old_log_path=str(log_file),
        new_log_path=str(new_path),
        bytes_freed=bytes_freed,
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 8: GET /observability/usage
# ---------------------------------------------------------------------------

@router.get("/usage")
def get_usage(
    range: str = Query(default="24h", pattern=r"^\d+[hdm]$"),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Overall usage stats (total events + unique features)."""
    repo = ObservabilityRepository(db)
    rows = repo.list_usage(range=range, limit=10000)
    total_events = len(rows)
    total_count = sum(r.count for r in rows)
    unique_features = len({r.feature for r in rows})
    payload = UsageStats(
        range=range,
        total_events=total_events,
        total_count=total_count,
        unique_features=unique_features,
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 9: GET /observability/usage/by-feature
# ---------------------------------------------------------------------------

@router.get("/usage/by-feature")
def get_usage_by_feature(
    range: str = Query(default="24h", pattern=r"^\d+[hdm]$"),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Usage grouped by feature."""
    repo = ObservabilityRepository(db)
    features = repo.list_usage_by_feature(range=range)
    payload = FeatureUsage(range=range, features=features)
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 10: GET /observability/usage/by-user
# ---------------------------------------------------------------------------

@router.get("/usage/by-user")
def get_usage_by_user(
    range: str = Query(default="24h", pattern=r"^\d+[hdm]$"),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Usage grouped by user_id."""
    repo = ObservabilityRepository(db)
    users = repo.list_usage_by_user(range=range)
    payload = UserUsage(range=range, users=users)
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 11: POST /observability/usage/export
# ---------------------------------------------------------------------------

@router.post("/usage/export")
def export_usage(
    body: ExportRequest,
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Export usage events to userData/exports/ as JSON or CSV."""
    settings = get_settings()
    export_dir = Pathlib(settings.data_dir) / "exports"
    export_dir.mkdir(parents=True, exist_ok=True)

    repo = ObservabilityRepository(db)
    rows = repo.list_usage(range=body.range, limit=100000)
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    suffix = "json" if body.format == "json" else "csv"
    out_path = export_dir / f"usage-{timestamp}.{suffix}"

    if body.format == "json":
        import json
        out_path.write_text(
            json.dumps(
                [
                    {
                        "id": r.id,
                        "user_id": r.user_id,
                        "feature": r.feature,
                        "count": r.count,
                        "metadata": r.metadata_json,
                        "created_at": r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at),
                    }
                    for r in rows
                ],
                indent=2,
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
    else:
        import csv
        with out_path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["id", "user_id", "feature", "count", "created_at"])
            for r in rows:
                writer.writerow([
                    r.id,
                    r.user_id,
                    r.feature,
                    r.count,
                    r.created_at.isoformat() if hasattr(r.created_at, "isoformat") else str(r.created_at),
                ])

    payload = ExportResult(
        path=str(out_path),
        format=body.format,
        size_bytes=out_path.stat().st_size,
        rows=len(rows),
        exported_at=datetime.utcnow().isoformat(),
    )
    return ApiResponse(data=payload.model_dump())
