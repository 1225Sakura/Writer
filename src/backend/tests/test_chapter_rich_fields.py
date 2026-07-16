"""Tests for US-013: chapter rich fields (sections, pacing_notes,
character_dynamics, foreshadowing). Covers field persistence, default-null
behavior, edge cases (empty list, long text), integration via TestClient,
and the alembic 0004 migration itself.
"""
from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.repositories.chapter import ChapterRepository
from app.services.chapter import ChapterService
from app.schemas.chapter import ChapterCreate, ChapterUpdate


# ---------------------------------------------------------------------------
# Field persistence (one case per field + edge cases)
# ---------------------------------------------------------------------------

def test_chapter_sections_field_persistence(db_session):
    """sections round-trips a JSON list of {title, summary} dicts."""
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    payload = [
        {"title": "开端", "summary": "主角登场"},
        {"title": "冲突", "summary": "门派追杀"},
    ]
    ch = svc.create(
        ChapterCreate(title="第一章", sections=payload),
        project_id=1,
    )
    db_session.expire_all()
    fetched = svc.get(ch.id)
    assert fetched.sections == payload
    assert fetched.sections[0]["title"] == "开端"
    assert fetched.sections[1]["summary"] == "门派追杀"


def test_chapter_pacing_notes_field_persistence(db_session):
    """pacing_notes round-trips a free-form text string."""
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    ch = svc.create(
        ChapterCreate(title="Pacing", pacing_notes="前1/3慢热，后2/3高潮"),
        project_id=1,
    )
    db_session.expire_all()
    fetched = svc.get(ch.id)
    assert fetched.pacing_notes == "前1/3慢热，后2/3高潮"


def test_chapter_character_dynamics_field_persistence(db_session):
    """character_dynamics round-trips a free-form text string."""
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    text = "主角：内心挣扎；女主：暗中观察；反派：步步紧逼"
    ch = svc.create(
        ChapterCreate(title="Dynamics", character_dynamics=text),
        project_id=1,
    )
    db_session.expire_all()
    fetched = svc.get(ch.id)
    assert fetched.character_dynamics == text


def test_chapter_foreshadowing_field_persistence(db_session):
    """foreshadowing round-trips a free-form text string."""
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    text = "玉佩上的裂纹——与上古血脉觉醒呼应"
    ch = svc.create(
        ChapterCreate(title="Foreshadow", foreshadowing=text),
        project_id=1,
    )
    db_session.expire_all()
    fetched = svc.get(ch.id)
    assert fetched.foreshadowing == text


def test_chapter_rich_fields_default_null(db_session):
    """Chapters created without the rich fields expose all four as None."""
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    ch = svc.create(ChapterCreate(title="Bare"), project_id=1)
    db_session.expire_all()
    fetched = svc.get(ch.id)
    assert fetched.sections is None
    assert fetched.pacing_notes is None
    assert fetched.character_dynamics is None
    assert fetched.foreshadowing is None


def test_chapter_sections_empty_list(db_session):
    """sections=[] is a valid value (must not be coerced to None)."""
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    ch = svc.create(ChapterCreate(title="EmptySections", sections=[]), project_id=1)
    db_session.expire_all()
    fetched = svc.get(ch.id)
    assert fetched.sections == []


def test_chapter_pacing_notes_long_text(db_session):
    """pacing_notes accepts text well beyond 1k characters."""
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    long_text = "节奏紧凑。" * 500  # ~5000 chars
    ch = svc.create(
        ChapterCreate(title="Long", pacing_notes=long_text),
        project_id=1,
    )
    db_session.expire_all()
    fetched = svc.get(ch.id)
    assert fetched.pacing_notes == long_text
    assert len(fetched.pacing_notes) > 1000


