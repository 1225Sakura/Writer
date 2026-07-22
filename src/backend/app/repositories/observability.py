"""ObservabilityRepository — typed SQLAlchemy access for observability tables."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import AuditEvent, ErrorEvent, MetricEvent, UsageEvent


class ObservabilityRepository:
    """Typed SQLAlchemy access to observability tables."""

    def __init__(self, db: Session):
        self._db = db

    # ----- metrics -----

    def list_metrics(
        self, range: str = "24h", skip: int = 0, limit: int = 100
    ) -> list[MetricEvent]:
        since = self._since(range)
        stmt = (
            select(MetricEvent)
            .where(MetricEvent.created_at >= since)
            .order_by(MetricEvent.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(self._db.execute(stmt).scalars().all())

    def count_metrics(self, range: str = "24h") -> int:
        since = self._since(range)
        stmt = (
            select(func.count(MetricEvent.id))
            .where(MetricEvent.created_at >= since)
        )
        return int(self._db.execute(stmt).scalar_one())

    def create_metric(
        self,
        name: str,
        value: float = 1.0,
        *,
        metric_type: str = "counter",
        tags: Optional[dict] = None,
        correlation_id: Optional[str] = None,
    ) -> MetricEvent:
        m = MetricEvent(
            user_id="default-user",
            name=name,
            value=value,
            metric_type=metric_type,
            tags=tags,
            correlation_id=correlation_id,
        )
        self._db.add(m)
        self._db.commit()
        self._db.refresh(m)
        return m

    # ----- errors -----

    def list_errors(
        self,
        range: str = "24h",
        level: Optional[str] = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ErrorEvent]:
        since = self._since(range)
        stmt = select(ErrorEvent).where(ErrorEvent.created_at >= since)
        if level:
            stmt = stmt.where(ErrorEvent.level == level)
        stmt = stmt.order_by(ErrorEvent.created_at.desc()).offset(skip).limit(limit)
        return list(self._db.execute(stmt).scalars().all())

    def count_errors(self, range: str = "24h", level: Optional[str] = None) -> int:
        since = self._since(range)
        stmt = select(func.count(ErrorEvent.id)).where(ErrorEvent.created_at >= since)
        if level:
            stmt = stmt.where(ErrorEvent.level == level)
        return int(self._db.execute(stmt).scalar_one())

    def get_error(self, error_id: int) -> Optional[ErrorEvent]:
        stmt = select(ErrorEvent).where(ErrorEvent.id == error_id)
        return self._db.execute(stmt).scalars().first()

    def resolve_error(self, error_id: int, note: str) -> Optional[ErrorEvent]:
        e = self.get_error(error_id)
        if not e:
            return None
        e.resolved = True
        e.resolution_note = note
        self._db.commit()
        self._db.refresh(e)
        return e

    def create_error(
        self,
        message: str,
        *,
        level: str = "error",
        stack_trace: Optional[str] = None,
        correlation_id: Optional[str] = None,
    ) -> ErrorEvent:
        e = ErrorEvent(
            user_id="default-user",
            message=message,
            level=level,
            stack_trace=stack_trace,
            correlation_id=correlation_id,
        )
        self._db.add(e)
        self._db.commit()
        self._db.refresh(e)
        return e

    # ----- audit -----

    def list_audit(
        self, range: str = "24h", skip: int = 0, limit: int = 100
    ) -> list[AuditEvent]:
        since = self._since(range)
        stmt = (
            select(AuditEvent)
            .where(AuditEvent.created_at >= since)
            .order_by(AuditEvent.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(self._db.execute(stmt).scalars().all())

    def count_audit(self, range: str = "24h") -> int:
        since = self._since(range)
        stmt = (
            select(func.count(AuditEvent.id))
            .where(AuditEvent.created_at >= since)
        )
        return int(self._db.execute(stmt).scalar_one())

    def create_audit(
        self,
        action: str,
        resource_type: str,
        *,
        resource_id: Optional[str] = None,
        details: Optional[dict] = None,
        correlation_id: Optional[str] = None,
    ) -> AuditEvent:
        a = AuditEvent(
            user_id="default-user",
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            correlation_id=correlation_id,
        )
        self._db.add(a)
        self._db.commit()
        self._db.refresh(a)
        return a

    # ----- usage -----

    def list_usage(
        self, range: str = "24h", skip: int = 0, limit: int = 100
    ) -> list[UsageEvent]:
        since = self._since(range)
        stmt = (
            select(UsageEvent)
            .where(UsageEvent.created_at >= since)
            .order_by(UsageEvent.created_at.desc())
            .offset(skip)
            .limit(limit)
        )
        return list(self._db.execute(stmt).scalars().all())

    def count_usage(self, range: str = "24h") -> int:
        since = self._since(range)
        stmt = (
            select(func.count(UsageEvent.id))
            .where(UsageEvent.created_at >= since)
        )
        return int(self._db.execute(stmt).scalar_one())

    def list_usage_by_feature(self, range: str = "24h") -> list[dict]:
        since = self._since(range)
        stmt = (
            select(
                UsageEvent.feature,
                func.sum(UsageEvent.count).label("total_count"),
                func.count(UsageEvent.id).label("event_count"),
            )
            .where(UsageEvent.created_at >= since)
            .group_by(UsageEvent.feature)
            .order_by(func.sum(UsageEvent.count).desc())
        )
        rows = self._db.execute(stmt).all()
        return [
            {"feature": r.feature, "total_count": int(r.total_count), "event_count": int(r.event_count)}
            for r in rows
        ]

    def list_usage_by_user(self, range: str = "24h") -> list[dict]:
        since = self._since(range)
        stmt = (
            select(
                UsageEvent.user_id,
                func.sum(UsageEvent.count).label("total_count"),
                func.count(UsageEvent.id).label("event_count"),
            )
            .where(UsageEvent.created_at >= since)
            .group_by(UsageEvent.user_id)
            .order_by(func.sum(UsageEvent.count).desc())
        )
        rows = self._db.execute(stmt).all()
        return [
            {"user_id": r.user_id, "total_count": int(r.total_count), "event_count": int(r.event_count)}
            for r in rows
        ]

    def create_usage(
        self,
        feature: str,
        count: int = 1,
        *,
        metadata_json: Optional[dict] = None,
    ) -> UsageEvent:
        u = UsageEvent(
            user_id="default-user",
            feature=feature,
            count=count,
            metadata_json=metadata_json,
        )
        self._db.add(u)
        self._db.commit()
        self._db.refresh(u)
        return u

    # ----- helpers -----

    @staticmethod
    def _since(range: str) -> datetime:
        """Convert range string ("24h", "7d", "1h") to a UTC datetime cutoff."""
        now = datetime.utcnow()
        if range.endswith("h"):
            hours = int(range[:-1])
            return now - timedelta(hours=hours)
        if range.endswith("d"):
            days = int(range[:-1])
            return now - timedelta(days=days)
        if range.endswith("m"):
            minutes = int(range[:-1])
            return now - timedelta(minutes=minutes)
        # Default: 24h
        return now - timedelta(hours=24)
