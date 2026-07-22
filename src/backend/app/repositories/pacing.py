"""PacingRepository — typed SQLAlchemy access for pacing tables."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import PacingCurve, Recommendation


class PacingRepository:
    """Typed SQLAlchemy access to pacing tables."""

    def __init__(self, db: Session):
        self._db = db

    # ----- curves -----

    def get_curve(self, chapter_id: int) -> Optional[PacingCurve]:
        stmt = (
            select(PacingCurve)
            .where(PacingCurve.chapter_id == chapter_id)
            .order_by(PacingCurve.id.desc())
        )
        return self._db.execute(stmt).scalars().first()

    def upsert_curve(
        self,
        chapter_id: int,
        curve_data: list,
        avg_intensity: float,
        variance: float,
    ) -> PacingCurve:
        existing = self.get_curve(chapter_id)
        if existing:
            existing.curve_data = curve_data
            existing.avg_intensity = avg_intensity
            existing.variance = variance
            self._db.commit()
            self._db.refresh(existing)
            return existing
        curve = PacingCurve(
            user_id="default-user",
            chapter_id=chapter_id,
            curve_data=curve_data,
            avg_intensity=avg_intensity,
            variance=variance,
        )
        self._db.add(curve)
        self._db.commit()
        self._db.refresh(curve)
        return curve

    # ----- recommendations -----

    def list_recommendations(self, chapter_id: int) -> list[Recommendation]:
        stmt = (
            select(Recommendation)
            .where(Recommendation.chapter_id == chapter_id)
            .order_by(Recommendation.priority.asc(), Recommendation.id.asc())
        )
        return list(self._db.execute(stmt).scalars().all())

    def create_recommendation(
        self,
        chapter_id: int,
        title: str,
        description: str,
        *,
        category: str = "general",
        priority: int = 5,
    ) -> Recommendation:
        rec = Recommendation(
            user_id="default-user",
            chapter_id=chapter_id,
            title=title,
            description=description,
            category=category,
            priority=priority,
        )
        self._db.add(rec)
        self._db.commit()
        self._db.refresh(rec)
        return rec

    def get_recommendation(self, rec_id: int) -> Optional[Recommendation]:
        stmt = select(Recommendation).where(Recommendation.id == rec_id)
        return self._db.execute(stmt).scalars().first()

    def apply_recommendation(self, rec_id: int) -> Optional[Recommendation]:
        rec = self.get_recommendation(rec_id)
        if not rec:
            return None
        rec.applied = True
        self._db.commit()
        self._db.refresh(rec)
        return rec
