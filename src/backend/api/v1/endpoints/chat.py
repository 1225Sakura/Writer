# Auto Novel Writer - Chat Routes
# Interface 1: Chat initialization with ChatAgent integration

import time
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional, Any
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.infrastructure.database import get_db
from backend.core.domain import ChatSession, ChatMessage, ExtractedEntity
from backend.middleware.auth import require_auth
from backend.core.domain.schemas import (
    ChatMessageCreateRequest,
    ChatSessionUpdateRequest,
    ChatMessageResponse,
    ChatSessionResponse,
    ExtractedEntityResponse,
)
from backend.core.services.chat.chat_service import ChatSessionService, ChatMessageService
from backend.agents.chat_agent import ChatAgent
from backend.services.ai.provider import AIProvider
from backend.utils.event_bus import AsyncEventBus

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


# ---------------------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------------------

async def get_chat_session_service(db: AsyncSession = Depends(get_db)) -> ChatSessionService:
    """Dependency to provide ChatSessionService."""
    return ChatSessionService(db)


async def get_chat_message_service(db: AsyncSession = Depends(get_db)) -> ChatMessageService:
    """Dependency to provide ChatMessageService.

    Note: ChatAgent integration requires AIProvider and EventBus.
    In a full setup these would be provided via app state or a DI container.
    For now, the service works without an agent (generic responses).
    """
    return ChatMessageService(db)


