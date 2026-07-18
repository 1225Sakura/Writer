"""Phase 0 commit 6 — Item / Location / Character test coverage.

Per AC-P0-6.1 / AC-P0-6.2 / AC-P0-6.3:
- 3 models × 4 CRUD operations = 12 main path tests
- Exception paths: get / update / delete on nonexistent ids (404)
- Performance smoke: per-operation CRUD < 100ms (lists of 100 entities)
- Integration tests: HTTP API round-trip + DB state verification

No production code is modified (already in app/routers/settings_entities.py).

Existing per-model suites (tests/test_item.py, test_location.py, test_character.py)
keep their edge / pagination / isolation coverage. This file consolidates the
AC-required contract in one place so the commit boundary is auditable.
"""
from __future__ import annotations

import time
import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.repositories.character import CharacterRepository
from app.repositories.item import ItemRepository
from app.repositories.location import LocationRepository
from app.schemas.character import CharacterCreate, CharacterUpdate
from app.schemas.settings_entities import (
    ItemCreate,
    ItemUpdate,
    LocationCreate,
    LocationUpdate,
)
from app.services.character import CharacterService
from app.services.item import ItemService
from app.services.location import LocationService


# ---------------------------------------------------------------------------
# Integration-test client fixture with StaticPool
#
# The default conftest.py engine uses QueuePool which gives SQLite :memory:
# a fresh database per connection, so HTTP POST → refresh-after-commit
# fails ("no such table: items"). The fork-test pattern (tests/test_outline_fork.py)
# uses StaticPool so every connection points at the same in-memory DB. We
# replicate that here for HTTP API round-trip tests.
# ---------------------------------------------------------------------------


@pytest.fixture
def entities_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()

    def override_db():
        try:
            yield session
        finally:
            pass

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client, session
    app.dependency_overrides.clear()
    session.close()
    engine.dispose()


# ---------------------------------------------------------------------------
# Service-layer unit tests (3 models × 4 CRUD = 12 main path cases)
# ---------------------------------------------------------------------------


def test_item_crud_lifecycle(db_session):
    """Item: create → get → update → delete happy path."""
    svc = ItemService(ItemRepository(db_session))
    item = svc.create(ItemCreate(name="玄铁剑", project_id=1), project_id=1)
    assert item.id is not None and item.name == "玄铁剑"

    fetched = svc.get(item.id)
    assert fetched is not None and fetched.id == item.id

    updated = svc.update(item.id, ItemUpdate(description="一柄短剑"))
    assert updated is not None and updated.description == "一柄短剑"

    assert svc.delete(item.id) is True
    assert svc.get(item.id) is None


def test_item_crud_under_100ms(db_session):
    """Item: single CRUD operation completes in under 100ms (AC-P0-6.2)."""
    svc = ItemService(ItemRepository(db_session))

    started = time.perf_counter()
    item = svc.create(ItemCreate(name="PerfItem", project_id=1), project_id=1)
    create_elapsed = time.perf_counter() - started
    assert create_elapsed < 0.1, f"create took {create_elapsed * 1000:.1f}ms"

    started = time.perf_counter()
    svc.get(item.id)
    read_elapsed = time.perf_counter() - started
    assert read_elapsed < 0.1, f"get took {read_elapsed * 1000:.1f}ms"

    started = time.perf_counter()
    svc.update(item.id, ItemUpdate(description="perf"))
    update_elapsed = time.perf_counter() - started
    assert update_elapsed < 0.1, f"update took {update_elapsed * 1000:.1f}ms"

    started = time.perf_counter()
    svc.delete(item.id)
    delete_elapsed = time.perf_counter() - started
    assert delete_elapsed < 0.1, f"delete took {delete_elapsed * 1000:.1f}ms"


def test_item_exception_paths(db_session):
    """Item: get / update / delete on nonexistent id returns None / False (no raise)."""
    svc = ItemService(ItemRepository(db_session))
    nonexistent_id = 99999

    assert svc.get(nonexistent_id) is None
    assert svc.update(nonexistent_id, ItemUpdate(name="Ghost")) is None
    assert svc.delete(nonexistent_id) is False


