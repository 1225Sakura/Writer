"""Observability models (Phase 1 Track B.4).

Four tables:
- metric_events: numeric metrics (counters/gauges/histograms)
- error_events: application errors with stack traces + correlation_id
- audit_events: security/audit log (who did what when)
- usage_events: feature usage tracking (user_id × feature × timestamp)
"""
from __future__ import annotations

from sqlalchemy import String, Text, ForeignKey, Integer, Float, DateTime, Boolean, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column

from app.models import BaseModel


class MetricEvent(BaseModel):
    """Numeric metric (counter, gauge, histogram)."""

    __tablename__ = "metric_events"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    name: Mapped[str] = mapped_column(String(100), index=True)
    value: Mapped[float] = mapped_column(Float, default=0.0)
    metric_type: Mapped[str] = mapped_column(String(20), default="counter")  # counter/gauge/histogram
    tags: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class ErrorEvent(BaseModel):
    """Application error with optional correlation_id linkage."""

    __tablename__ = "error_events"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    message: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(20), default="error")  # debug/info/warning/error/critical
    stack_trace: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved: Mapped[bool] = mapped_column(Boolean, default=False)
    resolution_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)


class AuditEvent(BaseModel):
    """Audit log entry (who did what when)."""

    __tablename__ = "audit_events"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user", index=True
    )
    action: Mapped[str] = mapped_column(String(100), index=True)
    resource_type: Mapped[str] = mapped_column(String(50))
    resource_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    correlation_id: Mapped[str | None] = mapped_column(String(64), nullable=True)


class UsageEvent(BaseModel):
    """Feature usage tracking (per user per feature)."""

    __tablename__ = "usage_events"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user", index=True
    )
    feature: Mapped[str] = mapped_column(String(100), index=True)
    count: Mapped[int] = mapped_column(Integer, default=1)
    metadata_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
