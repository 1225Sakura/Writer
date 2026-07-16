"""ChatService: business logic for ChatSession/ChatMessage + AI extraction."""
from __future__ import annotations

from datetime import datetime, timezone

from app.core.exceptions import NotFoundException, ValidationException
from app.models import ChatSession, ChatMessage, Project
from app.repositories.chat import ChatSessionRepository, ChatMessageRepository
from app.repositories.project import ProjectRepository
from app.schemas.chat import ExtractedEntity
from app.services.ai_chat import extract_entities as ai_extract_entities


class ChatService:
    def __init__(
        self,
        session_repo: ChatSessionRepository,
        message_repo: ChatMessageRepository,
        project_repo: ProjectRepository,
        user_id: str = "default-user",
    ):
        self._sessions = session_repo
        self._messages = message_repo
        self._projects = project_repo
        self._user_id = user_id

    def create_session(self, project_id: int) -> ChatSession:
        project = self._projects.get(project_id)
        if not project:
            raise NotFoundException("Project", project_id)
        session = ChatSession(project_id=project_id, user_id=self._user_id)
        return self._sessions.create(session)

    def send_message(self, session_id: int, role: str, content: str) -> ChatMessage:
        if not content.strip():
            raise ValidationException("content must be non-empty")
        session = self._sessions.get(session_id)
        if not session:
            raise NotFoundException("ChatSession", session_id)
        if role not in {"user", "assistant", "system"}:
            raise ValidationException(f"invalid role: {role}")
        message = ChatMessage(session_id=session_id, role=role, content=content)
        # Touch parent updated_at so list_for_user ordering surfaces new activity.
        session.updated_at = datetime.now(timezone.utc).replace(tzinfo=None)
        self._sessions._db.add(session)
        self._sessions._db.commit()
        return self._messages.create(message)

    def list_sessions(self, user_id: str | None = None) -> list[dict]:
        target_user = user_id or self._user_id
        sessions = self._sessions.list_for_user(target_user)
        out: list[dict] = []
        for sess in sessions:
            message_count = self._messages.count_for_session(sess.id)
            last_at = self._messages.last_message_at_for_session(sess.id)
            out.append(
                {
                    "id": sess.id,
                    "project_id": sess.project_id,
                    "created_at": sess.created_at.isoformat()
                    if sess.created_at
                    else None,
                    "last_message_at": last_at.isoformat() if last_at else None,
                    "message_count": message_count,
                }
            )
        return out

    def extract_entities(self, content: str) -> list[ExtractedEntity]:
        if not content.strip():
            raise ValidationException("content must be non-empty for entity extraction")
        raw = ai_extract_entities(content)
        return [
            ExtractedEntity(
                type=str(item.get("type", "world")),
                name=str(item.get("name", "")),
                attrs=dict(item.get("attrs") or {}),
            )
            for item in raw
            if item.get("name")
        ]
