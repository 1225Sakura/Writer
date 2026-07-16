"""Chat models: ChatSession + ChatMessage for interface-1 chat-init flow.

Phase 0 commit 3 (US-003): stores user-driven conversations that the AI
parser scans for 6 entity types before migration to settings.
"""
from __future__ import annotations

from sqlalchemy import String, Text, ForeignKey, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models import BaseModel


class ChatSession(BaseModel):
    __tablename__ = "chat_sessions"

    user_id: Mapped[str] = mapped_column(String(64), default="default-user")
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE")
    )

    messages: Mapped[list["ChatMessage"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at",
    )


class ChatMessage(BaseModel):
    __tablename__ = "chat_messages"

    session_id: Mapped[int] = mapped_column(
        ForeignKey("chat_sessions.id", ondelete="CASCADE")
    )
    role: Mapped[str] = mapped_column(String(20))  # "user" | "assistant" | "system"
    content: Mapped[str] = mapped_column(Text)

    session: Mapped["ChatSession"] = relationship(back_populates="messages")
