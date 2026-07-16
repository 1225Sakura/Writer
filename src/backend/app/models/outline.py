"""Outline and Chapter models."""
from __future__ import annotations

from sqlalchemy import String, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import BaseModel
from app.core.constants import ChapterStatus


class Outline(BaseModel):
    __tablename__ = "outlines"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255), default="未命名大纲")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="outlines")
    chapters: Mapped[list["Chapter"]] = relationship(back_populates="outline", cascade="all, delete-orphan")


class Chapter(BaseModel):
    __tablename__ = "chapters"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    outline_id: Mapped[int | None] = mapped_column(ForeignKey("outlines.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), default="未命名章节")
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default=ChapterStatus.PLANNING.value)
    word_count: Mapped[int] = mapped_column(Integer, default=0)
    chapter_order: Mapped[int] = mapped_column(Integer, default=0)
    content: Mapped[str | None] = mapped_column(Text, nullable=True)  # Tiptap JSON/HTML
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    note_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    note_pinned: Mapped[bool] = mapped_column(default=False)
    battle_station_data: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="chapters")
    outline: Mapped["Outline"] = relationship(back_populates="chapters")
    inspections: Mapped[list["AIInspectionResult"]] = relationship(back_populates="chapter", cascade="all, delete-orphan")
    drafts: Mapped[list["Draft"]] = relationship(back_populates="chapter", cascade="all, delete-orphan")
