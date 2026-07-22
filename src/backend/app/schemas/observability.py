"""Observability schemas (Phase 1 Track B.4)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import Field

from app.schemas.base import BaseSchema


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------

class HealthStatus(BaseSchema):
    status: str  # "ok" | "degraded" | "down"
    uptime_seconds: float
    db_status: str  # "ok" | "down"
    ai_status: str  # "ok" | "unconfigured" | "down"
    version: str
    correlation_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------

class MetricOut(BaseSchema):
    id: int
    name: str
    value: float
    metric_type: str
    tags: Optional[dict] = None
    correlation_id: Optional[str] = None
    created_at: str


class MetricsResponse(BaseSchema):
    range: str
    metrics: list[MetricOut]
    total: int


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------

class ErrorOut(BaseSchema):
    id: int
    message: str
    level: str
    resolved: bool
    resolution_note: Optional[str] = None
    correlation_id: Optional[str] = None
    created_at: str


class ErrorList(BaseSchema):
    range: str
    errors: list[ErrorOut]
    total: int


class ResolveRequest(BaseSchema):
    note: str = Field(..., min_length=1, max_length=1000)


class ResolveResult(BaseSchema):
    id: int
    resolved: bool
    resolution_note: str
    resolved_at: str


# ---------------------------------------------------------------------------
# Audit
# ---------------------------------------------------------------------------

class AuditOut(BaseSchema):
    id: int
    user_id: str
    action: str
    resource_type: str
    resource_id: Optional[str] = None
    details: Optional[dict] = None
    correlation_id: Optional[str] = None
    created_at: str


class AuditList(BaseSchema):
    range: str
    events: list[AuditOut]
    total: int


# ---------------------------------------------------------------------------
# Logs (read-only view of recent logs; rotate triggers log file rotation)
# ---------------------------------------------------------------------------

class LogOut(BaseSchema):
    level: str
    message: str
    correlation_id: Optional[str] = None
    timestamp: str
    source: Optional[str] = None


class LogList(BaseSchema):
    range: str
    logs: list[LogOut]
    total: int


class RotateResult(BaseSchema):
    rotated_at: str
    old_log_path: str
    new_log_path: str
    bytes_freed: int


# ---------------------------------------------------------------------------
# Usage
# ---------------------------------------------------------------------------

class UsageStats(BaseSchema):
    range: str
    total_events: int
    total_count: int
    unique_features: int


class FeatureUsage(BaseSchema):
    range: str
    features: list[dict]


class UserUsage(BaseSchema):
    range: str
    users: list[dict]


class ExportRequest(BaseSchema):
    range: str = "24h"
    format: str = Field(default="json", pattern="^(json|csv)$")


class ExportResult(BaseSchema):
    path: str
    format: str
    size_bytes: int
    rows: int
    exported_at: str
