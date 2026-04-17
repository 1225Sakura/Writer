# Auto Novel Writer - Chat Routes
# Interface 1: Chat initialization

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, field_validator
from typing import List, Optional
from datetime import datetime
import re

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.models.entities import ChatSession, ChatMessage, ExtractedEntity

router = APIRouter(prefix="/chat", tags=["chat"])

# Simple in-memory rate limiting (for production use Redis)
rate_limit_store: dict[str, list[float]] = {}

def check_rate_limit(client_ip: str, max_requests: int = 30, window_seconds: float = 60.0) -> bool:
    """Check if client exceeds rate limit. Returns True if allowed."""
    now = time.time()
    if client_ip not in rate_limit_store:
        rate_limit_store[client_ip] = []

    # Remove old requests outside the window
    rate_limit_store[client_ip] = [
        t for t in rate_limit_store[client_ip]
        if now - t < window_seconds
    ]

    if len(rate_limit_store[client_ip]) >= max_requests:
        return False

    rate_limit_store[client_ip].append(now)
    return True

import time

# Pydantic models
class ChatMessageCreate(BaseModel):
    role: str
    content: str

    @field_validator('role')
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in ('user', 'assistant', 'system'):
            raise ValueError('Role must be user, assistant, or system')
        return v

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        if len(v) > 50000:  # Max 50k characters per message
            raise ValueError('Content exceeds maximum length')
        return v.strip()


class ChatMessageResponse(BaseModel):
    id: int
    session_id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionCreate(BaseModel):
    pass


class ChatSessionResponse(BaseModel):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExtractedEntityResponse(BaseModel):
    id: int
    session_id: int
    type: str
    name: str
    description: Optional[str]
    confirmed: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Endpoints
@router.post("/sessions", response_model=ChatSessionResponse)
async def create_session(db: AsyncSession = Depends(get_db)):
    """Create a new chat session."""
    session = ChatSession()
    db.add(session)
    await db.flush()
    await db.refresh(session)
    return session


@router.get("/sessions", response_model=List[ChatSessionResponse])
async def list_sessions(
    request: Request,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """List all chat sessions with pagination."""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip, max_requests=60, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many requests")

    result = await db.execute(
        select(ChatSession)
        .order_by(ChatSession.updated_at.desc())
        .offset(skip)
        .limit(min(limit, 100))  # Cap at 100
    )
    sessions = result.scalars().all()
    return sessions


@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
async def get_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific chat session."""
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete("/sessions/{session_id}")
async def delete_session(session_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a chat session and all its messages."""
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    await db.delete(session)
    return {"message": "Session deleted"}


@router.post("/sessions/{session_id}/messages", response_model=ChatMessageResponse)
async def create_message(
    request: Request,
    session_id: int,
    message: ChatMessageCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add a message to a chat session."""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip, max_requests=30, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many requests")

    # Verify session exists
    result = await db.execute(select(ChatSession).where(ChatSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    chat_message = ChatMessage(
        session_id=session_id,
        role=message.role,
        content=message.content
    )
    db.add(chat_message)

    # Update session timestamp
    session.updated_at = datetime.utcnow()

    await db.flush()
    await db.refresh(chat_message)
    return chat_message


@router.get("/sessions/{session_id}/messages", response_model=List[ChatMessageResponse])
async def get_messages(
    session_id: int,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """Get all messages for a chat session."""
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.asc())
        .offset(skip)
        .limit(limit)
    )
    messages = result.scalars().all()
    return messages


@router.get("/sessions/{session_id}/entities", response_model=List[ExtractedEntityResponse])
async def get_extracted_entities(
    session_id: int,
    type: Optional[str] = None,
    confirmed: Optional[bool] = None,
    db: AsyncSession = Depends(get_db)
):
    """Get extracted entities from a chat session."""
    query = select(ExtractedEntity).where(ExtractedEntity.session_id == session_id)

    if type is not None:
        query = query.where(ExtractedEntity.type == type)
    if confirmed is not None:
        query = query.where(ExtractedEntity.confirmed == (1 if confirmed else 0))

    result = await db.execute(query.order_by(ExtractedEntity.created_at.desc()))
    entities = result.scalars().all()
    return entities


@router.patch("/entities/{entity_id}/confirm")
async def confirm_entity(
    entity_id: int,
    confirmed: bool = True,
    db: AsyncSession = Depends(get_db)
):
    """Confirm or unconfirm an extracted entity."""
    result = await db.execute(select(ExtractedEntity).where(ExtractedEntity.id == entity_id))
    entity = result.scalar_one_or_none()
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")

    entity.confirmed = 1 if confirmed else 0
    await db.flush()
    return {"message": "Entity updated"}