def test_location_crud_lifecycle(db_session):
    """Location: create → get → update → delete happy path."""
    svc = LocationService(LocationRepository(db_session))
    loc = svc.create(LocationCreate(name="青云峰", project_id=1), project_id=1)
    assert loc.id is not None and loc.name == "青云峰" and loc.importance == "normal"

    fetched = svc.get(loc.id)
    assert fetched is not None and fetched.id == loc.id

    updated = svc.update(loc.id, LocationUpdate(importance="major"))
    assert updated is not None and updated.importance == "major"

    assert svc.delete(loc.id) is True
    assert svc.get(loc.id) is None


def test_location_crud_under_100ms(db_session):
    """Location: single CRUD operation completes in under 100ms (AC-P0-6.2)."""
    svc = LocationService(LocationRepository(db_session))

    started = time.perf_counter()
    loc = svc.create(LocationCreate(name="PerfLoc", project_id=1), project_id=1)
    create_elapsed = time.perf_counter() - started
    assert create_elapsed < 0.1, f"create took {create_elapsed * 1000:.1f}ms"

    started = time.perf_counter()
    svc.get(loc.id)
    read_elapsed = time.perf_counter() - started
    assert read_elapsed < 0.1, f"get took {read_elapsed * 1000:.1f}ms"

    started = time.perf_counter()
    svc.update(loc.id, LocationUpdate(importance="major"))
    update_elapsed = time.perf_counter() - started
    assert update_elapsed < 0.1, f"update took {update_elapsed * 1000:.1f}ms"

    started = time.perf_counter()
    svc.delete(loc.id)
    delete_elapsed = time.perf_counter() - started
    assert delete_elapsed < 0.1, f"delete took {delete_elapsed * 1000:.1f}ms"


def test_location_exception_paths(db_session):
    """Location: get / update / delete on nonexistent id returns None / False."""
    svc = LocationService(LocationRepository(db_session))
    nonexistent_id = 99999

    assert svc.get(nonexistent_id) is None
    assert svc.update(nonexistent_id, LocationUpdate(name="Ghost")) is None
    assert svc.delete(nonexistent_id) is False


def test_character_crud_lifecycle(db_session):
    """Character: create → get → update → delete happy path."""
    svc = CharacterService(CharacterRepository(db_session))
    char = svc.create(CharacterCreate(project_id=1, name="林远图"))
    assert char.id is not None and char.name == "林远图" and char.tier == "supporting"

    fetched = svc.get(char.id)
    assert fetched is not None and fetched.id == char.id

    updated = svc.update(char.id, CharacterUpdate(description="主角"))
    assert updated is not None and updated.description == "主角"

    assert svc.delete(char.id) is True
    assert svc.get(char.id) is None


def test_character_crud_under_100ms(db_session):
    """Character: single CRUD operation completes in under 100ms (AC-P0-6.2)."""
    svc = CharacterService(CharacterRepository(db_session))

    started = time.perf_counter()
    char = svc.create(CharacterCreate(project_id=1, name="PerfChar"))
    create_elapsed = time.perf_counter() - started
    assert create_elapsed < 0.1, f"create took {create_elapsed * 1000:.1f}ms"

    started = time.perf_counter()
    svc.get(char.id)
    read_elapsed = time.perf_counter() - started
    assert read_elapsed < 0.1, f"get took {read_elapsed * 1000:.1f}ms"

    started = time.perf_counter()
    svc.update(char.id, CharacterUpdate(description="perf"))
    update_elapsed = time.perf_counter() - started
    assert update_elapsed < 0.1, f"update took {update_elapsed * 1000:.1f}ms"

    started = time.perf_counter()
    svc.delete(char.id)
    delete_elapsed = time.perf_counter() - started
    assert delete_elapsed < 0.1, f"delete took {delete_elapsed * 1000:.1f}ms"


def test_character_exception_paths(db_session):
    """Character: get / update / delete on nonexistent id returns None / False."""
    svc = CharacterService(CharacterRepository(db_session))
    nonexistent_id = 99999

    assert svc.get(nonexistent_id) is None
    assert svc.update(nonexistent_id, CharacterUpdate(name="Ghost")) is None
    assert svc.delete(nonexistent_id) is False


