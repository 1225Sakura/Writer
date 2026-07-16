"""Chat router: 4 endpoints for interface-1 chat-init flow.

Endpoints:
  POST   /api/v1/chat/sessions                  -> 201 create session
  POST   /api/v1/chat/sessions/{id}/messages    -> 200 append message
  POST   /api/v1/chat/sessions/{id}/extract-entities -> 200 AI extraction
  GET    /api/v1/chat/sessions                  -> 200 list sessions
"""
from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.dependencies import get_db
from app.repositories.chat import ChatSessionRepository, ChatMessageRepository
from app.repositories.project import ProjectRepository
from app.schemas.chat import (
    CreateSessionRequest,
    CreateSessionResponse,
    SendMessageRequest,
    SendMessageResponse,
    ExtractEntitiesRequest,
    ExtractEntitiesResponse,
    ListSessionsResponse,
    ChatSessionSummary,
)
from app.schemas.response import ApiResponse
from app.services.chat import ChatService

router = APIRouter(prefix="/chat", tags=["Chat"])


def _get_service(db=Depends(get_db)) -> ChatService:
    return ChatService(
        session_repo=ChatSessionRepository(db),
        message_repo=ChatMessageRepository(db),
        project_repo=ProjectRepository(db),
        user_id="default-user",
    )


@router.post("/sessions")
def create_session(
    data: CreateSessionRequest,
    service: ChatService = Depends(_get_service),
):
    sess = service.create_session(data.project_id)
    payload = CreateSessionResponse(
        sessionId=sess.id,
        userId=sess.user_id,
        projectId=sess.project_id,
        createdAt=sess.created_at.isoformat() if sess.created_at else "",
    ).model_dump()
    return JSONResponse(status_code=201, content={"success": True, "data": payload})


@router.post("/sessions/{session_id}/messages")
def send_message(
    session_id: int,
    data: SendMessageRequest,
    service: ChatService = Depends(_get_service),
):
    msg = service.send_message(session_id, data.role, data.content)
    payload = SendMessageResponse(
        messageId=msg.id,
        sessionId=msg.session_id,
        role=msg.role,
        content=msg.content,
        timestamp=msg.created_at.isoformat() if msg.created_at else "",
    ).model_dump()
    return ApiResponse(data=payload, message="Message stored")


@router.post("/sessions/{session_id}/extract-entities")
def extract_entities(
    session_id: int,
    data: ExtractEntitiesRequest,
    service: ChatService = Depends(_get_service),
):
    entities = service.extract_entities(data.content)
    return ApiResponse(
        data=ExtractEntitiesResponse(entities=entities).model_dump(),
        message=f"Extracted {len(entities)} entities",
    )


@router.get("/sessions")
def list_sessions(service: ChatService = Depends(_get_service)):
    raw = service.list_sessions()
    summaries = [
        ChatSessionSummary(
            id=item["id"],
            projectId=item["project_id"],
            createdAt=item["created_at"] or "",
            lastMessageAt=item["last_message_at"],
            messageCount=item["message_count"],
        ).model_dump()
        for item in raw
    ]
    return ApiResponse(
        data=ListSessionsResponse(sessions=summaries).model_dump(),
    )
