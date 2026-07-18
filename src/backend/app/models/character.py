"""Character, Relationship, Storyline models."""
from __future__ import annotations

from sqlalchemy import String, Text, ForeignKey, Integer, REAL
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import BaseModel


class Character(BaseModel):
    __tablename__ = "characters"

    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="default-user"
    )
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(255))
    gender: Mapped[str | None] = mapped_column(String(50), nullable=True)
    personality: Mapped[str | None] = mapped_column(Text, nullable=True)
    desires: Mapped[str | None] = mapped_column(Text, nullable=True)
    flaws: Mapped[str | None] = mapped_column(Text, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    tier: Mapped[str] = mapped_column(String(50), default="supporting")
    cultivation_realm: Mapped[str | None] = mapped_column(String(100), nullable=True)

    project: Mapped["Project"] = relationship(back_populates="characters")
    relationships: Mapped[list["CharacterRelationship"]] = relationship(
        foreign_keys="[CharacterRelationship.character_id]",
        back_populates="character",
        cascade="all, delete-orphan",
    )
    storylines: Mapped[list["CharacterStoryline"]] = relationship(
        back_populates="character", cascade="all, delete-orphan"
    )


class CharacterRelationship(BaseModel):
    __tablename__ = "character_relationships"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    character_id: Mapped[int] = mapped_column(ForeignKey("characters.id", ondelete="CASCADE"))
    target_id: Mapped[int] = mapped_column(ForeignKey("characters.id", ondelete="CASCADE"))
    type: Mapped[str] = mapped_column(String(50))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    character: Mapped["Character"] = relationship(
        foreign_keys=[character_id], back_populates="relationships"
    )


class CharacterStoryline(BaseModel):
    __tablename__ = "character_storylines"

    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    character_id: Mapped[int] = mapped_column(ForeignKey("characters.id", ondelete="CASCADE"))
    title: Mapped[str] = mapped_column(String(255))
    arc: Mapped[str | None] = mapped_column(Text, nullable=True)
    progress: Mapped[float] = mapped_column(REAL, default=0.0)

    character: Mapped["Character"] = relationship(back_populates="storylines")
