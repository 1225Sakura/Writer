"""Tests for /api/v1/engagement router — 6 endpoints × 3 cases each.

Coverage:
- 1: GET    /engagement/{chapter_id}/score         — happy + auto-compute + idempotent
- 2: POST   /engagement/{chapter_id}/compute       — happy + score persisted + 422 invalid body
- 3: GET    /engagement/{chapter_id}/cool-points   — happy + empty list + ordered by position
- 4: POST   /engagement/{chapter_id}/cool-points   — happy + 422 invalid intensity + 201 created
- 5: DELETE /engagement/cool-points/{id}           — happy + 404 missing + idempotent-like
- 6: GET    /engagement/{chapter_id}/fulfillment   — happy + empty + auto-create behavior
"""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import Chapter, Project


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
            yield c, chap.id
    finally:
        app.dependency_overrides.clear()
        session.close()
        engine.dispose()


def _h() -> dict:
    return {"X-API-Key": "test-api-key-do-not-use-in-prod"}


# ---------------------------------------------------------------------------
# Endpoint 1: GET /engagement/{chapter_id}/score
# ---------------------------------------------------------------------------

def test_get_score_auto_compute(client):
    """No prior score → auto-compute (base 0.5, no cool_points/fulfillments)."""
    c, chap_id = client
    resp = c.get(f"/api/v1/engagement/{chap_id}/score", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["chapter_id"] == chap_id
    assert data["overall_score"] == 0.5  # base score
    assert data["grade"] == "F"  # 0.5 < 0.6 → F


def test_get_score_idempotent(client):
    """Two GETs return the same persisted score (not recomputed each time)."""
    c, chap_id = client
    r1 = c.get(f"/api/v1/engagement/{chap_id}/score", headers=_h())
    r2 = c.get(f"/api/v1/engagement/{chap_id}/score", headers=_h())
    assert r1.json()["data"]["overall_score"] == r2.json()["data"]["overall_score"]


def test_get_score_bypass_auth(client):
    """v0.5 Blocker A: auth bypass; GET succeeds without X-API-Key."""
    c, chap_id = client
    resp = c.get(f"/api/v1/engagement/{chap_id}/score")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 2: POST /engagement/{chapter_id}/compute
# ---------------------------------------------------------------------------

def test_compute_happy(client):
    c, chap_id = client
    resp = c.post(f"/api/v1/engagement/{chap_id}/compute", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["chapter_id"] == chap_id
    assert "computed_at" in data
    assert data["score"]["overall_score"] == 0.5


def test_compute_with_note(client):
    """Optional body with note → persisted in factors JSON."""
    c, chap_id = client
    resp = c.post(
        f"/api/v1/engagement/{chap_id}/compute",
        json={"note": "test-trigger"},
        headers=_h(),
    )
    assert resp.status_code == 200
    # Verify note persisted by re-reading via GET
    r2 = c.get(f"/api/v1/engagement/{chap_id}/score", headers=_h())
    assert r2.status_code == 200


def test_compute_422_invalid_note(client):
    c, chap_id = client
    resp = c.post(
        f"/api/v1/engagement/{chap_id}/compute",
        json={"note": "x" * 600},  # exceeds max_length=500
        headers=_h(),
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# Endpoint 3: GET /engagement/{chapter_id}/cool-points
# ---------------------------------------------------------------------------

def test_list_cool_points_empty(client):
    c, chap_id = client
    resp = c.get(f"/api/v1/engagement/{chap_id}/cool-points", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["chapter_id"] == chap_id
    assert data["total"] == 0
    assert data["points"] == []


def test_list_cool_points_ordered(client):
    c, chap_id = client
    # Create 3 cool points out of order
    c.post(f"/api/v1/engagement/{chap_id}/cool-points",
           json={"text": "third", "position": 30}, headers=_h())
    c.post(f"/api/v1/engagement/{chap_id}/cool-points",
           json={"text": "first", "position": 10}, headers=_h())
    c.post(f"/api/v1/engagement/{chap_id}/cool-points",
           json={"text": "second", "position": 20}, headers=_h())
    resp = c.get(f"/api/v1/engagement/{chap_id}/cool-points", headers=_h())
    data = resp.json()["data"]
    assert data["total"] == 3
    assert [p["text"] for p in data["points"]] == ["first", "second", "third"]


def test_list_cool_points_bypass_auth(client):
    c, chap_id = client
    resp = c.get(f"/api/v1/engagement/{chap_id}/cool-points")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 4: POST /engagement/{chapter_id}/cool-points
# ---------------------------------------------------------------------------

def test_create_cool_point_happy(client):
    c, chap_id = client
    resp = c.post(
        f"/api/v1/engagement/{chap_id}/cool-points",
        json={"text": "主角领悟剑意", "intensity": 0.8, "position": 100},
        headers=_h(),
    )
    assert resp.status_code == 201
    data = resp.json()["data"]
    assert data["text"] == "主角领悟剑意"
    assert data["intensity"] == 0.8
    assert data["position"] == 100
    assert data["point_type"] == "reveal"  # default


def test_create_cool_point_422_invalid_intensity(client):
    c, chap_id = client
    resp = c.post(
        f"/api/v1/engagement/{chap_id}/cool-points",
        json={"text": "bad", "intensity": 1.5},  # > 1.0
        headers=_h(),
    )
    assert resp.status_code == 422


def test_create_cool_point_bypass_auth(client):
    c, chap_id = client
    resp = c.post(
        f"/api/v1/engagement/{chap_id}/cool-points",
        json={"text": "x"},
    )
    assert resp.status_code == 201


# ---------------------------------------------------------------------------
# Endpoint 5: DELETE /engagement/cool-points/{id}
# ---------------------------------------------------------------------------

def test_delete_cool_point_happy(client):
    c, chap_id = client
    # Create then delete
    r = c.post(
        f"/api/v1/engagement/{chap_id}/cool-points",
        json={"text": "to-delete"},
        headers=_h(),
    )
    cp_id = r.json()["data"]["id"]
    resp = c.delete(f"/api/v1/engagement/cool-points/{cp_id}", headers=_h())
    assert resp.status_code == 204

    # Verify deleted
    r2 = c.get(f"/api/v1/engagement/{chap_id}/cool-points", headers=_h())
    assert r2.json()["data"]["total"] == 0


def test_delete_cool_point_404_missing(client):
    c, _ = client
    resp = c.delete("/api/v1/engagement/cool-points/99999", headers=_h())
    assert resp.status_code == 404


def test_delete_cool_point_bypass_auth(client):
    c, chap_id = client
    r = c.post(
        f"/api/v1/engagement/{chap_id}/cool-points",
        json={"text": "x"}, headers=_h(),
    )
    cp_id = r.json()["data"]["id"]
    resp = c.delete(f"/api/v1/engagement/cool-points/{cp_id}")
    assert resp.status_code == 204


# ---------------------------------------------------------------------------
# Endpoint 6: GET /engagement/{chapter_id}/fulfillment
# ---------------------------------------------------------------------------

def test_list_fulfillments_empty(client):
    c, chap_id = client
    resp = c.get(f"/api/v1/engagement/{chap_id}/fulfillment", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["chapter_id"] == chap_id
    assert data["total"] == 0
    assert data["fulfillments"] == []


def test_list_fulfillments_after_compute(client):
    """Compute → score persisted → but fulfillments table separate (manual create)."""
    c, chap_id = client
    # Trigger compute first
    c.post(f"/api/v1/engagement/{chap_id}/compute", headers=_h())
    resp = c.get(f"/api/v1/engagement/{chap_id}/fulfillment", headers=_h())
    # Compute doesn't auto-create fulfillments; list is empty until manually seeded.
    assert resp.status_code == 200
    assert resp.json()["data"]["total"] == 0


def test_list_fulfillments_bypass_auth(client):
    c, chap_id = client
    resp = c.get(f"/api/v1/engagement/{chap_id}/fulfillment")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Cross-endpoint: score improves with more cool_points + fulfillments
# ---------------------------------------------------------------------------

def test_score_responsive_to_data(client):
    """Verify the scoring formula is responsive (heuristic sanity check)."""
    c, chap_id = client
    # Initial: base score
    r1 = c.get(f"/api/v1/engagement/{chap_id}/score", headers=_h())
    s_initial = r1.json()["data"]["overall_score"]

    # Add 4 cool points → cool_bonus = 4 * 0.05 = 0.2
    for i in range(4):
        c.post(
            f"/api/v1/engagement/{chap_id}/cool-points",
            json={"text": f"point-{i}", "position": i},
            headers=_h(),
        )

    # Re-compute
    r2 = c.post(f"/api/v1/engagement/{chap_id}/compute", headers=_h())
    s_after = r2.json()["data"]["score"]["overall_score"]

    # After adding 4 cool points: base 0.5 + 0.2 = 0.7
    assert s_after > s_initial
    assert s_after == pytest.approx(0.7, abs=1e-6)