# ---------------------------------------------------------------------------
# Performance smoke: list 100 entities per model under 100ms (AC-P0-6.2)
# ---------------------------------------------------------------------------


def test_item_list_100_entities_under_100ms(db_session):
    """Item list of 100 entities completes in under 100ms."""
    svc = ItemService(ItemRepository(db_session))
    for idx in range(100):
        svc.create(ItemCreate(name=f"perf-item-{idx}", project_id=1), project_id=1)

    started = time.perf_counter()
    rows = svc.list(project_id=1)
    elapsed = time.perf_counter() - started

    assert len(rows) == 100
    assert elapsed < 0.1, f"list took {elapsed * 1000:.1f}ms"


def test_location_list_100_entities_under_100ms(db_session):
    """Location list of 100 entities completes in under 100ms."""
    svc = LocationService(LocationRepository(db_session))
    for idx in range(100):
        svc.create(LocationCreate(name=f"perf-loc-{idx}", project_id=1), project_id=1)

    started = time.perf_counter()
    rows = svc.list(project_id=1)
    elapsed = time.perf_counter() - started

    assert len(rows) == 100
    assert elapsed < 0.1, f"list took {elapsed * 1000:.1f}ms"


def test_character_list_100_entities_under_100ms(db_session):
    """Character list of 100 entities completes in under 100ms."""
    svc = CharacterService(CharacterRepository(db_session))
    for idx in range(100):
        svc.create(CharacterCreate(project_id=1, name=f"perf-char-{idx}"))

    started = time.perf_counter()
    rows = svc.list(project_id=1)
    elapsed = time.perf_counter() - started

    assert len(rows) == 100
    assert elapsed < 0.1, f"list took {elapsed * 1000:.1f}ms"


# ---------------------------------------------------------------------------
# Integration tests via FastAPI TestClient (HTTP API + DB state verification)
# ---------------------------------------------------------------------------


