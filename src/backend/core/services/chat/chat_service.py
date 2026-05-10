"""Chat session and message management services.

Provides:
- ChatSessionService: session lifecycle (create, get, list, end)
- ChatMessageService: message management (send, get history, mark status)
- Integration with ChatAgent for AI-driven conversation flow
"""

from __future__ import annotations

import logging
from typing import Any
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.repositories.chat.sqlalchemy_repository import (
    SQLAlchemyChatSessionRepository,
    SQLAlchemyChatMessageRepository,
    SQLAlchemyExtractedEntityRepository,
)
from backend.core.domain.entities import ChatSession, ChatMessage, ExtractedEntity
from backend.agents.chat_agent import ChatAgent
from backend.agents.base import AgentContext

logger = logging.getLogger(__name__)


class ChatSessionService:
    """Manage chat session lifecycle."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._session_repo = SQLAlchemyChatSessionRepository(db)

    # ------------------------------------------------------------------
    # Session CRUD
    # ------------------------------------------------------------------

    async def create(self, project_id: int | None = None) -> ChatSession:
        """Create a new chat session."""
        session = await self._session_repo.create({"project_id": project_id})
        logger.info("Created chat session id=%s", session.id)
        return session

    async def get(self, session_id: int) -> ChatSession | None:
        """Get a session by ID with messages eagerly loaded."""
        return await self._session_repo.get_with_messages(session_id)

    async def list_sessions(
        self,
        skip: int = 0,
        limit: int = 20,
        project_id: int | None = None,
    ) -> list[ChatSession]:
        """List chat sessions with pagination."""
        filters = {}
        if project_id is not None:
            filters["project_id"] = project_id
        return await self._session_repo.list(skip=skip, limit=limit, **filters)

    async def end(self, session_id: int) -> bool:
        """End (delete) a chat session and all associated data."""
        session = await self._session_repo.get_by_id(session_id)
        if session is None:
            return False
        deleted = await self._session_repo.delete(session_id)
        if deleted:
            logger.info("Ended chat session id=%s", session_id)
        return deleted

    async def update_timestamp(self, session_id: int) -> None:
        """Update the session's updated_at timestamp."""
        await self._session_repo.update(session_id, {})

    async def update(
        self,
        session_id: int,
        title: str | None = None,
        status: str | None = None,
    ) -> ChatSession | None:
        """Update a chat session's fields."""
        data: dict[str, Any] = {}
        if title is not None:
            data["title"] = title
        if status is not None:
            data["status"] = status
        if not data:
            return await self._session_repo.get_by_id(session_id)
        session = await self._session_repo.update(session_id, data)
        if session:
            logger.info("Updated chat session id=%s", session_id)
        return session


class ChatMessageService:
    """Manage chat messages and AI integration."""

    def __init__(
        self,
        db: AsyncSession,
        agent: ChatAgent | None = None,
    ) -> None:
        self._db = db
        self._agent = agent
        self._session_repo = SQLAlchemyChatSessionRepository(db)
        self._message_repo = SQLAlchemyChatMessageRepository(db)
        self._entity_repo = SQLAlchemyExtractedEntityRepository(db)

    # ------------------------------------------------------------------
    # Message CRUD
    # ------------------------------------------------------------------

    async def send(
        self,
        session_id: int,
        role: str,
        content: str,
    ) -> ChatMessage:
        """Add a message to a chat session."""
        message = await self._message_repo.create({
            "session_id": session_id,
            "role": role,
            "content": content,
        })
        await self._session_repo.update(session_id, {})
        logger.debug("Added message id=%s to session=%s", message.id, session_id)
        return message

    async def get_history(
        self,
        session_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ChatMessage]:
        """Get message history for a session (oldest first)."""
        return await self._message_repo.get_by_session(session_id, skip=skip, limit=limit)

    async def get_message(self, message_id: int) -> ChatMessage | None:
        """Get a single message by ID."""
        return await self._message_repo.get_by_id(message_id)

    # ------------------------------------------------------------------
    # AI Integration
    # ------------------------------------------------------------------

    async def process_user_message(
        self,
        session_id: int,
        content: str,
        collected_settings: dict[str, Any] | None = None,
        current_category: str = "genre",
    ) -> dict[str, Any]:
        """Process a user message and generate an AI response."""
        # Store user message
        user_message = await self.send(session_id, "user", content)

        if self._agent is None:
            ai_content = "收到，请继续告诉我更多关于您小说的设定。"
            ai_message = await self.send(session_id, "assistant", ai_content)
            return {
                "user_message": user_message,
                "ai_message": ai_message,
                "agent_result": None,
            }

        # Get conversation history for context
        history = await self._get_history_for_agent(session_id)

        # Build agent context
        agent_context = AgentContext(
            task="Collect novel settings through conversation",
            settings={
                "collected_settings": collected_settings or {},
                "current_category": current_category,
            },
            history=history,
        )

        # Run agent
        agent_result = await self._agent.execute(agent_context)

        # Extract the AI's next question from the result
        result_content = agent_result.content
        if isinstance(result_content, dict):
            ai_content = result_content.get(
                "next_question",
                "请告诉我更多关于您小说的设定。",
            )
        else:
            ai_content = str(result_content)

        # Store AI response
        ai_message = await self.send(session_id, "assistant", ai_content)

        return {
            "user_message": user_message,
            "ai_message": ai_message,
            "agent_result": agent_result,
        }

    async def generate_summary(self, session_id: int) -> str:
        """Generate a summary of all collected settings from a session."""
        entities = await self._entity_repo.get_by_session(session_id)
        if not entities:
            return "尚未收集任何设定信息。"

        lines = ["=== 已收集设定汇总 ===", ""]
        by_type: dict[str, list[ExtractedEntity]] = {}
        for entity in entities:
            by_type.setdefault(entity.type, []).append(entity)

        for entity_type, items in sorted(by_type.items()):
            lines.append(f"【{entity_type}】")
            for item in items:
                lines.append(f"  - {item.name}")
                if item.description:
                    lines.append(f"    {item.description}")
            lines.append("")

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Extracted Entity Management
    # ------------------------------------------------------------------

    async def extract_entity(
        self,
        session_id: int,
        entity_type: str,
        name: str,
        description: str | None = None,
    ) -> ExtractedEntity:
        """Record an extracted entity from the conversation."""
        return await self._entity_repo.create({
            "session_id": session_id,
            "type": entity_type,
            "name": name,
            "description": description,
            "confirmed": False,
        })

    async def get_extracted_entities(
        self,
        session_id: int,
        entity_type: str | None = None,
        confirmed: bool | None = None,
    ) -> list[ExtractedEntity]:
        """Get extracted entities for a session."""
        filters: dict[str, Any] = {}
        if entity_type is not None:
            filters["entity_type"] = entity_type
        if confirmed is not None:
            filters["confirmed"] = confirmed
        return await self._entity_repo.get_by_session(session_id, **filters)

    async def confirm_entity(self, entity_id: int, confirmed: bool = True) -> bool:
        """Update an entity's confirmation status."""
        entity = await self._entity_repo.update(entity_id, {"confirmed": 1 if confirmed else 0})
        return entity is not None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _get_history_for_agent(
        self,
        session_id: int,
        limit: int = 20,
    ) -> list[dict[str, Any]]:
        """Get message history formatted for AgentContext."""
        messages = await self.get_history(session_id, limit=limit)
        return [
            {"role": msg.role, "content": msg.content}
            for msg in messages
        ]
