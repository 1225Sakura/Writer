"""Chat repositories: typed DB access for ChatSession + ChatMessage."""
from __future__ import annotations

from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import ChatSession, ChatMessage


class ChatSessionRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[ChatSession]:
        return self._db.query(ChatSession).filter(ChatSession.id == id).first()

    def list_for_user(
        self, user_id: str, skip: int = 0, limit: int = 100
    ) -> list[ChatSession]:
        return (
            self._db.query(ChatSession)
            .filter(ChatSession.user_id == user_id)
            .order_by(ChatSession.updated_at.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create(self, session: ChatSession) -> ChatSession:
        self._db.add(session)
        self._db.commit()
        self._db.refresh(session)
        return session

    def delete(self, id: int) -> bool:
        sess = self.get(id)
        if not sess:
            return False
        self._db.delete(sess)
        self._db.commit()
        return True


class ChatMessageRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[ChatMessage]:
        return self._db.query(ChatMessage).filter(ChatMessage.id == id).first()

    def list_for_session(self, session_id: int) -> list[ChatMessage]:
        return (
            self._db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
            .all()
        )

    def count_for_session(self, session_id: int) -> int:
        return (
            self._db.query(func.count(ChatMessage.id))
            .filter(ChatMessage.session_id == session_id)
            .scalar()
            or 0
        )

    def last_message_at_for_session(self, session_id: int):
        from sqlalchemy import select

        stmt = select(func.max(ChatMessage.created_at)).where(
            ChatMessage.session_id == session_id
        )
        return self._db.execute(stmt).scalar()

    def create(self, message: ChatMessage) -> ChatMessage:
        self._db.add(message)
        self._db.commit()
        self._db.refresh(message)
        return message