# ---------------------------------------------------------------------------
# Session endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/sessions",
    response_model=ChatSessionResponse,
    dependencies=[require_auth],
    summary="创建聊天会话",
    description="创建新的聊天会话，用于收集小说设定。",
)
async def create_session(
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Create a new chat session."""
    session = await service.create()
    return session


@router.get(
    "/sessions",
    response_model=List[ChatSessionResponse],
    dependencies=[require_auth],
    summary="列出所有会话",
    description="获取所有聊天会话的列表，支持分页。",
)
async def list_sessions(
    request: Request,
    skip: int = 0,
    limit: int = 20,
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """List all chat sessions with pagination."""
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip, max_requests=60, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many requests")

    sessions = await service.list_sessions(skip=skip, limit=min(limit, 100))
    return sessions


@router.get(
    "/sessions/{session_id}",
    response_model=ChatSessionResponse,
    dependencies=[require_auth],
    summary="获取会话详情",
    description="获取指定ID的聊天会话详细信息。",
)
async def get_session(
    session_id: int,
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Get a specific chat session."""
    session = await service.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.patch(
    "/sessions/{session_id}",
    response_model=ChatSessionResponse,
    dependencies=[require_auth],
    summary="更新会话",
    description="更新指定ID的聊天会话的标题或状态。",
)
async def update_session(
    session_id: int,
    req: ChatSessionUpdateRequest,
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Update a chat session's title or status."""
    session = await service.update(
        session_id=session_id,
        title=req.title,
        status=req.status,
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.delete(
    "/sessions/{session_id}",
    dependencies=[require_auth],
    summary="删除会话",
    description="删除指定ID的聊天会话及其所有消息。",
)
async def delete_session(
    session_id: int,
    service: ChatSessionService = Depends(get_chat_session_service),
):
    """Delete a chat session and all its messages."""
    deleted = await service.end(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session deleted"}


# ---------------------------------------------------------------------------
# Message endpoints
# ---------------------------------------------------------------------------

@router.post(
    "/sessions/{session_id}/messages",
    response_model=ChatMessageResponse,
    dependencies=[require_auth],
)
async def create_message(
    request: Request,
    session_id: int,
    message: ChatMessageCreateRequest,
    msg_service: ChatMessageService = Depends(get_chat_message_service),
    session_service: ChatSessionService = Depends(get_chat_session_service),
):
    """Add a message to a chat session.

    This stores the user message. For AI auto-reply, use the
    /sessions/{session_id}/send endpoint.
    """
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip, max_requests=30, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many requests")

    # Verify session exists
    session = await session_service.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    chat_message = await msg_service.send(
        session_id=session_id,
        role=message.role,
        content=message.content,
    )
    return chat_message


@router.get(
    "/sessions/{session_id}/messages",
    response_model=List[ChatMessageResponse],
    dependencies=[require_auth],
)
async def get_messages(
    session_id: int,
    skip: int = 0,
    limit: int = 100,
    msg_service: ChatMessageService = Depends(get_chat_message_service),
    session_service: ChatSessionService = Depends(get_chat_session_service),
):
    """Get all messages for a chat session."""
    # Verify session exists
    session = await session_service.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = await msg_service.get_history(session_id, skip=skip, limit=limit)
    return messages


# ---------------------------------------------------------------------------
# AI-powered chat endpoint
# ---------------------------------------------------------------------------

class ChatSendRequest(BaseModel):
    """Request to send a message and get AI reply."""
    model_config = {"json_schema_extra": {
        "example": {
            "content": "我想写一个修仙小说，主角是一个废柴少年",
            "collected_settings": {"genre": "修仙", "protagonist": "废柴少年"},
            "current_category": "genre"
        }
    }}

    content: str = Field(..., description="用户消息内容", max_length=50000)
    collected_settings: Optional[dict[str, Any]] = Field(None, description="已收集的设定信息")
    current_category: str = Field("genre", description="当前收集的设定类别")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Content cannot be empty")
        if len(v) > 50000:
            raise ValueError("Content exceeds maximum length of 50000")
        return v.strip()

    @field_validator("current_category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        valid = {
            "genre", "worldview", "power_system", "protagonist",
            "golden_finger", "villain", "supporting_characters",
            "key_items", "key_locations", "factions", "rules", "plot_direction",
        }
        if v not in valid:
            raise ValueError(f"Invalid category: {v}")
        return v


class ChatSendResponse(BaseModel):
    """Response containing user message, AI reply, and agent metadata."""
    model_config = {"json_schema_extra": {
        "example": {
            "user_message": {"id": 1, "session_id": 1, "role": "user", "content": "我想写一个修仙小说"},
            "ai_message": {"id": 2, "session_id": 1, "role": "assistant", "content": "太好了！请告诉我主角的性格特点？"},
            "agent_result": {"confidence": 0.95, "metadata": {}, "warnings": []}
        }
    }}

    user_message: ChatMessageResponse
    ai_message: ChatMessageResponse
    agent_result: Optional[dict[str, Any]] = None


@router.post(
    "/sessions/{session_id}/send",
    response_model=ChatSendResponse,
    dependencies=[require_auth],
)
async def send_and_reply(
    request: Request,
    session_id: int,
    req: ChatSendRequest,
    msg_service: ChatMessageService = Depends(get_chat_message_service),
    session_service: ChatSessionService = Depends(get_chat_session_service),
):
    """Send a user message and get an AI-generated reply.

    The ChatAgent analyzes the conversation context and decides the
    next optimal question to ask, driving the setting collection process.
    """
    # Rate limiting
    client_ip = request.client.host if request.client else "unknown"
    if not check_rate_limit(client_ip, max_requests=20, window_seconds=60):
        raise HTTPException(status_code=429, detail="Too many requests")

    # Verify session exists
    session = await session_service.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Process message with AI
    result = await msg_service.process_user_message(
        session_id=session_id,
        content=req.content,
        collected_settings=req.collected_settings,
        current_category=req.current_category,
    )

    # Build agent_result dict if available
    agent_result_dict = None
    agent_result = result.get("agent_result")
    if agent_result:
        agent_result_dict = {
            "confidence": agent_result.confidence,
            "metadata": agent_result.metadata,
            "warnings": agent_result.warnings,
            "content": agent_result.content if isinstance(agent_result.content, dict) else str(agent_result.content),
        }

    return ChatSendResponse(
        user_message=result["user_message"],
        ai_message=result["ai_message"],
        agent_result=agent_result_dict,
    )


# ---------------------------------------------------------------------------
# Extracted entity endpoints
# ---------------------------------------------------------------------------

@router.get(
    "/sessions/{session_id}/entities",
    response_model=List[ExtractedEntityResponse],
    dependencies=[require_auth],
)
async def get_extracted_entities(
    session_id: int,
    entity_type: Optional[str] = None,
    confirmed: Optional[bool] = None,
    msg_service: ChatMessageService = Depends(get_chat_message_service),
    session_service: ChatSessionService = Depends(get_chat_session_service),
):
    """Get extracted entities from a chat session."""
    # Verify session exists
    session = await session_service.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    entities = await msg_service.get_extracted_entities(
        session_id=session_id,
        entity_type=entity_type,
        confirmed=confirmed,
    )
    return entities


@router.patch("/entities/{entity_id}/confirm", dependencies=[require_auth])
async def confirm_entity(
    entity_id: int,
    confirmed: bool = True,
    msg_service: ChatMessageService = Depends(get_chat_message_service),
):
    """Confirm or unconfirm an extracted entity."""
    updated = await msg_service.confirm_entity(entity_id, confirmed)
    if not updated:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"message": "Entity updated"}


# ---------------------------------------------------------------------------
# Session summary endpoint
# ---------------------------------------------------------------------------

@router.get("/sessions/{session_id}/summary", dependencies=[require_auth])
async def get_session_summary(
    session_id: int,
    msg_service: ChatMessageService = Depends(get_chat_message_service),
    session_service: ChatSessionService = Depends(get_chat_session_service),
):
    """Get a text summary of all collected settings from a session."""
    session = await session_service.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    summary = await msg_service.generate_summary(session_id)
    return {"session_id": session_id, "summary": summary}
