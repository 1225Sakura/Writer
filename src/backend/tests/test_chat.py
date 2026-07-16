"""Chat endpoint tests: 7 unit cases + 1 integration + 1 perf smoke.

Uses an isolated in-memory SQLite engine with StaticPool so the
DB persists across TestClient's worker thread.
AI extraction is patched via monkeypatch to avoid live API calls.
"""
from __future__ import annotations

import time

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient

from app.main import app
from app.database import get_db, Base
from app.models import Project, WritingSettings


# -- isolated chat fixtures (per-test engine so we control seeding) ---------


@pytest.fixture
def chat_engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def chat_db(chat_engine):
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=chat_engine)
    session = SessionLocal()
    # Seed: default project + writing_settings row so chat endpoints have
    # a valid FK target. Mirrors US-002 baseline behavior.
    proj = Project(id=1, name="默认项目")
    session.add(proj)
    session.flush()
    session.add(WritingSettings(project_id=proj.id))
    session.commit()
    yield session
    session.close()


@pytest.fixture
def client(chat_db, chat_engine, monkeypatch):
    # Patch AI extraction to a deterministic stub.
    def _ai_stub(content, **kwargs):
        return [
            {"type": "character", "name": "林远图", "attrs": {"tier": "protagonist"}},
            {"type": "world", "name": "九州大陆", "attrs": {}},
        ]

    monkeypatch.setattr("app.services.chat.ai_extract_entities", _ai_stub)

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=chat_engine)

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


# -- happy paths ------------------------------------------------------------


def test_create_session_201(client):
    resp = client.post("/api/v1/chat/sessions", json={"project_id": 1})
    assert resp.status_code == 201
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["userId"] == "default-user"
    assert body["data"]["projectId"] == 1
    assert body["data"]["sessionId"] >= 1
    assert body["data"]["createdAt"]


def test_create_session_missing_field_422(client):
    """Missing project_id -> FastAPI RequestValidationError -> 422 (default handler,
    since app/core/exceptions.py:validation_exception_handler is not yet wired in main.py)."""
    resp = client.post("/api/v1/chat/sessions", json={})
    assert resp.status_code == 422


def test_send_message_happy(client):
    s = client.post("/api/v1/chat/sessions", json={"project_id": 1}).json()["data"]
    resp = client.post(
        f"/api/v1/chat/sessions/{s['sessionId']}/messages",
        json={"role": "user", "content": "主角叫林远图"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["role"] == "user"
    assert body["data"]["content"] == "主角叫林远图"
    assert body["data"]["timestamp"]


def test_send_message_invalid_session_404(client):
    resp = client.post(
        "/api/v1/chat/sessions/999/messages",
        json={"role": "user", "content": "x"},
    )
    assert resp.status_code == 404


def test_extract_entities_happy(client):
    s = client.post("/api/v1/chat/sessions", json={"project_id": 1}).json()["data"]
    resp = client.post(
        f"/api/v1/chat/sessions/{s['sessionId']}/extract-entities",
        json={"content": "主角叫林远图住在九州大陆"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    types = {e["type"] for e in body["data"]["entities"]}
    assert {"character", "world"}.issubset(types)


def test_extract_entities_empty_content_400(client):
    s = client.post("/api/v1/chat/sessions", json={"project_id": 1}).json()["data"]
    resp = client.post(
        f"/api/v1/chat/sessions/{s['sessionId']}/extract-entities",
        json={"content": ""},
    )
    assert resp.status_code == 400


def test_extract_entities_ai_timeout_504(client, monkeypatch):
    from app.services import ai_chat as ai_chat_module

    def _raise(content, **kw):
        raise ai_chat_module.AIChatTimeout("forced for test")

    monkeypatch.setattr("app.services.chat.ai_extract_entities", _raise)

    s = client.post("/api/v1/chat/sessions", json={"project_id": 1}).json()["data"]
    resp = client.post(
        f"/api/v1/chat/sessions/{s['sessionId']}/extract-entities",
        json={"content": "some content"},
    )
    assert resp.status_code == 504


def test_list_sessions_user_filter(client):
    s1 = client.post("/api/v1/chat/sessions", json={"project_id": 1}).json()["data"]
    s2 = client.post("/api/v1/chat/sessions", json={"project_id": 1}).json()["data"]
    # Append messages so messageCount > 0
    client.post(
        f"/api/v1/chat/sessions/{s1['sessionId']}/messages",
        json={"role": "user", "content": "hi"},
    )

    resp = client.get("/api/v1/chat/sessions")
    assert resp.status_code == 200
    body = resp.json()
    session_ids = {s["id"] for s in body["data"]["sessions"]}
    assert {s1["sessionId"], s2["sessionId"]}.issubset(session_ids)
    by_id = {s["id"]: s for s in body["data"]["sessions"]}
    assert by_id[s1["sessionId"]]["messageCount"] == 1
    assert by_id[s2["sessionId"]]["messageCount"] == 0


# -- integration: full e2e loop --------------------------------------------


def test_chat_full_e2e_loop(client):
    """Project -> Session -> Message -> AI extraction -> List back."""
    s = client.post("/api/v1/chat/sessions", json={"project_id": 1}).json()["data"]
    sid = s["sessionId"]

    m1 = client.post(
        f"/api/v1/chat/sessions/{sid}/messages",
        json={"role": "user", "content": "我的小说设定"},
    ).json()
    assert m1["success"]

    e = client.post(
        f"/api/v1/chat/sessions/{sid}/extract-entities",
        json={"content": "我叫林远图，金手指是九州大陆的封印灵根"},
    ).json()
    assert e["success"]
    assert len(e["data"]["entities"]) >= 1

    listed = client.get("/api/v1/chat/sessions").json()["data"]["sessions"]
    matched = [x for x in listed if x["id"] == sid]
    assert len(matched) == 1
    assert matched[0]["messageCount"] == 1
    assert matched[0]["lastMessageAt"] is not None


# -- perf smoke (mocked) ---------------------------------------------------


def test_extract_entities_under_30s_mocked(client):
    s = client.post("/api/v1/chat/sessions", json={"project_id": 1}).json()["data"]
    start = time.monotonic()
    resp = client.post(
        f"/api/v1/chat/sessions/{s['sessionId']}/extract-entities",
        json={"content": "mock content for timing"},
    )
    elapsed = time.monotonic() - start
    assert resp.status_code == 200
    assert elapsed < 30.0
