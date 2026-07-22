"""EngagementRepository — typed SQLAlchemy access for engagement tables."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import CoolPoint, EngagementScore, Fulfillment


class EngagementRepository:
    """Typed SQLAlchemy access to engagement tables."""

    def __init__(self, db: Session):
        self._db = db

    # ----- scores -----

    def get_score(self, chapter_id: int) -> Optional[EngagementScore]:
        stmt = (
            select(EngagementScore)
            .where(EngagementScore.chapter_id == chapter_id)
            .order_by(EngagementScore.id.desc())
        )
        return self._db.execute(stmt).scalars().first()

    def upsert_score(
        self,
        chapter_id: int,
        *,
        hook_score: float = 0.0,
        engagement_score: float = 0.0,
        predicted_retention: float = 0.0,
        overall_score: float = 0.0,
        grade: str = "N/A",
        factors: Optional[dict] = None,
    ) -> EngagementScore:
        existing = self.get_score(chapter_id)
        if existing:
            existing.hook_score = hook_score
            existing.engagement_score = engagement_score
            existing.predicted_retention = predicted_retention
            existing.overall_score = overall_score
            existing.grade = grade
            existing.factors = factors
            self._db.commit()
            self._db.refresh(existing)
            return existing
        score = EngagementScore(
            user_id="default-user",
            chapter_id=chapter_id,
            hook_score=hook_score,
            engagement_score=engagement_score,
            predicted_retention=predicted_retention,
            overall_score=overall_score,
            grade=grade,
            factors=factors,
        )
        self._db.add(score)
        self._db.commit()
        self._db.refresh(score)
        return score

    # ----- cool_points -----

    def list_cool_points(self, chapter_id: int) -> list[CoolPoint]:
        stmt = (
            select(CoolPoint)
            .where(CoolPoint.chapter_id == chapter_id)
            .order_by(CoolPoint.position.asc(), CoolPoint.id.asc())
        )
        return list(self._db.execute(stmt).scalars().all())

    def create_cool_point(
        self,
        chapter_id: int,
        text: str,
        *,
        point_type: str = "reveal",
        intensity: float = 0.5,
        position: int = 0,
        context: Optional[str] = None,
    ) -> CoolPoint:
        cp = CoolPoint(
            user_id="default-user",
            chapter_id=chapter_id,
            point_type=point_type,
            text=text,
            intensity=intensity,
            position=position,
            context=context,
        )
        self._db.add(cp)
        self._db.commit()
        self._db.refresh(cp)
        return cp

    def get_cool_point(self, cool_point_id: int) -> Optional[CoolPoint]:
        stmt = select(CoolPoint).where(CoolPoint.id == cool_point_id)
        return self._db.execute(stmt).scalars().first()

    def delete_cool_point(self, cool_point_id: int) -> bool:
        cp = self.get_cool_point(cool_point_id)
        if not cp:
            return False
        self._db.delete(cp)
        self._db.commit()
        return True

    # ----- fulfillments -----

    def list_fulfillments(self, chapter_id: int) -> list[Fulfillment]:
        stmt = (
            select(Fulfillment)
            .where(Fulfillment.chapter_id == chapter_id)
            .order_by(Fulfillment.position.asc(), Fulfillment.id.asc())
        )
        return list(self._db.execute(stmt).scalars().all())

    def create_fulfillment(
        self,
        chapter_id: int,
        text: str,
        *,
        size: str = "medium",
        position: int = 0,
        context: Optional[str] = None,
    ) -> Fulfillment:
        f = Fulfillment(
            user_id="default-user",
            chapter_id=chapter_id,
            size=size,
            text=text,
            position=position,
            context=context,
        )
        self._db.add(f)
        self._db.commit()
        self._db.refresh(f)
        return f
