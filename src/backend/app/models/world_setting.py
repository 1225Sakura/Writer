"""World-setting model."""
from __future__ import annotations

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import BaseModel


class WorldSetting(BaseModel):
    __tablename__ = "world_settings"

    user_id: Mapped[str] = mapped_column(
        String(64), default="default-user", nullable=False, index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="world_settings")
