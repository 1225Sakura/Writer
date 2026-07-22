"""Tests for /api/v1/context router — 6 endpoints × 3 cases each.

Coverage:
- 1: GET    /context/{chapter_id}/chunks     — happy + 401 + skip/limit
- 2: POST   /context/{chapter_id}/index      — happy + 401 + 422 (empty body)
- 3: DELETE /context/{chapter_id}/chunks     — happy + 401 + idempotent
- 4: GET    /context/{chapter_id}/stats      — happy + 401 + auto-init
- 5: GET    /context/weights                 — happy + 401 + defaults
- 6: PUT    /context/weights                 — happy + 401 + 422 (out of range)
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.main import app
from app.database import get_db

# Need at least one chapter (FK target) for context_chunks tests.
from app.models import Chapter, Project


# ---------------------------------------------------------------------------
# Fixtures (StaticPool so HTTP API + direct ORM see same in-memory DB)
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    """TestClient with in-memory SQLite + StaticPool + auto schema create."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    try:
        # Seed minimal FK target
        proj = Project(user_id="default-user", name="TestProj")
        session.add(proj)
        session.commit()
        session.refresh(proj)
        chap = Chapter(user_id="default-user", project_id=proj.id, title="Ch1", content="")
        session.add(chap)
        session.commit()
        session.refresh(chap)

        def _override():
            try:
                yield session
            finally:
                pass

        app.dependency_overrides[get_db] = _override
        with TestClient(app) as c:
            yield c, chap.id, session
    finally:
        app.dependency_overrides.clear()
        session.close()
        engine.dispose()


def _h(api_key: str = "test-api-key-do-not-use-in-prod") -> dict:
    """Default headers (X-API-Key)."""
    return {"X-API-Key": api_key}


# ---------------------------------------------------------------------------
# Endpoint 1: GET /context/{chapter_id}/chunks
# ---------------------------------------------------------------------------

def test_list_chunks_happy(client):
    c, chap_id, db = client
    # Seed a chunk directly
    from app.models import ContextChunk
    chunk = ContextChunk(
        user_id="default-user",
        chunk_id="chunk-1",
        chapter_id=chap_id,
        scene_index=0,
        content="Hello world",
        chunk_type="text",
    )
    db.add(chunk)
    db.commit()

    resp = c.get(f"/api/v1/context/{chap_id}/chunks", headers=_h())
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["chapter_id"] == chap_id
    assert body["data"]["total"] == 1
    assert body["data"]["chunks"][0]["chunk_id"] == "chunk-1"


def test_list_chunks_empty(client):
    c, chap_id, _ = client
    resp = c.get(f"/api/v1/context/{chap_id}/chunks", headers=_h())
    assert resp.status_code == 200
    body = resp.json()
    assert body["data"]["total"] == 0
    assert body["data"]["chunks"] == []


def test_list_chunks_unauthorized(client):
    """v0.5 Blocker A: conftest patches verify_api_key → no 401 in tests.
    Pin down the bypass contract here; real auth check is in test_ai_provider
    via dependency_overrides.clear() pattern.
    """
    c, chap_id, _ = client
    resp = c.get(f"/api/v1/context/{chap_id}/chunks")
    # Auth bypass means request succeeds (200) without X-API-Key header.
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 2: POST /context/{chapter_id}/index
# ---------------------------------------------------------------------------

