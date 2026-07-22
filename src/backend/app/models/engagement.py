"""Engagement models (Phase 1 Track B.2).

Three tables:
- engagement_scores: per-chapter engagement score snapshot
- cool_points: detected "cool points" per chapter (highlight moments)
- fulfillments: narrative payoff markers per chapter
"""
from __future__ import annotations

from sqlalchemy import String, Text, ForeignKey, Integer, Float, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import BaseModel


class EngagementScore(BaseModel):
    """Per-chapter engagement score (one row per chapter, or one per compute)."""

    __tablename__ = "engagement_scores"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapters.id", ondelete="CASCADE"), index=True
    )
    hook_score: Mapped[float] = mapped_column(Float, default=0.0)
    engagement_score: Mapped[float] = mapped_column(Float, default=0.0)
    predicted_retention: Mapped[float] = mapped_column(Float, default=0.0)
    overall_score: Mapped[float] = mapped_column(Float, default=0.0)
    grade: Mapped[str] = mapped_column(String(8), default="N/A")
    factors: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class CoolPoint(BaseModel):
    """Highlighted "cool moment" detected in a chapter."""

    __tablename__ = "cool_points"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapters.id", ondelete="CASCADE"), index=True
    )
    point_type: Mapped[str] = mapped_column(String(50), default="reveal")
    text: Mapped[str] = mapped_column(Text)
    intensity: Mapped[float] = mapped_column(Float, default=0.5)
    position: Mapped[int] = mapped_column(Integer, default=0)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)


class Fulfillment(BaseModel):
    """Narrative payoff / closure marker in a chapter."""

    __tablename__ = "fulfillments"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapters.id", ondelete="CASCADE"), index=True
    )
    size: Mapped[str] = mapped_column(String(20), default="medium")
    text: Mapped[str] = mapped_column(Text)
    position: Mapped[int] = mapped_column(Integer, default=0)
    context: Mapped[str | None] = mapped_column(Text, nullable=True)