def test_chapter_update_rich_fields(db_session):
    """Updating rich fields via PATCH-style payload persists all four."""
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    ch = svc.create(ChapterCreate(title="Upd"), project_id=1)

    new_sections = [{"title": "开头", "summary": "起"}]
    updated = svc.update(
        ch.id,
        ChapterUpdate(
            sections=new_sections,
            pacing_notes="加速",
            character_dynamics="角色A发现线索",
            foreshadowing="古剑发光",
        ),
    )
    db_session.expire_all()
    fetched = svc.get(ch.id)
    assert fetched.sections == new_sections
    assert fetched.pacing_notes == "加速"
    assert fetched.character_dynamics == "角色A发现线索"
    assert fetched.foreshadowing == "古剑发光"


# ---------------------------------------------------------------------------
# Integration via TestClient (project → outline → chapter → fields)
# ---------------------------------------------------------------------------

@pytest.fixture
def rich_fields_client():
    """StaticPool-isolated TestClient so the same in-memory DB persists across
    TestClient's worker thread. Mirrors the chat-test pattern in test_chat.py.
    """
    eng = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=eng)

    def _override():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = _override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
    eng.dispose()


def test_chapter_rich_fields_integration(rich_fields_client):
    """End-to-end: project → outline → chapter → set rich fields → read back."""
    proj = rich_fields_client.post("/api/v1/projects", json={"name": "rich-fields-proj"}).json()
    assert proj["success"] is True
    project_id = proj["data"]["id"]

    out = rich_fields_client.post("/api/v1/chapters/outlines", json={"project_id": project_id, "title": "卷一"}).json()
    assert out["success"] is True
    outline_id = out["data"]["id"]

    rich = {
        "sections": [
            {"title": "开端", "summary": "主角下山"},
            {"title": "转折", "summary": "遇见女主"},
        ],
        "pacing_notes": "开端慢，转折急",
        "character_dynamics": "主角：从迷茫到坚定",
        "foreshadowing": "古剑出现裂纹",
    }
    create_resp = rich_fields_client.post(
        "/api/v1/chapters",
        json={
            "project_id": project_id,
            "outline_id": outline_id,
            "title": "第一章 下山",
            **rich,
        },
    )
    assert create_resp.status_code == 200, create_resp.text
    body = create_resp.json()
    assert body["success"] is True
    chapter_id = body["data"]["id"]

    get_resp = rich_fields_client.get(f"/api/v1/chapters/{chapter_id}")
    assert get_resp.status_code == 200
    fetched = get_resp.json()["data"]
    assert fetched["sections"] == rich["sections"]
    assert fetched["pacing_notes"] == rich["pacing_notes"]
    assert fetched["character_dynamics"] == rich["character_dynamics"]
    assert fetched["foreshadowing"] == rich["foreshadowing"]


# ---------------------------------------------------------------------------
# Alembic migration 0004 — schema, round-trip, perf, existing data
# ---------------------------------------------------------------------------

@pytest.fixture
def alembic_db_with_existing_chapter(monkeypatch):
    """Spin up a fresh alembic-managed DB and seed a chapter via SQL at v0003.

    Used to assert that upgrade to 0004 does not lose the existing row.
    """
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        tmp_path = f.name
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}")

    from app.config import get_settings
    get_settings.cache_clear()

    from alembic.config import Config
    from alembic import command
    from sqlalchemy import text

    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    # upgrade to 0003, then seed a chapter.
    command.upgrade(cfg, "c4d5e6f7a8b9")
    eng = create_engine(f"sqlite:///{tmp_path}")
    with eng.begin() as conn:
        conn.execute(text(
            "INSERT INTO projects (name, user_id) VALUES ('legacy', 'default-user')"
        ))
        conn.execute(text(
            "INSERT INTO chapters (project_id, title, summary, status) "
            "VALUES (1, 'legacy chapter', 'pre-0004 summary', 'planning')"
        ))
    eng.dispose()

    yield f"sqlite:///{tmp_path}"

    get_settings.cache_clear()
    try:
        os.unlink(tmp_path)
    except OSError:
        pass


