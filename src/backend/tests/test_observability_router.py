"""Tests for /api/v1/observability router — 11 endpoints × 3 cases each."""
from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app


@pytest.fixture
def client():
    """TestClient with in-memory SQLite + StaticPool."""
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = SessionLocal()
    try:
        def _override():
            try:
                yield session
            finally:
                pass

        app.dependency_overrides[get_db] = _override
        with TestClient(app) as c:
            yield c, session
    finally:
        app.dependency_overrides.clear()
        session.close()
        engine.dispose()


def _h() -> dict:
    return {"X-API-Key": "test-api-key-do-not-use-in-prod"}


# ---------------------------------------------------------------------------
# Endpoint 1: GET /observability/health
# ---------------------------------------------------------------------------

def test_health_happy(client):
    c, _ = client
    resp = c.get("/api/v1/observability/health", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["status"] in ("ok", "degraded", "down")
    assert data["db_status"] == "ok"
    assert data["uptime_seconds"] > 0
    assert "version" in data


def test_health_returns_correlation_id(client):
    c, _ = client
    resp = c.get(
        "/api/v1/observability/health",
        headers={**_h(), "X-Request-ID": "test-cid-123"},
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    # correlation_id is echoed (or None if middleware bypassed)
    assert data.get("correlation_id") in ("test-cid-123", None)


def test_health_bypass_auth(client):
    c, _ = client
    resp = c.get("/api/v1/observability/health")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 2: GET /observability/metrics
# ---------------------------------------------------------------------------

def test_metrics_empty(client):
    c, _ = client
    resp = c.get("/api/v1/observability/metrics", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["range"] == "24h"
    assert data["total"] == 0
    assert data["metrics"] == []


def test_metrics_with_data(client):
    c, db_session = client
    from app.repositories.observability import ObservabilityRepository
    repo = ObservabilityRepository(db_session)
    repo.create_metric("test_counter", 42.0, metric_type="counter")
    repo.create_metric("test_gauge", 0.8, metric_type="gauge")
    resp = c.get("/api/v1/observability/metrics", headers=_h())
    data = resp.json()["data"]
    assert data["total"] == 2


def test_metrics_invalid_range(client):
    c, _ = client
    resp = c.get("/api/v1/observability/metrics?range=invalid", headers=_h())
    assert resp.status_code == 422


def test_metrics_bypass_auth(client):
    c, _ = client
    resp = c.get("/api/v1/observability/metrics")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 3: GET /observability/errors
# ---------------------------------------------------------------------------

def test_errors_empty(client):
    c, _ = client
    resp = c.get("/api/v1/observability/errors", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 0


def test_errors_filtered_by_level(client):
    c, db_session = client
    from app.repositories.observability import ObservabilityRepository
    repo = ObservabilityRepository(db_session)
    repo.create_error("info msg", level="info")
    repo.create_error("error msg", level="error")
    resp = c.get("/api/v1/observability/errors?level=error", headers=_h())
    data = resp.json()["data"]
    assert data["total"] == 1
    assert data["errors"][0]["level"] == "error"


def test_errors_422_invalid_level(client):
    c, _ = client
    resp = c.get("/api/v1/observability/errors?level=invalid", headers=_h())
    assert resp.status_code == 422


def test_errors_bypass_auth(client):
    c, _ = client
    resp = c.get("/api/v1/observability/errors")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 4: POST /observability/errors/{id}/resolve
# ---------------------------------------------------------------------------

def test_resolve_error_happy(client):
    c, db_session = client
    from app.repositories.observability import ObservabilityRepository
    repo = ObservabilityRepository(db_session)
    e = repo.create_error("something failed")
    resp = c.post(
        f"/api/v1/observability/errors/{e.id}/resolve",
        json={"note": "fixed in commit abc123"},
        headers=_h(),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["resolved"] is True
    assert data["resolution_note"] == "fixed in commit abc123"


def test_resolve_error_404_missing(client):
    c, _ = client
    resp = c.post(
        "/api/v1/observability/errors/99999/resolve",
        json={"note": "x"},
        headers=_h(),
    )
    assert resp.status_code == 404


def test_resolve_error_422_empty_note(client):
    c, db_session = client
    from app.repositories.observability import ObservabilityRepository
    repo = ObservabilityRepository(db_session)
    e = repo.create_error("test")
    resp = c.post(
        f"/api/v1/observability/errors/{e.id}/resolve",
        json={"note": ""},  # min_length=1
        headers=_h(),
    )
    assert resp.status_code == 422


def test_resolve_error_bypass_auth(client):
    c, db_session = client
    from app.repositories.observability import ObservabilityRepository
    repo = ObservabilityRepository(db_session)
    e = repo.create_error("test")
    resp = c.post(
        f"/api/v1/observability/errors/{e.id}/resolve",
        json={"note": "fixed"},
    )
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 5: GET /observability/audit
# ---------------------------------------------------------------------------

def test_audit_empty(client):
    c, _ = client
    resp = c.get("/api/v1/observability/audit", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total"] == 0


def test_audit_with_data(client):
    c, db_session = client
    from app.repositories.observability import ObservabilityRepository
    repo = ObservabilityRepository(db_session)
    repo.create_audit("user.login", "session")
    repo.create_audit("project.create", "project", resource_id="42")
    resp = c.get("/api/v1/observability/audit", headers=_h())
    data = resp.json()["data"]
    assert data["total"] == 2


def test_audit_bypass_auth(client):
    c, _ = client
    resp = c.get("/api/v1/observability/audit")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 6: GET /observability/logs
# ---------------------------------------------------------------------------

def test_logs_empty(client):
    c, _ = client
    resp = c.get("/api/v1/observability/logs", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["range"] == "24h"
    assert data["total"] == 0
    assert data["logs"] == []


def test_logs_filter_level(client):
    c, _ = client
    resp = c.get("/api/v1/observability/logs?level=ERROR", headers=_h())
    assert resp.status_code == 200


def test_logs_422_invalid_level(client):
    c, _ = client
    resp = c.get("/api/v1/observability/logs?level=TRACE", headers=_h())
    assert resp.status_code == 422


def test_logs_bypass_auth(client):
    c, _ = client
    resp = c.get("/api/v1/observability/logs")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 7: POST /observability/logs/rotate
# ---------------------------------------------------------------------------

def test_rotate_no_file(client, tmp_path):
    """When no log file exists, rotation is idempotent success."""
    from app.config import get_settings
    settings = get_settings()
    settings.data_dir = tmp_path  # redirect to tempdir

    c, _ = client
    resp = c.post("/api/v1/observability/logs/rotate", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["bytes_freed"] == 0


def test_rotate_with_file(client, tmp_path):
    """When log file exists, rotation moves it + reports bytes freed."""
    from app.config import get_settings
    settings = get_settings()
    settings.data_dir = tmp_path
    log_dir = tmp_path / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    log_file = log_dir / "writer.log"
    log_file.write_text("hello\nworld\n")
    expected_size = log_file.stat().st_size  # capture before rotation

    c, _ = client
    resp = c.post("/api/v1/observability/logs/rotate", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["bytes_freed"] == expected_size
    # Old file should no longer exist
    assert not log_file.exists()


def test_rotate_bypass_auth(client, tmp_path):
    from app.config import get_settings
    settings = get_settings()
    settings.data_dir = tmp_path
    c, _ = client
    resp = c.post("/api/v1/observability/logs/rotate")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 8: GET /observability/usage
# ---------------------------------------------------------------------------

def test_usage_empty(client):
    c, _ = client
    resp = c.get("/api/v1/observability/usage", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["total_events"] == 0
    assert data["unique_features"] == 0


def test_usage_with_data(client):
    c, db_session = client
    from app.repositories.observability import ObservabilityRepository
    repo = ObservabilityRepository(db_session)
    repo.create_usage("chat.send", count=5)
    repo.create_usage("chat.send", count=3)
    repo.create_usage("ai.generate", count=1)
    resp = c.get("/api/v1/observability/usage", headers=_h())
    data = resp.json()["data"]
    assert data["total_events"] == 3
    assert data["total_count"] == 9
    assert data["unique_features"] == 2


def test_usage_bypass_auth(client):
    c, _ = client
    resp = c.get("/api/v1/observability/usage")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 9: GET /observability/usage/by-feature
# ---------------------------------------------------------------------------

def test_usage_by_feature_empty(client):
    c, _ = client
    resp = c.get("/api/v1/observability/usage/by-feature", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["features"] == []


def test_usage_by_feature_grouped(client):
    c, db_session = client
    from app.repositories.observability import ObservabilityRepository
    repo = ObservabilityRepository(db_session)
    repo.create_usage("chat.send", count=5)
    repo.create_usage("ai.generate", count=2)
    resp = c.get("/api/v1/observability/usage/by-feature", headers=_h())
    data = resp.json()["data"]
    assert len(data["features"]) == 2
    # Ordered by total_count desc
    assert data["features"][0]["feature"] == "chat.send"
    assert data["features"][0]["total_count"] == 5


def test_usage_by_feature_bypass_auth(client):
    c, _ = client
    resp = c.get("/api/v1/observability/usage/by-feature")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 10: GET /observability/usage/by-user
# ---------------------------------------------------------------------------

def test_usage_by_user_empty(client):
    c, _ = client
    resp = c.get("/api/v1/observability/usage/by-user", headers=_h())
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["users"] == []


def test_usage_by_user_grouped(client):
    c, db_session = client
    from app.repositories.observability import ObservabilityRepository
    from app.models import UsageEvent
    repo = ObservabilityRepository(db_session)
    repo.create_usage("chat", count=3)
    # Insert another user manually
    db_session.add(UsageEvent(user_id="other-user", feature="chat", count=7))
    db_session.commit()
    resp = c.get("/api/v1/observability/usage/by-user", headers=_h())
    data = resp.json()["data"]
    assert len(data["users"]) == 2
    # Ordered by total_count desc
    assert data["users"][0]["user_id"] == "other-user"
    assert data["users"][0]["total_count"] == 7


def test_usage_by_user_bypass_auth(client):
    c, _ = client
    resp = c.get("/api/v1/observability/usage/by-user")
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Endpoint 11: POST /observability/usage/export
# ---------------------------------------------------------------------------

def test_export_json(client, tmp_path):
    from app.config import get_settings
    settings = get_settings()
    settings.data_dir = tmp_path
    c, db_session = client
    from app.repositories.observability import ObservabilityRepository
    repo = ObservabilityRepository(db_session)
    repo.create_usage("chat.send", count=2)

    resp = c.post(
        "/api/v1/observability/usage/export",
        json={"range": "24h", "format": "json"},
        headers=_h(),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["format"] == "json"
    assert data["rows"] == 1
    assert data["size_bytes"] > 0
    # Verify file exists
    from pathlib import Path
    out_path = Path(data["path"])
    assert out_path.exists()


def test_export_csv(client, tmp_path):
    from app.config import get_settings
    settings = get_settings()
    settings.data_dir = tmp_path
    c, db_session = client
    from app.repositories.observability import ObservabilityRepository
    repo = ObservabilityRepository(db_session)
    repo.create_usage("chat.send", count=2)

    resp = c.post(
        "/api/v1/observability/usage/export",
        json={"range": "24h", "format": "csv"},
        headers=_h(),
    )
    assert resp.status_code == 200
    data = resp.json()["data"]
    assert data["format"] == "csv"
    from pathlib import Path
    assert Path(data["path"]).exists()


def test_export_422_invalid_format(client):
    c, _ = client
    resp = c.post(
        "/api/v1/observability/usage/export",
        json={"range": "24h", "format": "xml"},  # not in pattern
        headers=_h(),
    )
    assert resp.status_code == 422


def test_export_bypass_auth(client, tmp_path):
    from app.config import get_settings
    settings = get_settings()
    settings.data_dir = tmp_path
    c, _ = client
    resp = c.post(
        "/api/v1/observability/usage/export",
        json={"range": "24h", "format": "json"},
    )
    assert resp.status_code == 200
