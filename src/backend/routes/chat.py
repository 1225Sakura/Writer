# Auto Novel Writer - Chat Routes
# Interface 1: Chat initialization

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.database import get_db
from backend.models.entities import ChatSession, ChatMessage, ExtractedEntity

router = APIRouter(prefix="/chat", tags=["chat"])


# Pydantic models
class ChatMessageCreate(BaseModel):
    role: str
    content: str


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
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """List all chat sessions with pagination."""
    result = await db.execute(
        select(ChatSession)
        .order_by(ChatSession.updated_at.desc())
        .offset(skip)
        .limit(limit)
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
    session_id: int,
    message: ChatMessageCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add a message to a chat session."""
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
