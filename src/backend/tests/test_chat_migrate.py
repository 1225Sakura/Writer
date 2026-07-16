"""US-007 chat → 6 entity migration tests.

Covers:
  * happy path (mock AI returns 6 types, all 6 entity services create OK)
  * partial failure (mock AI returns 1 type whose service raises)
  * all failure (every type's service raises)
  * idempotent re-migration (second call → all skipped)
  * integration: TestClient → real services → row counts in DB

AI extraction is monkeypatched; services use the real in-memory SQLite.
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
from app.services import chat as chat_module


# -- engine fixtures (mirror test_chat.py style) ----------------------------


@pytest.fixture
def migrate_engine():
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    eng.dispose()


@pytest.fixture
def migrate_db(migrate_engine):
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=migrate_engine)
    session = SessionLocal()
    proj = Project(id=1, name="默认项目")
    session.add(proj)
    session.flush()
    session.add(WritingSettings(project_id=proj.id))
    session.commit()
    yield session
    session.close()


# -- direct-service tests (no HTTP) -----------------------------------------


def _build_services(db):
    """Wire a real ChatService with 6 real entity services (no HTTP)."""
    from app.repositories.character import CharacterRepository
    from app.repositories.item import ItemRepository
    from app.repositories.location import LocationRepository
    from app.repositories.faction import FactionRepository
    from app.repositories.world_setting import WorldSettingRepository
    from app.repositories.rule import RuleRepository
    from app.services.character import CharacterService
    from app.services.item import ItemService
    from app.services.location import LocationService
    from app.services.faction import FactionService
    from app.services.world_setting import WorldSettingService
    from app.services.rule import RuleService
    from app.repositories.chat import ChatSessionRepository, ChatMessageRepository
    from app.services.chat import ChatService

    return ChatService(
        session_repo=ChatSessionRepository(db),
        message_repo=ChatMessageRepository(db),
        project_repo=__import__(
            "app.repositories.project", fromlist=["ProjectRepository"]
        ).ProjectRepository(db),
        character_service=CharacterService(CharacterRepository(db)),
        item_service=ItemService(ItemRepository(db)),
        location_service=LocationService(LocationRepository(db)),
        faction_service=FactionService(FactionRepository(db)),
        world_setting_service=WorldSettingService(WorldSettingRepository(db)),
        rule_service=RuleService(RuleRepository(db)),
        user_id="default-user",
    )


def test_migrate_to_settings_happy(migrate_db, monkeypatch):
    """All 6 entity services succeed; AI returns one of each type."""
    chat = _build_services(migrate_db)
    session = chat.create_session(1)
    chat.send_message(session.id, "user", "主角林远图住在九州大陆的青云宗")
    chat.send_message(session.id, "user", "法宝是封印灵根，修炼境界分九重天")

    monkeypatch.setattr(
        chat_module,
        "ai_extract_entities",
        lambda content, **kw: [
            {"type": "character", "name": "林远图", "attrs": {"tier": "protagonist"}},
            {"type": "world", "name": "九州大陆", "attrs": {"category": "geography"}},
            {"type": "item", "name": "封印灵根", "attrs": {}},
            {"type": "location", "name": "青云宗", "attrs": {}},
            {"type": "faction", "name": "青云派", "attrs": {"type": "sect"}},
            {"type": "rule", "name": "九重天", "attrs": {"rule_type": "cultivation"}},
        ],
    )

    result = chat.migrate_to_settings(
        session.id, 1, ["character", "world", "item", "location", "faction", "rule"]
    )

    assert result["partial"] is False
    assert result["errors"] == []
    assert len(result["created"]) == 6
    by_type = {row["type"]: row for row in result["created"]}
    assert {t for t in by_type} == {
        "character", "world", "item", "location", "faction", "rule",
    }
    assert result["skipped"] == []
    # All entities persisted
    for row in result["created"]:
        assert row["id"] is not None
        assert row["name"]


def test_migrate_to_settings_partial_failure(migrate_db, monkeypatch):
    """AI returns 2 types; one service raises. Created has 1, errors has 1."""
    chat = _build_services(migrate_db)
    session = chat.create_session(1)
    chat.send_message(session.id, "user", "some content")

    monkeypatch.setattr(
        chat_module,
        "ai_extract_entities",
        lambda content, **kw: [
            {"type": "character", "name": "A", "attrs": {}},
            {"type": "world", "name": "B", "attrs": {}},
        ],
    )

    # Patch WorldSettingService.create to raise.
    from app.services.world_setting import WorldSettingService

    original_create = WorldSettingService.create

    def _raise(self, data, *, project_id=None):  # noqa: ARG001
        raise RuntimeError("forced world-setting failure")

    monkeypatch.setattr(WorldSettingService, "create", _raise)

    result = chat.migrate_to_settings(session.id, 1, ["character", "world"])

    assert result["partial"] is True
    assert len(result["errors"]) == 1
    assert result["errors"][0]["type"] == "world"
    assert result["errors"][0]["name"] == "B"
    assert "forced world-setting failure" in result["errors"][0]["error"]
    assert len(result["created"]) == 1
    assert result["created"][0]["type"] == "character"
    assert result["created"][0]["name"] == "A"
    # Original behavior restored after test (monkeypatch).
    _ = original_create


def test_migrate_to_settings_all_failure(migrate_db, monkeypatch):
    """All services raise → empty created, populated errors, partial=True."""
    chat = _build_services(migrate_db)
    session = chat.create_session(1)
    chat.send_message(session.id, "user", "some content")

    monkeypatch.setattr(
        chat_module,
        "ai_extract_entities",
        lambda content, **kw: [
            {"type": "character", "name": "A", "attrs": {}},
            {"type": "world", "name": "B", "attrs": {}},
        ],
    )

    from app.services.character import CharacterService
    from app.services.world_setting import WorldSettingService

    def _boom(self, *args, **kwargs):  # noqa: ARG001
        raise RuntimeError("kaboom")

    monkeypatch.setattr(CharacterService, "create", _boom)
    monkeypatch.setattr(WorldSettingService, "create", _boom)

    result = chat.migrate_to_settings(session.id, 1, ["character", "world"])

    assert result["partial"] is True
    assert result["created"] == []
    assert len(result["errors"]) == 2
    assert {e["type"] for e in result["errors"]} == {"character", "world"}


def test_migrate_to_settings_idempotent(migrate_db, monkeypatch):
    """Second migration of the same session → entities fall into skipped."""
    chat = _build_services(migrate_db)
    session = chat.create_session(1)
    chat.send_message(session.id, "user", "some content")

    monkeypatch.setattr(
        chat_module,
        "ai_extract_entities",
        lambda content, **kw: [
            {"type": "character", "name": "林远图", "attrs": {"tier": "protagonist"}},
            {"type": "world", "name": "九州大陆", "attrs": {}},
        ],
    )

    first = chat.migrate_to_settings(session.id, 1, ["character", "world"])
    assert len(first["created"]) == 2
    assert first["skipped"] == []

    second = chat.migrate_to_settings(session.id, 1, ["character", "world"])
    assert second["created"] == []
    assert len(second["skipped"]) == 2
    assert {s["type"] for s in second["skipped"]} == {"character", "world"}
    assert all(s["reason"] == "already_exists" for s in second["skipped"])
    assert second["partial"] is False


# -- HTTP-level integration (via TestClient + dependency_overrides) ----------


@pytest.fixture
def migrate_client(migrate_engine, migrate_db, monkeypatch):
    monkeypatch.setattr(
        chat_module,
        "ai_extract_entities",
        lambda content, **kw: [
            {"type": "character", "name": "林远图", "attrs": {"tier": "protagonist"}},
            {"type": "world", "name": "九州大陆", "attrs": {}},
            {"type": "item", "name": "封印灵根", "attrs": {}},
            {"type": "location", "name": "青云宗", "attrs": {}},
            {"type": "faction", "name": "青云派", "attrs": {"type": "sect"}},
            {"type": "rule", "name": "九重天", "attrs": {"rule_type": "cultivation"}},
        ],
    )

    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=migrate_engine)

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


def test_migrate_http_200_creates_six_rows(migrate_client):
    s = migrate_client.post(
        "/api/v1/chat/sessions", json={"project_id": 1}
    ).json()["data"]
    sid = s["sessionId"]
    migrate_client.post(
        f"/api/v1/chat/sessions/{sid}/messages",
        json={"role": "user", "content": "some user text"},
    )

    resp = migrate_client.post(
        f"/api/v1/chat/sessions/{sid}/migrate-to-settings",
        json={
            "project_id": 1,
            "target_categories": [
                "character", "world", "item", "location", "faction", "rule",
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["success"] is True
    data = body["data"]
    assert len(data["created"]) == 6
    assert data["partial"] is False
    assert data["errors"] == []

    # Verify rows landed in the DB via list endpoints.
    chars = migrate_client.get("/api/v1/settings/characters?project_id=1").json()["data"]
    worlds = migrate_client.get("/api/v1/settings/world-settings?project_id=1").json()["data"]
    items = migrate_client.get("/api/v1/settings/items?project_id=1").json()["data"]
    locs = migrate_client.get("/api/v1/settings/locations?project_id=1").json()["data"]
    factions = migrate_client.get("/api/v1/settings/factions?project_id=1").json()["data"]
    rules = migrate_client.get("/api/v1/settings/rules?project_id=1").json()["data"]
    assert len(chars) == 1 and chars[0]["name"] == "林远图"
    assert len(worlds) == 1 and worlds[0]["name"] == "九州大陆"
    assert len(items) == 1 and items[0]["name"] == "封印灵根"
    assert len(locs) == 1 and locs[0]["name"] == "青云宗"
    assert len(factions) == 1 and factions[0]["name"] == "青云派"
    assert len(rules) == 1 and rules[0]["name"] == "九重天"


def test_migrate_under_30s_mocked(migrate_client):
    s = migrate_client.post(
        "/api/v1/chat/sessions", json={"project_id": 1}
    ).json()["data"]
    sid = s["sessionId"]
    migrate_client.post(
        f"/api/v1/chat/sessions/{sid}/messages",
        json={"role": "user", "content": "perf smoke content"},
    )
    start = time.monotonic()
    resp = migrate_client.post(
        f"/api/v1/chat/sessions/{sid}/migrate-to-settings",
        json={
            "project_id": 1,
            "target_categories": ["character", "world"],
        },
    )
    elapsed = time.monotonic() - start
    assert resp.status_code == 200
    assert elapsed < 30.0