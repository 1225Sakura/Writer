"""Chat WebSocket endpoint for interface-1 real-time session.

Endpoint: ws://<host>:<port>/ws/chat/{session_id}

Provides a duplex channel for live chat UX. The frontend ChatWebSocketClient
(src/frontend/src/api/websocket.ts) connects here on session mount.

Wire protocol:
- Server -> Client: {type: "message", role, content, timestamp, messageId}
- Server -> Client: {type: "session_state", messages: [...], sessionId}
- Server -> Client: {type: "pong"}  (heartbeat response)
- Server -> Client: {type: "error", code, message}
- Client -> Server: {type: "ping"}
- Client -> Server: {type: "message", role, content}  (echoes back to confirm)
- Client -> Server: {type: "typing", role}             (status broadcast, no DB write)

Phase 1.5 M2 (mechanism): real backend WS endpoint. Phase 2 can extend to push
AI-streamed responses (see v3 plan commit 18 — AI log IPC).
"""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.dependencies import get_chat_service, get_db
from app.repositories.chat import ChatMessageRepository, ChatSessionRepository
from app.services.chat import ChatService

router = APIRouter(tags=["Chat WS"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(tzinfo=None).isoformat()


def _session_initial_state(db: Session, session_id: int) -> dict[str, Any]:
    """Build the initial-state payload sent on connect."""
    session_repo = ChatSessionRepository(db)
    message_repo = ChatMessageRepository(db)
    session = session_repo.get(session_id)
    if session is None:
        return {
            "type": "error",
            "code": "SESSION_NOT_FOUND",
            "message": f"session {session_id} not found",
        }
    msgs = message_repo.list_for_session(session_id)
    return {
        "type": "session_state",
        "sessionId": session_id,
        "projectId": session.project_id,
        "messages": [
            {
                "messageId": m.id,
                "role": m.role,
                "content": m.content,
                "timestamp": m.created_at.isoformat() if m.created_at else None,
            }
            for m in msgs
        ],
    }


def _persist_user_message(
    db: Session,
    session_id: int,
    role: str,
    content: str,
) -> dict[str, Any]:
    """Persist a client-sent message to DB and return the broadcast payload."""
    service = ChatService(
        session_repo=ChatSessionRepository(db),
        message_repo=ChatMessageRepository(db),
        project_repo=__import__("app.repositories.project", fromlist=["ProjectRepository"]).ProjectRepository(db),
        user_id="default-user",
    )
    msg = service.send_message(session_id, role, content)
    return {
        "type": "message",
        "messageId": msg.id,
        "sessionId": msg.session_id,
        "role": msg.role,
        "content": msg.content,
        "timestamp": msg.created_at.isoformat() if msg.created_at else _now_iso(),
    }


@router.websocket("/ws/chat/{session_id}")
async def chat_websocket(
    websocket: WebSocket,
    session_id: int,
    db: Session = Depends(get_db),
) -> None:
    """WebSocket endpoint for live chat session.

    Lifecycle:
    1. accept() — confirm handshake
    2. send initial session_state (history) so reconnecting client recovers
    3. loop: receive text frames
       - {"type":"ping"} -> {"type":"pong"}
       - {"type":"message", role, content} -> persist + broadcast back
       - {"type":"typing", role} -> ignore (UX hint, no DB write)
       - unknown -> send error, do not disconnect
    4. WebSocketDisconnect -> clean shutdown
    """
    await websocket.accept()

    # 1. Initial state push
    initial = _session_initial_state(db, session_id)
    if initial.get("type") == "error":
        await websocket.send_text(json.dumps(initial, ensure_ascii=False))
        await websocket.close(code=4404, reason=initial.get("message", "session not found"))
        return
    await websocket.send_text(json.dumps(initial, ensure_ascii=False))

    # 2. Frame loop
    try:
        while True:
            raw = await websocket.receive_text()
            try:
                payload = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_text(
                    json.dumps(
                        {"type": "error", "code": "INVALID_JSON", "message": "frame must be JSON"},
                        ensure_ascii=False,
                    )
                )
                continue

            msg_type = payload.get("type")

            if msg_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            if msg_type == "typing":
                # Status-only UX hint; ack with a typing echo so the client
                # knows the server saw it (cheap, no DB write).
                await websocket.send_text(
                    json.dumps(
                        {
                            "type": "typing",
                            "role": payload.get("role", "user"),
                            "timestamp": _now_iso(),
                        },
                        ensure_ascii=False,
                    )
                )
                continue

            if msg_type == "message":
                role = str(payload.get("role", "user"))
                content = str(payload.get("content", ""))
                if not content.strip():
                    await websocket.send_text(
                        json.dumps(
                            {"type": "error", "code": "EMPTY_CONTENT", "message": "content required"},
                            ensure_ascii=False,
                        )
                    )
                    continue
                try:
                    broadcast = _persist_user_message(db, session_id, role, content)
                except Exception as exc:  # noqa: BLE001 — convert to WS error frame
                    await websocket.send_text(
                        json.dumps(
                            {
                                "type": "error",
                                "code": "PERSIST_FAILED",
                                "message": str(exc) or "failed to persist message",
                            },
                            ensure_ascii=False,
                        )
                    )
                    continue
                await websocket.send_text(json.dumps(broadcast, ensure_ascii=False))
                continue

            # Unknown frame shape — surface error, keep connection
            await websocket.send_text(
                json.dumps(
                    {
                        "type": "error",
                        "code": "UNKNOWN_TYPE",
                        "message": f"unsupported message type: {msg_type!r}",
                    },
                    ensure_ascii=False,
                )
            )
    except WebSocketDisconnect:
        # Client closed connection; nothing to clean up server-side (no per-WS
        # resources beyond the socket itself, which FastAPI reaps).
        return
    except asyncio.CancelledError:
        # Server shutting down; let FastAPI propagate.
        raise