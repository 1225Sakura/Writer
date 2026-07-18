"""M2 mechanism-tier regression: chat WebSocket endpoint.

Locks in the connect / initial-state / message-broadcast / disconnect contract
of the FastAPI WebSocket endpoint at /ws/chat/{session_id}.

Uses TestClient.websocket_connect (httpx + ASGI in-process) — no real socket,
no port binding.
"""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.main import app
from app.database import get_db
from app.models import Project, WritingSettings


@pytest.fixture
def ws_engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def ws_db(ws_engine):
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ws_engine)
    session = SessionLocal()
    session.add(Project(id=1, name="默认项目"))
    session.flush()
    session.add(WritingSettings(project_id=1))
    session.commit()
    yield session
    session.close()


@pytest.fixture
def client(ws_db, ws_engine):
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=ws_engine)

    def _get_db_override():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _get_db_override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def _create_session(client: TestClient, project_id: int = 1) -> int:
    resp = client.post("/api/v1/chat/sessions", json={"project_id": project_id})
    assert resp.status_code == 201
    return resp.json()["data"]["sessionId"]


def test_ws_connect_sends_initial_state_with_history(client):
    sid = _create_session(client)
    # Seed two messages via REST so the initial state has content
    client.post(
        f"/api/v1/chat/sessions/{sid}/messages",
        json={"role": "user", "content": "第一句"},
    )
    client.post(
        f"/api/v1/chat/sessions/{sid}/messages",
        json={"role": "assistant", "content": "第二句"},
    )

    with client.websocket_connect(f"/ws/chat/{sid}") as ws:
        initial = json.loads(ws.receive_text())
        assert initial["type"] == "session_state"
        assert initial["sessionId"] == sid
        assert initial["projectId"] == 1
        assert len(initial["messages"]) == 2
        assert initial["messages"][0]["content"] == "第一句"
        assert initial["messages"][0]["role"] == "user"
        assert initial["messages"][1]["content"] == "第二句"
        assert initial["messages"][1]["role"] == "assistant"


def test_ws_ping_returns_pong(client):
    sid = _create_session(client)

    with client.websocket_connect(f"/ws/chat/{sid}") as ws:
        ws.receive_text()  # drain session_state
        ws.send_text(json.dumps({"type": "ping"}))
        reply = json.loads(ws.receive_text())
        assert reply["type"] == "pong"


def test_ws_message_persists_and_broadcasts(client):
    sid = _create_session(client)

    with client.websocket_connect(f"/ws/chat/{sid}") as ws:
        ws.receive_text()  # drain session_state
        ws.send_text(json.dumps({"type": "message", "role": "user", "content": "WS写入的内容"}))
        reply = json.loads(ws.receive_text())
        assert reply["type"] == "message"
        assert reply["role"] == "user"
        assert reply["content"] == "WS写入的内容"
        assert reply["sessionId"] == sid
        assert isinstance(reply["messageId"], int)

    # Verify persistence via REST
    listed = client.get("/api/v1/chat/sessions").json()["data"]["sessions"]
    target = next(s for s in listed if s["id"] == sid)
    assert target["messageCount"] == 1


def test_ws_unknown_session_returns_error_and_closes(client):
    with client.websocket_connect("/ws/chat/9999") as ws:
        err = json.loads(ws.receive_text())
        assert err["type"] == "error"
        assert err["code"] == "SESSION_NOT_FOUND"


def test_ws_empty_content_sends_error_frame(client):
    sid = _create_session(client)

    with client.websocket_connect(f"/ws/chat/{sid}") as ws:
        ws.receive_text()  # drain session_state
        ws.send_text(json.dumps({"type": "message", "role": "user", "content": "   "}))
        err = json.loads(ws.receive_text())
        assert err["type"] == "error"
        assert err["code"] == "EMPTY_CONTENT"


def test_ws_unknown_type_returns_error_frame_and_keeps_open(client):
    sid = _create_session(client)

    with client.websocket_connect(f"/ws/chat/{sid}") as ws:
        ws.receive_text()  # drain session_state
        ws.send_text(json.dumps({"type": "bogus"}))
        err = json.loads(ws.receive_text())
        assert err["type"] == "error"
        assert err["code"] == "UNKNOWN_TYPE"

        # Connection still open — verify with a ping/pong round trip
        ws.send_text(json.dumps({"type": "ping"}))
        reply = json.loads(ws.receive_text())
        assert reply["type"] == "pong"


def test_ws_invalid_json_returns_error_frame(client):
    sid = _create_session(client)

    with client.websocket_connect(f"/ws/chat/{sid}") as ws:
        ws.receive_text()  # drain session_state
        ws.send_text("not-json{")
        err = json.loads(ws.receive_text())
        assert err["type"] == "error"
        assert err["code"] == "INVALID_JSON"


def test_ws_typing_echoes_without_persisting(client):
    sid = _create_session(client)

    with client.websocket_connect(f"/ws/chat/{sid}") as ws:
        ws.receive_text()  # drain session_state
        ws.send_text(json.dumps({"type": "typing", "role": "user"}))
        echo = json.loads(ws.receive_text())
        assert echo["type"] == "typing"
        assert echo["role"] == "user"

    # No new message persisted
    listed = client.get("/api/v1/chat/sessions").json()["data"]["sessions"]
    target = next(s for s in listed if s["id"] == sid)
    assert target["messageCount"] == 0


def test_ws_clean_disconnect(client):
    """Closing the WS context manager must not raise on the server side."""
    sid = _create_session(client)

    with client.websocket_connect(f"/ws/chat/{sid}") as ws:
        ws.receive_text()  # drain initial state
        # Just exit the with-block — simulates client disconnect
    # No assertion needed; success means no exception bubbled through ASGI


def test_ws_happy_reconnect_recovers_history(client):
    """Reconnect after a previous session's messages were persisted returns the full history."""
    sid = _create_session(client)
    client.post(
        f"/api/v1/chat/sessions/{sid}/messages",
        json={"role": "user", "content": "重连前的内容"},
    )

    with client.websocket_connect(f"/ws/chat/{sid}") as ws:
        initial = json.loads(ws.receive_text())
        assert initial["type"] == "session_state"
        assert len(initial["messages"]) == 1
        assert initial["messages"][0]["content"] == "重连前的内容"