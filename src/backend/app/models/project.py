"""Project model — root entity for multi-novel support (Phase 1: default project id=1)."""
from __future__ import annotations

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import BaseModel


class Project(BaseModel):
    __tablename__ = "projects"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    name: Mapped[str] = mapped_column(String(255), default="我的小说")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    genre: Mapped[str | None] = mapped_column(String(100), nullable=True)

    characters: Mapped[list["Character"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    items: Mapped[list["Item"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    locations: Mapped[list["Location"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    factions: Mapped[list["Faction"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    world_settings: Mapped[list["WorldSetting"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    rules: Mapped[list["Rule"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    outlines: Mapped[list["Outline"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    chapters: Mapped[list["Chapter"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    if_lines: Mapped[list["IFLine"]] = relationship(back_populates="project", cascade="all, delete-orphan")
    writing_settings: Mapped["WritingSettings"] = relationship(back_populates="project", uselist=False, cascade="all, delete-orphan")
