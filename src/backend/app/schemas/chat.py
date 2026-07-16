"""Chat request/response schemas for interface-1 endpoints."""
from __future__ import annotations

from app.schemas.base import BaseSchema, TimestampSchema


class CreateSessionRequest(BaseSchema):
    project_id: int


class CreateSessionResponse(BaseSchema):
    sessionId: int
    userId: str
    projectId: int
    createdAt: str


class SendMessageRequest(BaseSchema):
    role: str  # "user" | "assistant" | "system"
    content: str


class SendMessageResponse(BaseSchema):
    messageId: int
    sessionId: int
    role: str
    content: str
    timestamp: str


class ExtractedEntity(BaseSchema):
    type: str  # "world" | "character" | "item" | "location" | "faction" | "rule"
    name: str
    attrs: dict = {}


class ExtractEntitiesRequest(BaseSchema):
    content: str


class ExtractEntitiesResponse(BaseSchema):
    entities: list[ExtractedEntity]


class ChatSessionSummary(BaseSchema):
    id: int
    projectId: int
    createdAt: str
    lastMessageAt: str | None = None
    messageCount: int = 0


class ListSessionsResponse(BaseSchema):
    sessions: list[ChatSessionSummary]


__all__ = [
    "CreateSessionRequest",
    "CreateSessionResponse",
    "SendMessageRequest",
    "SendMessageResponse",
    "ExtractedEntity",
    "ExtractEntitiesRequest",
    "ExtractEntitiesResponse",
    "ChatSessionSummary",
    "ListSessionsResponse",
]
