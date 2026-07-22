"""Tests for /api/v1/snapshots router — 14 endpoints × 3 cases each."""
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
    """TestClient with in-memory SQLite + StaticPool + chapter + project."""
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
        chap = Chapter(
            user_id="default-user",
            project_id=proj.id,
            title="Ch1",
            content="initial content for chapter",
        )
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


def _h() -> dict:
    return {"X-API-Key": "test-api-key-do-not-use-in-prod"}


# ---------------------------------------------------------------------------
# 1. GET /snapshots
# ---------------------------------------------------------------------------

def test_list_snapshots_empty(client):
    c, _, _ = client
    resp = c.get("/api/v1/snapshots", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 0


def test_list_snapshots_with_data(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    SnapshotsRepository(db_session).create(chap_id, "content 1", label="v1")
    SnapshotsRepository(db_session).create(chap_id, "content 2", label="v2")
    resp = c.get("/api/v1/snapshots", headers=_h())
    data = resp.json()["data"]
    assert data["total"] == 2


def test_list_snapshots_filter_by_chapter(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    SnapshotsRepository(db_session).create(chap_id, "x")
    # Use a non-existent chapter_id filter; should return empty
    resp = c.get("/api/v1/snapshots?chapter_id=99999", headers=_h())
    data = resp.json()["data"]
    assert data["total"] == 0
    assert data["chapter_id"] == 99999


def test_list_snapshots_bypass_auth(client):
    c, _, _ = client
    resp = c.get("/api/v1/snapshots")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 2. POST /snapshots
# ---------------------------------------------------------------------------

def test_create_snapshot_happy(client):
    c, chap_id, _ = client
    resp = c.post(
        "/api/v1/snapshots",
        json={"chapter_id": chap_id, "content": "my content", "label": "draft v1"},
        headers=_h(),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["chapter_id"] == chap_id
    assert data["word_count"] == 2  # "my content"
    assert data["label"] == "draft v1"
    assert len(data["fingerprint"]) == 64  # sha256 hex


def test_create_snapshot_422_empty_content(client):
    c, chap_id, _ = client
    resp = c.post(
        "/api/v1/snapshots",
        json={"chapter_id": chap_id, "content": ""},
        headers=_h(),
    )
    assert resp.status_code == 422


def test_create_snapshot_bypass_auth(client):
    c, chap_id, _ = client
    resp = c.post(
        "/api/v1/snapshots",
        json={"chapter_id": chap_id, "content": "x"},
    )
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 3. GET /snapshots/{id}
# ---------------------------------------------------------------------------

def test_get_snapshot_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.get(f"/api/v1/snapshots/{s.id}", headers=_h())
    assert resp.status_code == 200
    assert resp.json()["data"]["id"] == s.id


def test_get_snapshot_404_missing(client):
    c, _, _ = client
    resp = c.get("/api/v1/snapshots/99999", headers=_h())
    assert resp.status_code == 404


def test_get_snapshot_bypass_auth(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.get(f"/api/v1/snapshots/{s.id}")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 4. PUT /snapshots/{id}
# ---------------------------------------------------------------------------

def test_update_snapshot_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x", label="old")
    resp = c.put(
        f"/api/v1/snapshots/{s.id}",
        json={"label": "new"},
        headers=_h(),
    )
    assert resp.status_code == 200
    assert resp.json()["data"]["label"] == "new"


def test_update_snapshot_404_missing(client):
    c, _, _ = client
    resp = c.put(
        "/api/v1/snapshots/99999",
        json={"label": "x"},
        headers=_h(),
    )
    assert resp.status_code == 404


def test_update_snapshot_422_empty_label(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.put(
        f"/api/v1/snapshots/{s.id}",
        json={"label": ""},
        headers=_h(),
    )
    assert resp.status_code == 422


# ---------------------------------------------------------------------------
# 5. DELETE /snapshots/{id}
# ---------------------------------------------------------------------------

def test_delete_snapshot_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.delete(f"/api/v1/snapshots/{s.id}", headers=_h())
    assert resp.status_code == 200  # NB: API returns 200, not 204 (custom convention)
    # Verify deleted
    assert SnapshotsRepository(db_session).get(s.id) is None


def test_delete_snapshot_404_missing(client):
    c, _, _ = client
    resp = c.delete("/api/v1/snapshots/99999", headers=_h())
    assert resp.status_code == 404


def test_delete_snapshot_bypass_auth(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.delete(f"/api/v1/snapshots/{s.id}")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 6. POST /snapshots/{id}/revert
# ---------------------------------------------------------------------------

def test_revert_snapshot_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    SnapshotsRepository(db_session).create(chap_id, "old version content")
    # Modify chapter
    chap = db_session.query(Chapter).filter(Chapter.id == chap_id).first()
    chap.content = "new version"
    db_session.commit()
    # Revert to old snapshot
    snap = db_session.query(__import__("app.models").models.Snapshot).filter(
        __import__("app.models").models.Snapshot.chapter_id == chap_id
    ).first()
    resp = c.post(f"/api/v1/snapshots/{snap.id}/revert", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["new_word_count"] == 3  # "old version content"
    # Verify chapter content was updated
    db_session.refresh(chap)
    assert chap.content == "old version content"


def test_revert_snapshot_404_missing(client):
    c, _, _ = client
    resp = c.post("/api/v1/snapshots/99999/revert", headers=_h())
    assert resp.status_code == 404


def test_revert_snapshot_bypass_auth(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.post(f"/api/v1/snapshots/{s.id}/revert")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 7. GET /snapshots/{id}/diff/{other_id}
# ---------------------------------------------------------------------------

def test_diff_snapshots_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    repo = SnapshotsRepository(db_session)
    s1 = repo.create(chap_id, "hello world")
    s2 = repo.create(chap_id, "hello brave new world")
    resp = c.get(f"/api/v1/snapshots/{s1.id}/diff/{s2.id}", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["snapshot_id"] == s1.id
    assert data["other_id"] == s2.id
    assert data["similarity"] > 0.0  # partial match
    assert data["additions"] >= 2  # "brave new" added


def test_diff_snapshots_404_missing(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.get(f"/api/v1/snapshots/{s.id}/diff/99999", headers=_h())
    assert resp.status_code == 404


def test_diff_snapshots_bypass_auth(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    repo = SnapshotsRepository(db_session)
    s1 = repo.create(chap_id, "a")
    s2 = repo.create(chap_id, "b")
    resp = c.get(f"/api/v1/snapshots/{s1.id}/diff/{s2.id}")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 8. POST /snapshots/{id}/fork
# ---------------------------------------------------------------------------

def test_fork_snapshot_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "original", label="v1")
    resp = c.post(
        f"/api/v1/snapshots/{s.id}/fork",
        json={"label": "experimental branch"},
        headers=_h(),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["parent_snapshot_id"] == s.id
    assert data["label"] == "experimental branch"
    # Verify content was copied
    new_snap = SnapshotsRepository(db_session).get(data["id"])
    assert new_snap.content == "original"


def test_fork_snapshot_404_missing(client):
    c, _, _ = client
    resp = c.post(
        "/api/v1/snapshots/99999/fork",
        json={},
        headers=_h(),
    )
    assert resp.status_code == 404


def test_fork_snapshot_bypass_auth(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.post(f"/api/v1/snapshots/{s.id}/fork", json={})
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 9. GET /snapshots/by-chapter/{chapter_id}
# ---------------------------------------------------------------------------

def test_list_by_chapter_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    SnapshotsRepository(db_session).create(chap_id, "v1")
    SnapshotsRepository(db_session).create(chap_id, "v2")
    SnapshotsRepository(db_session).create(chap_id, "v3")
    resp = c.get(f"/api/v1/snapshots/by-chapter/{chap_id}", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 3
    assert data["chapter_id"] == chap_id


def test_list_by_chapter_empty(client):
    c, _, _ = client
    resp = c.get("/api/v1/snapshots/by-chapter/99999", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 0


def test_list_by_chapter_bypass_auth(client):
    c, chap_id, _ = client
    resp = c.get(f"/api/v1/snapshots/by-chapter/{chap_id}")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 10. POST /snapshots/batch-delete
# ---------------------------------------------------------------------------

def test_batch_delete_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    repo = SnapshotsRepository(db_session)
    s1 = repo.create(chap_id, "x1")
    s2 = repo.create(chap_id, "x2")
    s3 = repo.create(chap_id, "x3")
    resp = c.post(
        "/api/v1/snapshots/batch-delete",
        json={"ids": [s1.id, s2.id]},
        headers=_h(),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["requested"] == 2
    assert data["deleted"] == 2
    # s3 should still exist
    assert repo.get(s3.id) is not None


def test_batch_delete_422_empty_ids(client):
    c, _, _ = client
    resp = c.post(
        "/api/v1/snapshots/batch-delete",
        json={"ids": []},
        headers=_h(),
    )
    assert resp.status_code == 422


def test_batch_delete_bypass_auth(client):
    c, _, _ = client
    resp = c.post(
        "/api/v1/snapshots/batch-delete",
        json={"ids": [1]},
    )
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 11. GET /snapshots/{id}/metadata
# ---------------------------------------------------------------------------

def test_metadata_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "content", label="my-label")
    resp = c.get(f"/api/v1/snapshots/{s.id}/metadata", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["id"] == s.id
    assert data["word_count"] == 1
    assert data["fingerprint"] == s.fingerprint


def test_metadata_404_missing(client):
    c, _, _ = client
    resp = c.get("/api/v1/snapshots/99999/metadata", headers=_h())
    assert resp.status_code == 404


def test_metadata_bypass_auth(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.get(f"/api/v1/snapshots/{s.id}/metadata")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 12. POST /snapshots/{id}/tag
# ---------------------------------------------------------------------------

def test_add_tag_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.post(
        f"/api/v1/snapshots/{s.id}/tag",
        json={"tag": "milestone"},
        headers=_h(),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["tag"] == "milestone"
    assert data["added"] is True
    # Verify via metadata
    meta_resp = c.get(f"/api/v1/snapshots/{s.id}/metadata", headers=_h())
    assert "milestone" in meta_resp.json()["data"]["tags"]


def test_add_tag_404_missing(client):
    c, _, _ = client
    resp = c.post(
        "/api/v1/snapshots/99999/tag",
        json={"tag": "x"},
        headers=_h(),
    )
    assert resp.status_code == 404


def test_add_tag_bypass_auth(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.post(f"/api/v1/snapshots/{s.id}/tag", json={"tag": "x"})
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 13. DELETE /snapshots/{id}/tag/{tag}
# ---------------------------------------------------------------------------

def test_remove_tag_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    # Add then remove
    c.post(f"/api/v1/snapshots/{s.id}/tag", json={"tag": "todo"}, headers=_h())
    resp = c.delete(f"/api/v1/snapshots/{s.id}/tag/todo", headers=_h())
    assert resp.status_code == 200


def test_remove_tag_idempotent_missing(client):
    """Removing a tag that doesn't exist is idempotent (no error)."""
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.delete(f"/api/v1/snapshots/{s.id}/tag/nonexistent", headers=_h())
    assert resp.status_code == 200


def test_remove_tag_bypass_auth(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    s = SnapshotsRepository(db_session).create(chap_id, "x")
    resp = c.delete(f"/api/v1/snapshots/{s.id}/tag/anything")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 14. GET /snapshots/search
# ---------------------------------------------------------------------------

def test_search_happy(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    SnapshotsRepository(db_session).create(chap_id, "this is about magic", label="magic-scene")
    SnapshotsRepository(db_session).create(chap_id, "this is about romance", label="romance-scene")
    resp = c.get("/api/v1/snapshots/search?q=magic", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] >= 1


def test_search_422_empty_q(client):
    c, _, _ = client
    resp = c.get("/api/v1/snapshots/search?q=", headers=_h())
    assert resp.status_code == 422


def test_search_no_results(client):
    c, chap_id, db_session = client
    from app.repositories.snapshots import SnapshotsRepository
    SnapshotsRepository(db_session).create(chap_id, "about magic")
    resp = c.get("/api/v1/snapshots/search?q=nonexistent-keyword-xyz", headers=_h())
    data = resp.json()["data"]
    assert data["total"] == 0


def test_search_bypass_auth(client):
    c, _, _ = client
    resp = c.get("/api/v1/snapshots/search?q=anything")
    assert resp.status_code == 200