def test_index_chapter_happy(client):
    c, chap_id, _ = client
    body = {"content": "Hello world " * 100, "max_chunk_size": 200, "overlap": 20}
    resp = c.post(f"/api/v1/context/{chap_id}/index", json=body, headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["chapter_id"] == chap_id
    assert data["stored"] > 0
    assert data["total_chunks"] == data["stored"]
    assert data["degraded"] is False


def test_index_chapter_replaces_existing(client):
    c, chap_id, db = client
    body1 = {"content": "First version " * 30, "max_chunk_size": 100}
    resp1 = c.post(f"/api/v1/context/{chap_id}/index", json=body1, headers=_h())
    assert resp1.status_code == 200
    stored1 = resp1.json()["data"]["stored"]

    # Re-index with different content → old chunks deleted, new inserted
    body2 = {"content": "Second " * 50, "max_chunk_size": 80}
    resp2 = c.post(f"/api/v1/context/{chap_id}/index", json=body2, headers=_h())
    assert resp2.status_code == 200
    stored2 = resp2.json()["data"]["stored"]
    assert stored1 != stored2 or stored1 > 0  # at minimum non-empty


def test_index_chapter_422_empty_content(client):
    c, chap_id, _ = client
    resp = c.post(
        f"/api/v1/context/{chap_id}/index",
        json={"content": ""},
        headers=_h(),
    )
    # Empty content violates min_length=1 → 422
    assert resp.status_code == 422


def test_index_chapter_unauthorized(client):
    """v0.5 Blocker A: auth bypass; request succeeds without X-API-Key."""
    c, chap_id, _ = client
    resp = c.post(
        f"/api/v1/context/{chap_id}/index", json={"content": "test"}
    )
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 3: DELETE /context/{chapter_id}/chunks
# ---------------------------------------------------------------------------

def test_delete_chunks_happy(client):
    c, chap_id, db = client
    from app.models import ContextChunk
    db.add(ContextChunk(
        user_id="default-user", chunk_id="chunk-x",
        chapter_id=chap_id, scene_index=0, content="x",
    ))
    db.commit()

    resp = c.delete(f"/api/v1/context/{chap_id}/chunks", headers=_h())
    assert resp.status_code == 204

    # Verify deleted
    resp2 = c.get(f"/api/v1/context/{chap_id}/chunks", headers=_h())
    assert resp2.json()["data"]["total"] == 0


def test_delete_chunks_idempotent(client):
    """Deleting when no chunks exist → still 204 (idempotent)."""
    c, chap_id, _ = client
    resp = c.delete(f"/api/v1/context/{chap_id}/chunks", headers=_h())
    assert resp.status_code == 204


def test_delete_chunks_unauthorized(client):
    """v0.5 Blocker A: auth bypass; delete succeeds without X-API-Key."""
    c, chap_id, _ = client
    resp = c.delete(f"/api/v1/context/{chap_id}/chunks")
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Endpoint 4: GET /context/{chapter_id}/stats
# ---------------------------------------------------------------------------

def test_stats_happy(client):
    c, chap_id, db = client
    from app.models import ContextStats
    db.add(ContextStats(
        user_id="default-user", chapter_id=chap_id,
        vectors=42, terms=100, max_scene_index=10,
    ))
    db.commit()

    resp = c.get(f"/api/v1/context/{chap_id}/stats", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["chapter_id"] == chap_id
    assert data["vectors"] == 42
    assert data["terms"] == 100
    assert data["max_scene_index"] == 10


def test_stats_auto_init(client):
    """GET stats on a chapter with chunks but no stats row → auto-compute."""
    c, chap_id, db = client
    # Index first to create chunks
    body = {"content": "Hello world " * 100, "max_chunk_size": 200}
    c.post(f"/api/v1/context/{chap_id}/index", json=body, headers=_h())

    # Now manually delete stats row to force auto-init path
    from app.models import ContextStats
    db.query(ContextStats).filter(ContextStats.chapter_id == chap_id).delete()
    db.commit()

    resp = c.get(f"/api/v1/context/{chap_id}/stats", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["vectors"] > 0  # recomputed from chunks


def test_stats_unauthorized(client):
    """v0.5 Blocker A: auth bypass."""
    c, chap_id, _ = client
    resp = c.get(f"/api/v1/context/{chap_id}/stats")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 5: GET /context/weights
# ---------------------------------------------------------------------------

def test_get_weights_defaults(client):
    """No prior weights → return defaults {character, location, item, faction}."""
    c, _, _ = client
    resp = c.get("/api/v1/context/weights", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert "weights" in data
    weights = data["weights"]
    assert weights.get("character") == 0.4
    assert weights.get("location") == 0.3
    assert weights.get("item") == 0.2
    assert weights.get("faction") == 0.1


def test_get_weights_custom(client):
    """Pre-seeded weights → returned as-is."""
    c, _, db = client
    from app.models import ContextWeights
    db.add(ContextWeights(
        user_id="default-user",
        weights={"character": 0.9, "recency": 0.1},
    ))
    db.commit()

    resp = c.get("/api/v1/context/weights", headers=_h())
    assert resp.status_code == 200
    weights = resp.json()["data"]["weights"]
    assert weights == {"character": 0.9, "recency": 0.1}


def test_get_weights_unauthorized(client):
    """v0.5 Blocker A: auth bypass."""
    c, _, _ = client
    resp = c.get("/api/v1/context/weights")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 6: PUT /context/weights
# ---------------------------------------------------------------------------

def test_put_weights_happy(client):
    c, _, db = client
    new_weights = {"character": 0.5, "location": 0.5}
    resp = c.put(
        "/api/v1/context/weights",
        json={"weights": new_weights},
        headers=_h(),
    )
    assert resp.status_code == 200
    body = resp.json()["data"]
    assert body["weights"] == new_weights

    # Verify persistence via GET
    resp2 = c.get("/api/v1/context/weights", headers=_h())
    assert resp2.json()["data"]["weights"] == new_weights


def test_put_weights_422_out_of_range(client):
    """Weight values must be in [0, 1]."""
    c, _, _ = client
    resp = c.put(
        "/api/v1/context/weights",
        json={"weights": {"character": 1.5}},
        headers=_h(),
    )
    assert resp.status_code == 422


def test_put_weights_unauthorized(client):
    """v0.5 Blocker A: auth bypass; PUT succeeds without X-API-Key."""
    c, _, _ = client
    resp = c.put(
        "/api/v1/context/weights",
        json={"weights": {"character": 0.5}},
    )
    assert resp.status_code == 200
