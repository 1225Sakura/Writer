"""IFLine (Interactive Fiction Line) model: alternate story timelines."""
from __future__ import annotations

from sqlalchemy import ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import BaseModel


class IFLine(BaseModel):
    __tablename__ = "if_lines"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user", index=True
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    parent_line_id: Mapped[int | None] = mapped_column(
        ForeignKey("if_lines.id", ondelete="SET NULL"), nullable=True, index=True
    )
    fork_chapter_id: Mapped[int | None] = mapped_column(
        ForeignKey("chapters.id", ondelete="SET NULL"), nullable=True
    )
    content: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    project: Mapped["Project"] = relationship(back_populates="if_lines")
    parent: Mapped["IFLine | None"] = relationship(
        "IFLine", remote_side="IFLine.id", backref="children"
    )
    fork_chapter: Mapped["Chapter | None"] = relationship()
