"""Pacing models (Phase 1 Track B.3).

Two tables:
- pacing_curves: per-chapter pacing curve (sequence of intensity buckets)
- recommendations: actionable pacing recommendations (apply-able per chapter)
"""
from __future__ import annotations

from sqlalchemy import String, Text, ForeignKey, Integer, Float, JSON, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.models import BaseModel


class PacingCurve(BaseModel):
    """Per-chapter pacing curve data.

    `curve_data` is JSON: list of {position, intensity, label} buckets.
    Only one row per chapter (latest wins via upsert).
    """

    __tablename__ = "pacing_curves"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapters.id", ondelete="CASCADE"), index=True
    )
    curve_data: Mapped[list] = mapped_column(JSON, default=list)
    avg_intensity: Mapped[float] = mapped_column(Float, default=0.5)
    variance: Mapped[float] = mapped_column(Float, default=0.0)


class Recommendation(BaseModel):
    """Actionable pacing recommendation for a chapter."""

    __tablename__ = "recommendations"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapters.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), default="general")
    priority: Mapped[int] = mapped_column(Integer, default=5)  # 1=high, 10=low
    applied: Mapped[bool] = mapped_column(Boolean, default=False)