def test_alembic_0004_adds_chapter_rich_fields(monkeypatch):
    """Upgrade head introduces sections / pacing_notes / character_dynamics /
    foreshadowing on chapters (column-type spot check)."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        tmp_path = f.name
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}")

    from app.config import get_settings
    get_settings.cache_clear()

    from alembic.config import Config
    from alembic import command

    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.upgrade(cfg, "head")

    eng = create_engine(f"sqlite:///{tmp_path}")
    insp = inspect(eng)
    cols = {c["name"]: c for c in insp.get_columns("chapters")}
    for col in ("sections", "pacing_notes", "character_dynamics", "foreshadowing"):
        assert col in cols, f"chapter.{col} missing after upgrade"
        assert cols[col]["nullable"] is True, f"chapter.{col} should be nullable"
    # sections is JSON, the text fields are TEXT
    assert "JSON" in str(cols["sections"]["type"]).upper()
    for col in ("pacing_notes", "character_dynamics", "foreshadowing"):
        assert "TEXT" in str(cols[col]["type"]).upper() or "VARCHAR" in str(cols[col]["type"]).upper()
    eng.dispose()

    get_settings.cache_clear()
    try:
        os.unlink(tmp_path)
    except OSError:
        pass


def test_alembic_0004_preserves_existing_chapter_data(alembic_db_with_existing_chapter):
    """Migration must keep the legacy chapter row intact after upgrade."""
    from alembic.config import Config
    from alembic import command
    from sqlalchemy import text

    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.upgrade(cfg, "head")

    eng = create_engine(alembic_db_with_existing_chapter)
    with eng.connect() as conn:
        row = conn.execute(text(
            "SELECT title, summary, status FROM chapters WHERE id = 1"
        )).first()
    assert row is not None
    assert row[0] == "legacy chapter"
    assert row[1] == "pre-0004 summary"
    assert row[2] == "planning"


def test_alembic_0004_downgrade_removes_fields(monkeypatch):
    """Downgrade to 0003 drops the four new columns; legacy data unaffected."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        tmp_path = f.name
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}")

    from app.config import get_settings
    get_settings.cache_clear()

    from alembic.config import Config
    from alembic import command

    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "c4d5e6f7a8b9")

    eng = create_engine(f"sqlite:///{tmp_path}")
    insp = inspect(eng)
    cols = {c["name"] for c in insp.get_columns("chapters")}
    for col in ("sections", "pacing_notes", "character_dynamics", "foreshadowing"):
        assert col not in cols, f"{col} should be gone after downgrade"
    # Base chapter columns still present
    for col in ("title", "summary", "status", "word_count", "chapter_order"):
        assert col in cols
    eng.dispose()

    get_settings.cache_clear()
    try:
        os.unlink(tmp_path)
    except OSError:
        pass


def test_alembic_0004_perf_under_1s(monkeypatch):
    """AC-P0-13.5: upgrading to 0004 on a populated DB takes <1s."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        tmp_path = f.name
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path}")

    from app.config import get_settings
    get_settings.cache_clear()

    from alembic.config import Config
    from alembic import command
    from sqlalchemy import text

    cfg = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    command.upgrade(cfg, "c4d5e6f7a8b9")
    eng = create_engine(f"sqlite:///{tmp_path}")
    with eng.begin() as conn:
        conn.execute(text(
            "INSERT INTO projects (name, user_id) VALUES ('perf', 'default-user')"
        ))
        # Insert 20 chapters so the perf smoke isn't on an empty table.
        for i in range(20):
            conn.execute(text(
                "INSERT INTO chapters (project_id, title) VALUES (1, :t)"
            ), {"t": f"ch-{i}"})
    eng.dispose()

    t0 = time.time()
    command.upgrade(cfg, "head")
    elapsed = time.time() - t0
    assert elapsed < 1.0, f"alembic 0004 upgrade took {elapsed:.3f}s (>1s)"

    get_settings.cache_clear()
    try:
        os.unlink(tmp_path)
    except OSError:
        pass