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
from sqlalchemy import select, desc, asc
from sqlalchemy.orm import selectinload

from ..models.entities import ChatSession, ChatMessage, ExtractedEntity
from ..agents.chat_agent import ChatAgent
from ..agents.base import AgentContext

logger = logging.getLogger(__name__)


class ChatSessionService:
    """Manage chat session lifecycle."""

    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    # ------------------------------------------------------------------
    # Session CRUD
    # ------------------------------------------------------------------

    async def create(self, project_id: int | None = None) -> ChatSession:
        """Create a new chat session.

        Args:
            project_id: Optional project to associate with the session.

        Returns:
            The newly created ChatSession.
        """
        session = ChatSession(project_id=project_id)
        self._db.add(session)
        await self._db.flush()
        await self._db.refresh(session)
        logger.info("Created chat session id=%s", session.id)
        return session

    async def get(self, session_id: int) -> ChatSession | None:
        """Get a session by ID.

        Args:
            session_id: The session ID.

        Returns:
            The ChatSession or None if not found.
        """
        result = await self._db.execute(
            select(ChatSession)
            .where(ChatSession.id == session_id)
            .options(selectinload(ChatSession.messages))
        )
        return result.scalar_one_or_none()

    async def list_sessions(
        self,
        skip: int = 0,
        limit: int = 20,
        project_id: int | None = None,
    ) -> list[ChatSession]:
        """List chat sessions with pagination.

        Args:
            skip: Number of sessions to skip.
            limit: Maximum number of sessions to return.
            project_id: Optional filter by project.

        Returns:
            List of ChatSession objects.
        """
        query = select(ChatSession).order_by(desc(ChatSession.updated_at))
        if project_id is not None:
            query = query.where(ChatSession.project_id == project_id)

        result = await self._db.execute(query.offset(skip).limit(limit))
        return list(result.scalars().all())

    async def end(self, session_id: int) -> bool:
        """End (delete) a chat session and all associated data.

        Args:
            session_id: The session ID to delete.

        Returns:
            True if deleted, False if not found.
        """
        session = await self.get(session_id)
        if session is None:
            return False

        await self._db.delete(session)
        logger.info("Ended chat session id=%s", session_id)
        return True

    async def update_timestamp(self, session_id: int) -> None:
        """Update the session's updated_at timestamp.

        Args:
            session_id: The session ID.
        """
        session = await self.get(session_id)
        if session:
            session.updated_at = datetime.utcnow()


class ChatMessageService:
    """Manage chat messages and AI integration."""

    def __init__(
        self,
        db: AsyncSession,
        agent: ChatAgent | None = None,
    ) -> None:
        self._db = db
        self._agent = agent

    # ------------------------------------------------------------------
    # Message CRUD
    # ------------------------------------------------------------------

    async def send(
        self,
        session_id: int,
        role: str,
        content: str,
    ) -> ChatMessage:
        """Add a message to a chat session.

        Args:
            session_id: The session ID.
            role: Message role (user, assistant, system).
            content: Message content.

        Returns:
            The created ChatMessage.
        """
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content,
        )
        self._db.add(message)

        # Update session timestamp
        await self._update_session_timestamp(session_id)

        await self._db.flush()
        await self._db.refresh(message)
        logger.debug("Added message id=%s to session=%s", message.id, session_id)
        return message

    async def get_history(
        self,
        session_id: int,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ChatMessage]:
        """Get message history for a session.

        Args:
            session_id: The session ID.
            skip: Number of messages to skip.
            limit: Maximum number of messages to return.

        Returns:
            List of ChatMessage objects, oldest first.
        """
        result = await self._db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(asc(ChatMessage.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_message(self, message_id: int) -> ChatMessage | None:
        """Get a single message by ID.

        Args:
            message_id: The message ID.

        Returns:
            The ChatMessage or None.
        """
        result = await self._db.execute(
            select(ChatMessage).where(ChatMessage.id == message_id)
        )
        return result.scalar_one_or_none()

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
        """Process a user message and generate an AI response.

        This method:
        1. Stores the user message
        2. Runs the ChatAgent to determine the next question
        3. Stores the AI response
        4. Returns both messages + agent metadata

        Args:
            session_id: The session ID.
            content: User's message content.
            collected_settings: Previously collected settings dict.
            current_category: Current setting category being collected.

        Returns:
            Dict with user_message, ai_message, and agent_result.
        """
        # Store user message
        user_message = await self.send(session_id, "user", content)

        if self._agent is None:
            # No agent configured - return a generic response
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
        """Generate a summary of all collected settings from a session.

        Args:
            session_id: The session ID.

        Returns:
            A human-readable summary string.
        """
        entities = await self._get_extracted_entities(session_id)
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
        """Record an extracted entity from the conversation.

        Args:
            session_id: The session ID.
            entity_type: Type of entity (character, location, item, etc.).
            name: Entity name.
            description: Optional description.

        Returns:
            The created ExtractedEntity.
        """
        entity = ExtractedEntity(
            session_id=session_id,
            type=entity_type,
            name=name,
            description=description,
            confirmed=False,
        )
        self._db.add(entity)
        await self._db.flush()
        await self._db.refresh(entity)
        return entity

    async def get_extracted_entities(
        self,
        session_id: int,
        entity_type: str | None = None,
        confirmed: bool | None = None,
    ) -> list[ExtractedEntity]:
        """Get extracted entities for a session.

        Args:
            session_id: The session ID.
            entity_type: Optional filter by type.
            confirmed: Optional filter by confirmation status.

        Returns:
            List of ExtractedEntity objects.
        """
        query = select(ExtractedEntity).where(
            ExtractedEntity.session_id == session_id
        )

        if entity_type is not None:
            query = query.where(ExtractedEntity.type == entity_type)
        if confirmed is not None:
            query = query.where(ExtractedEntity.confirmed == (1 if confirmed else 0))

        result = await self._db.execute(
            query.order_by(desc(ExtractedEntity.created_at))
        )
        return list(result.scalars().all())

    async def confirm_entity(self, entity_id: int, confirmed: bool = True) -> bool:
        """Update an entity's confirmation status.

        Args:
            entity_id: The entity ID.
            confirmed: New confirmation status.

        Returns:
            True if updated, False if not found.
        """
        result = await self._db.execute(
            select(ExtractedEntity).where(ExtractedEntity.id == entity_id)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            return False

        entity.confirmed = 1 if confirmed else 0
        return True

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _update_session_timestamp(self, session_id: int) -> None:
        """Update the parent session's updated_at."""
        result = await self._db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        session = result.scalar_one_or_none()
        if session:
            session.updated_at = datetime.utcnow()

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
