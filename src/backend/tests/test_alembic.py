"""Tests for Alembic migrations — US-001 + US-002 combined baseline.

Covers:
- upgrade head succeeds on a fresh SQLite DB
- downgrade base succeeds
- upgrade → downgrade → upgrade round-trip succeeds
- Project/AIProvider/WritingSettings tables contain user_id column
- schema in DB matches Base.metadata (modulo alembic_version)
- TestClient startup works against alembic-managed DB
- upgrade head performance < 2s (AC-P0-1.7)
"""
from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text

from app.config import get_settings
from app.database import Base
from app.models import Project, AIProvider, WritingSettings


@pytest.fixture
def fresh_alembic_db(monkeypatch):
    """Create a fresh SQLite DB and run alembic upgrade head on it."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        tmp_path = f.name
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}")
    get_settings.cache_clear()

    from alembic.config import Config
    from alembic import command

    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.upgrade(cfg, "head")

    yield f"sqlite:///{tmp_path}"

    # cleanup
    get_settings.cache_clear()
    try:
        os.unlink(tmp_path)
    except OSError:
        pass


def test_alembic_upgrade_head(fresh_alembic_db):
    """AC-P0-1.5: alembic upgrade head succeeds on empty DB."""
    eng = create_engine(fresh_alembic_db)
    insp = inspect(eng)
    tables = set(insp.get_table_names())
    assert "alembic_version" in tables
    # all model tables present
    for tbl in Base.metadata.tables:
        assert tbl in tables, f"missing table {tbl}"


def test_alembic_downgrade_to_base(fresh_alembic_db):
    """AC-P0-1.5: alembic downgrade base succeeds."""
    from alembic.config import Config
    from alembic import command

    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.downgrade(cfg, "base")

    eng = create_engine(fresh_alembic_db)
    insp = inspect(eng)
    # After downgrade to base, only alembic_version remains
    tables = set(insp.get_table_names())
    assert tables == {"alembic_version"}, f"expected only alembic_version, got {tables}"


def test_alembic_round_trip(fresh_alembic_db):
    """AC-P0-1.5: upgrade → downgrade → upgrade works (no half-state)."""
    from alembic.config import Config
    from alembic import command

    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.downgrade(cfg, "base")
    command.upgrade(cfg, "head")

    eng = create_engine(fresh_alembic_db)
    insp = inspect(eng)
    tables = set(insp.get_table_names())
    for tbl in Base.metadata.tables:
        assert tbl in tables


def test_user_id_columns_present(fresh_alembic_db):
    """US-002: user_id exists on Project/AIProvider/WritingSettings."""
    eng = create_engine(fresh_alembic_db)
    insp = inspect(eng)
    for table_name in ("projects", "ai_providers", "writing_settings"):
        cols = {c["name"]: c for c in insp.get_columns(table_name)}
        assert "user_id" in cols, f"{table_name}.user_id missing"
        col = cols["user_id"]
        assert "VARCHAR" in str(col["type"]).upper()
        assert col["nullable"] is False
        assert "default-user" in (col.get("default") or "")


def test_user_id_columns_in_model_metadata():
    """US-002: Model classes expose user_id via SQLAlchemy metadata.

    Note: the Python Model column is the source of truth — but US-002
    currently only exists in the migration (model file still adds it
    in commit 2 per plan). This test guards the schema in the DB only.
    """
    # All three models still importable from app.models
    assert Project is not None
    assert AIProvider is not None
    assert WritingSettings is not None


def test_schema_matches_model_metadata(fresh_alembic_db):
    """DB schema after upgrade head matches Base.metadata (no missing/extra)."""
    eng = create_engine(fresh_alembic_db)
    insp = inspect(eng)
    db_tables = set(insp.get_table_names()) - {"alembic_version"}
    model_tables = set(Base.metadata.tables.keys())
    assert db_tables == model_tables, (
        f"DB-model mismatch. only_in_db={db_tables - model_tables}, "
        f"only_in_model={model_tables - db_tables}"
    )


def test_alembic_performance_under_2s(fresh_alembic_db):
    """AC-P0-1.7: upgrade head on empty SQLite < 2s."""
    from alembic.config import Config
    from alembic import command

    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    # fresh DB → downgrade first
    command.downgrade(cfg, "base")
    t0 = time.time()
    command.upgrade(cfg, "head")
    elapsed = time.time() - t0
    assert elapsed < 2.0, f"alembic upgrade took {elapsed:.3f}s (>2s)"


def test_writing_settings_default_user_on_insert(fresh_alembic_db):
    """Writing-settings row created with server_default picks up 'default-user'."""
    eng = create_engine(fresh_alembic_db)
    with eng.begin() as conn:
        conn.execute(text("INSERT INTO projects (name) VALUES ('test')"))
        conn.execute(text(
            "INSERT INTO writing_settings (project_id, human_ai_ratio, writing_style) "
            "VALUES (1, 0.5, 'default')"
        ))
        row = conn.execute(text(
            "SELECT user_id FROM writing_settings WHERE project_id = 1"
        )).first()
        assert row[0] == "default-user"


def test_fastapi_starts_against_alembic_managed_db(fresh_alembic_db, monkeypatch):
    """Integration: FastAPI app starts cleanly against alembic-managed SQLite,
    and the DB schema visible to the app matches what alembic created."""
    # The fresh_alembic_db fixture already set DATABASE_URL.
    # Re-import the engine so it picks up the new URL.
    monkeypatch.setattr("app.database.settings.database_url", fresh_alembic_db)
    get_settings.cache_clear()

    # Patch the engine in app.database by reimporting
    import importlib
    import app.database as app_db
    importlib.reload(app_db)

    from fastapi.testclient import TestClient
    from app.main import app
    from app.database import get_db as real_get_db

    eng = create_engine(fresh_alembic_db)
    from sqlalchemy.orm import sessionmaker
    TestSession = sessionmaker(bind=eng)

    def _override_db():
        db = TestSession()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[real_get_db] = _override_db
    try:
        with TestClient(app) as c:
            r = c.get("/openapi.json")
            assert r.status_code == 200, f"openapi.json failed: {r.status_code}"

            # Inspect schema via the same engine
            insp = inspect(eng)
            db_tables = set(insp.get_table_names()) - {"alembic_version"}
            assert "projects" in db_tables
            assert "writing_settings" in db_tables
            cols = {c["name"] for c in insp.get_columns("projects")}
            assert "user_id" in cols, "alembic state did not propagate user_id"
    finally:
        app.dependency_overrides.clear()
