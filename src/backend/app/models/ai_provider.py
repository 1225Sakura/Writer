"""AIProvider and WritingSettings models."""
from __future__ import annotations

from sqlalchemy import String, Text, ForeignKey, Integer, REAL
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import BaseModel


class AIProvider(BaseModel):
    __tablename__ = "ai_providers"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    name: Mapped[str] = mapped_column(String(255))
    api_key_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    base_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    model_name: Mapped[str] = mapped_column(String(255))
    max_tokens: Mapped[int] = mapped_column(Integer, default=4096)
    temperature: Mapped[float] = mapped_column(REAL, default=0.7)
    is_active: Mapped[bool] = mapped_column(default=True)


class WritingSettings(BaseModel):
    __tablename__ = "writing_settings"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), unique=True)
    human_ai_ratio: Mapped[float] = mapped_column(REAL, default=0.5)
    writing_style: Mapped[str] = mapped_column(String(100), default="default")
    target_word_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sprint_data_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="writing_settings")


class AIInspectionResult(BaseModel):
    __tablename__ = "ai_inspection_results"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    chapter_id: Mapped[int] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"))
    inspection_type: Mapped[str] = mapped_column(String(100))
    issues_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    suggestions_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    auto_fixed: Mapped[bool] = mapped_column(default=False)

    chapter: Mapped["Chapter"] = relationship(back_populates="inspections")
