# Auto Novel Writer - Chat Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementations for ChatSession, ChatMessage, ExtractedEntity

from typing import Optional, List
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, asc
from sqlalchemy.orm import selectinload

from backend.core.repositories.chat.interfaces import (
    ChatSessionRepositoryInterface,
    ChatMessageRepositoryInterface,
    ExtractedEntityRepositoryInterface,
)
from backend.core.domain.entities import ChatSession, ChatMessage, ExtractedEntity


class SQLAlchemyChatSessionRepository(ChatSessionRepositoryInterface):
    """SQLAlchemy implementation of ChatSession repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[ChatSession]:
        result = await self.db.execute(
            select(ChatSession).where(ChatSession.id == id)
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> ChatSession:
        instance = ChatSession(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[ChatSession]:
        result = await self.db.execute(
            select(ChatSession).where(ChatSession.id == id)
        )
        session = result.scalar_one_or_none()
        if session is None:
            return None
        for key, value in data.items():
            setattr(session, key, value)
        session.updated_at = datetime.utcnow()
        await self.db.flush()
        await self.db.refresh(session)
        return session

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(
            select(ChatSession).where(ChatSession.id == id)
        )
        session = result.scalar_one_or_none()
        if session is None:
            return False
        await self.db.delete(session)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 20, **filters) -> List[ChatSession]:
        stmt = select(ChatSession).order_by(desc(ChatSession.updated_at))
        for column, value in filters.items():
            if hasattr(ChatSession, column) and value is not None:
                stmt = stmt.where(getattr(ChatSession, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_with_messages(self, id: int) -> Optional[ChatSession]:
        result = await self.db.execute(
            select(ChatSession)
            .where(ChatSession.id == id)
            .options(selectinload(ChatSession.messages))
        )
        return result.scalar_one_or_none()


class SQLAlchemyChatMessageRepository(ChatMessageRepositoryInterface):
    """SQLAlchemy implementation of ChatMessage repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[ChatMessage]:
        result = await self.db.execute(
            select(ChatMessage).where(ChatMessage.id == id)
        )
        return result.scalar_one_or_none()

    async def create(self, data: dict) -> ChatMessage:
        instance = ChatMessage(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def get_by_session(self, session_id: int, skip: int = 0, limit: int = 100) -> List[ChatMessage]:
        result = await self.db.execute(
            select(ChatMessage)
            .where(ChatMessage.session_id == session_id)
            .order_by(asc(ChatMessage.created_at))
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())


class SQLAlchemyExtractedEntityRepository(ExtractedEntityRepositoryInterface):
    """SQLAlchemy implementation of ExtractedEntity repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: dict) -> ExtractedEntity:
        instance = ExtractedEntity(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def get_by_session(self, session_id: int, **filters) -> List[ExtractedEntity]:
        stmt = select(ExtractedEntity).where(
            ExtractedEntity.session_id == session_id
        ).order_by(desc(ExtractedEntity.created_at))
        if "entity_type" in filters and filters["entity_type"] is not None:
            stmt = stmt.where(ExtractedEntity.type == filters["entity_type"])
        if "confirmed" in filters and filters["confirmed"] is not None:
            stmt = stmt.where(ExtractedEntity.confirmed == (1 if filters["confirmed"] else 0))
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def update(self, id: int, data: dict) -> Optional[ExtractedEntity]:
        result = await self.db.execute(
            select(ExtractedEntity).where(ExtractedEntity.id == id)
        )
        entity = result.scalar_one_or_none()
        if entity is None:
            return None
        for key, value in data.items():
            setattr(entity, key, value)
        await self.db.flush()
        await self.db.refresh(entity)
        return entity
