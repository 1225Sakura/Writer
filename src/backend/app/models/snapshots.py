"""Snapshot models (Phase 1 Track B.5).

Three tables:
- snapshots: chapter content snapshots (immutable past states)
- snapshot_tags: M2M-style tag table (snapshot_id, tag)
- snapshot_metadata: JSON metadata blob per snapshot (alternative to extending Snapshot)
"""
from __future__ import annotations

from sqlalchemy import String, Text, ForeignKey, Integer, JSON, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import BaseModel


class Snapshot(BaseModel):
    """Immutable snapshot of chapter content at a point in time.

    Snapshots are content-addressed: same content + chapter → same fingerprint.
    """

    __tablename__ = "snapshots"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user", index=True
    )
    chapter_id: Mapped[int] = mapped_column(
        ForeignKey("chapters.id", ondelete="CASCADE"), index=True
    )
    content: Mapped[str] = mapped_column(Text)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    parent_snapshot_id: Mapped[int | None] = mapped_column(
        ForeignKey("snapshots.id", ondelete="SET NULL"), nullable=True
    )
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    fingerprint: Mapped[str] = mapped_column(String(64), index=True)  # sha256
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    tags: Mapped[list["SnapshotTag"]] = relationship(
        back_populates="snapshot", cascade="all, delete-orphan"
    )


class SnapshotTag(BaseModel):
    """Tag attached to a snapshot (free-form label)."""

    __tablename__ = "snapshot_tags"
    __table_args__ = (UniqueConstraint("snapshot_id", "tag", name="uq_snapshot_tag"),)

    snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("snapshots.id", ondelete="CASCADE"), index=True
    )
    tag: Mapped[str] = mapped_column(String(64))

    snapshot: Mapped["Snapshot"] = relationship(back_populates="tags")