def test_item_api_round_trip_and_db_state(entities_client):
    """Item: HTTP API round-trip verifies both response and DB persistence."""
    client, db_session = entities_client

    # Seed a real Project row via the API so FK is satisfied.
    proj_resp = client.post("/api/v1/projects", json={"name": "ItemIntegration"})
    assert proj_resp.status_code == 200
    project_id = proj_resp.json()["data"]["id"]

    unique = f"xuan-tie-jian-{uuid.uuid4().hex[:8]}"
    create_resp = client.post(
        "/api/v1/settings/items",
        json={"project_id": project_id, "name": unique, "description": "duanjian"},
    )
    assert create_resp.status_code == 200
    payload = create_resp.json()
    assert payload["success"] is True
    item_id = payload["data"]["id"]
    assert payload["data"]["name"] == unique
    assert payload["data"]["project_id"] == project_id

    get_resp = client.get(f"/api/v1/settings/items/{item_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["description"] == "duanjian"

    patch_resp = client.patch(
        f"/api/v1/settings/items/{item_id}",
        json={"description": "reforged"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["data"]["description"] == "reforged"

    list_resp = client.get(f"/api/v1/settings/items?project_id={project_id}")
    assert list_resp.status_code == 200
    listed_ids = {row["id"] for row in list_resp.json()["data"]}
    assert item_id in listed_ids

    delete_resp = client.delete(f"/api/v1/settings/items/{item_id}")
    assert delete_resp.status_code == 200

    notfound_resp = client.get(f"/api/v1/settings/items/{item_id}")
    assert notfound_resp.status_code == 404
    assert notfound_resp.json()["error"]["code"] == "NOT_FOUND"

    from app.models import Item

    db_row = db_session.query(Item).filter_by(id=item_id).one_or_none()
    assert db_row is None


def test_location_api_round_trip_and_db_state(entities_client):
    """Location: HTTP API round-trip verifies response + DB persistence."""
    client, db_session = entities_client

    proj_resp = client.post("/api/v1/projects", json={"name": "LocationIntegration"})
    assert proj_resp.status_code == 200
    project_id = proj_resp.json()["data"]["id"]

    unique = f"qing-yun-feng-{uuid.uuid4().hex[:8]}"
    create_resp = client.post(
        "/api/v1/settings/locations",
        json={"project_id": project_id, "name": unique, "importance": "major"},
    )
    assert create_resp.status_code == 200
    loc_id = create_resp.json()["data"]["id"]
    assert create_resp.json()["data"]["importance"] == "major"

    get_resp = client.get(f"/api/v1/settings/locations/{loc_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["name"] == unique

    patch_resp = client.patch(
        f"/api/v1/settings/locations/{loc_id}",
        json={"importance": "core"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["data"]["importance"] == "core"

    delete_resp = client.delete(f"/api/v1/settings/locations/{loc_id}")
    assert delete_resp.status_code == 200

    notfound_resp = client.get(f"/api/v1/settings/locations/{loc_id}")
    assert notfound_resp.status_code == 404


def test_character_api_round_trip_and_db_state(entities_client):
    """Character: HTTP API round-trip verifies response + DB persistence."""
    client, db_session = entities_client

    proj_resp = client.post("/api/v1/projects", json={"name": "CharacterIntegration"})
    assert proj_resp.status_code == 200
    project_id = proj_resp.json()["data"]["id"]

    unique = f"lin-yuan-tu-{uuid.uuid4().hex[:8]}"
    create_resp = client.post(
        "/api/v1/settings/characters",
        json={
            "project_id": project_id,
            "name": unique,
            "gender": "male",
            "tier": "protagonist",
        },
    )
    assert create_resp.status_code == 200
    char_id = create_resp.json()["data"]["id"]
    assert create_resp.json()["data"]["tier"] == "protagonist"
    assert create_resp.json()["data"]["gender"] == "male"

    get_resp = client.get(f"/api/v1/settings/characters/{char_id}")
    assert get_resp.status_code == 200
    assert get_resp.json()["data"]["name"] == unique

    patch_resp = client.patch(
        f"/api/v1/settings/characters/{char_id}",
        json={"description": "updated protagonist", "tier": "deuteragonist"},
    )
    assert patch_resp.status_code == 200
    assert patch_resp.json()["data"]["description"] == "updated protagonist"
    assert patch_resp.json()["data"]["tier"] == "deuteragonist"

    delete_resp = client.delete(f"/api/v1/settings/characters/{char_id}")
    assert delete_resp.status_code == 200

    notfound_resp = client.get(f"/api/v1/settings/characters/{char_id}")
    assert notfound_resp.status_code == 404


def test_settings_api_not_found_for_nonexistent_ids(entities_client):
    """Settings API: 3 endpoints all return 404 for nonexistent ids."""
    client, _ = entities_client
    nonexistent = 99999

    item_resp = client.get(f"/api/v1/settings/items/{nonexistent}")
    assert item_resp.status_code == 404
    assert item_resp.json()["error"]["code"] == "NOT_FOUND"

    loc_resp = client.get(f"/api/v1/settings/locations/{nonexistent}")
    assert loc_resp.status_code == 404
    assert loc_resp.json()["error"]["code"] == "NOT_FOUND"

    char_resp = client.get(f"/api/v1/settings/characters/{nonexistent}")
    assert char_resp.status_code == 404
    assert char_resp.json()["error"]["code"] == "NOT_FOUND"


def test_settings_api_list_filters_by_project(entities_client):
    """Settings API list endpoint filters rows by project_id query parameter."""
    client, db_session = entities_client

    proj_a = client.post("/api/v1/projects", json={"name": "ProjectA"}).json()["data"]
    proj_b = client.post("/api/v1/projects", json={"name": "ProjectB"}).json()["data"]

    a = client.post(
        "/api/v1/settings/items",
        json={"project_id": proj_a["id"], "name": "keep-A"},
    ).json()["data"]
    client.post(
        "/api/v1/settings/items",
        json={"project_id": proj_b["id"], "name": "drop-B"},
    )

    response = client.get(f"/api/v1/settings/items?project_id={proj_a['id']}")
    assert response.status_code == 200
    rows = response.json()["data"]
    assert {row["id"] for row in rows} == {a["id"]}
    assert all(row["project_id"] == proj_a["id"] for row in rows)
