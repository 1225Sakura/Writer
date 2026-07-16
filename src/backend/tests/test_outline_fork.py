"""Tests for US-015 outline fork endpoint.

Covers the OutlineForkService happy path, fork_chapter_id boundary, 404 on
missing outline/chapter, duplicate-name allowance, rich-field copy, schema
validation, and an end-to-end TestClient integration check.
"""
from __future__ import annotations

from sqlalchemy.pool import StaticPool
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError as PydanticValidationError

from app.core.exceptions import NotFoundException
from app.database import Base, get_db
from app.main import app
from app.models import Chapter, IFLine, Outline, Project
from app.repositories.chapter import ChapterRepository
from app.repositories.outline import OutlineRepository
from app.schemas.outline_fork import ForkOutlineRequest
from app.services.chapter import ChapterService
from app.services.outline import OutlineService
from app.services.outline_fork import OutlineForkService
from app.schemas.chapter import ChapterCreate, OutlineCreate


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _seed_project(db_session, name: str = "fork project") -> Project:
    project = Project(name=name)
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


def _seed_outline_with_chapters(
    db_session,
    project_id: int,
    *,
    title: str = "卷一",
    chapter_specs: list[dict] | None = None,
) -> tuple[Outline, list[Chapter]]:
    outline_svc = OutlineService(OutlineRepository(db_session))
    outline = outline_svc.create(OutlineCreate(title=title), project_id=project_id)
    chapter_svc = ChapterService(ChapterRepository(db_session))
    chapters: list[Chapter] = []
    specs = chapter_specs if chapter_specs is not None else [
        {"title": "第一章", "chapter_order": 1},
        {"title": "第二章", "chapter_order": 2},
        {"title": "第三章", "chapter_order": 3},
    ]
    for spec in specs:
        ch = chapter_svc.create(ChapterCreate(**spec), project_id=project_id)
        ch.outline_id = outline.id
        chapters.append(ch)
    db_session.commit()
    for ch in chapters:
        db_session.refresh(ch)
    db_session.refresh(outline)
    return outline, chapters


# ---------------------------------------------------------------------------
# 1. Happy path — service
# ---------------------------------------------------------------------------


def test_fork_outline_happy(db_session):
    project = _seed_project(db_session)
    outline, _ = _seed_outline_with_chapters(db_session, project.id)
    svc = OutlineForkService(
        OutlineRepository(db_session),
        ChapterRepository(db_session),
        db_session,
    )

    result = svc.fork(
        outline.id,
        name="支线：魔道入侵",
        project_id=project.id,
    )

    assert "if_line_id" in result
    assert "forked_outline_id" in result
    assert "common_chapters" in result
    assert result["if_line_id"] is not None
    assert result["forked_outline_id"] is not None
    assert len(result["common_chapters"]) == 3

    # New IFLine persisted with the right name + project.
    db_session.expire_all()
    if_line = db_session.get(IFLine, result["if_line_id"])
    assert if_line is not None
    assert if_line.name == "支线：魔道入侵"
    assert if_line.project_id == project.id
    assert if_line.fork_chapter_id is None

    # New Outline persisted, carries the source title.
    forked = db_session.get(Outline, result["forked_outline_id"])
    assert forked is not None
    assert forked.project_id == project.id
    assert forked.title == outline.title


# ---------------------------------------------------------------------------
# 2. fork_chapter_id boundary
# ---------------------------------------------------------------------------


def test_fork_outline_with_fork_chapter_marks_earlier_chapters_common(db_session):
    project = _seed_project(db_session)
    outline, chapters = _seed_outline_with_chapters(
        db_session,
        project.id,
        chapter_specs=[
            {"title": "第一章", "chapter_order": 1},
            {"title": "第二章", "chapter_order": 2},
            {"title": "第三章", "chapter_order": 3},
            {"title": "第四章", "chapter_order": 4},
        ],
    )
    svc = OutlineForkService(
        OutlineRepository(db_session),
        ChapterRepository(db_session),
        db_session,
    )

    # Fork at chapter_order == 2 → chapters with order 1, 2 are common.
    result = svc.fork(
        outline.id,
        name="分支：拒绝师门",
        project_id=project.id,
        fork_chapter_id=chapters[1].id,  # 2nd chapter (order 2)
    )

    db_session.expire_all()
    forked_chapters = (
        db_session.query(Chapter)
        .filter(Chapter.outline_id == result["forked_outline_id"])
        .order_by(Chapter.chapter_order)
        .all()
    )
    assert len(forked_chapters) == 4
    assert len(result["common_chapters"]) == 2

    # The two common IDs must correspond to the chapters with order <= 2.
    common_orders = sorted(
        db_session.get(Chapter, cid).chapter_order
        for cid in result["common_chapters"]
    )
    assert common_orders == [1, 2]


def test_fork_outline_with_fork_chapter_at_first_chapter_marks_only_it_common(db_session):
    project = _seed_project(db_session)
    outline, chapters = _seed_outline_with_chapters(
        db_session,
        project.id,
        chapter_specs=[
            {"title": "第一章", "chapter_order": 1},
            {"title": "第二章", "chapter_order": 2},
        ],
    )
    svc = OutlineForkService(
        OutlineRepository(db_session),
        ChapterRepository(db_session),
        db_session,
    )

    result = svc.fork(
        outline.id,
        name="早分叉",
        project_id=project.id,
        fork_chapter_id=chapters[0].id,
    )

    assert len(result["common_chapters"]) == 1


def test_fork_outline_returns_common_chapters_length_correct(db_session):
    """AC-P0-15.2/15.3 — common_chapters length matches chapters at-or-before
    fork_chapter.chapter_order; equals total chapter count when no fork id."""
    project = _seed_project(db_session)
    outline, chapters = _seed_outline_with_chapters(
        db_session,
        project.id,
        chapter_specs=[
            {"title": f"第{i}章", "chapter_order": i} for i in range(1, 6)
        ],
    )
    svc = OutlineForkService(
        OutlineRepository(db_session),
        ChapterRepository(db_session),
        db_session,
    )

    # No fork id → all 5 are common.
    full = svc.fork(outline.id, name="full", project_id=project.id)
    assert len(full["common_chapters"]) == 5

    # Fork at chapter_order == 3 → exactly 3 common.
    partial = svc.fork(
        outline.id,
        name="partial",
        project_id=project.id,
        fork_chapter_id=chapters[2].id,
    )
    assert len(partial["common_chapters"]) == 3


# ---------------------------------------------------------------------------
# 3. Nonexistent source outline → 404
# ---------------------------------------------------------------------------


def test_fork_outline_nonexistent_raises_404(db_session):
    project = _seed_project(db_session)
    svc = OutlineForkService(
        OutlineRepository(db_session),
        ChapterRepository(db_session),
        db_session,
    )

    with pytest.raises(NotFoundException):
        svc.fork(
            9999,  # no such outline
            name="ghost",
            project_id=project.id,
        )


def test_fork_outline_with_nonexistent_fork_chapter_raises_404(db_session):
    project = _seed_project(db_session)
    outline, _ = _seed_outline_with_chapters(db_session, project.id)
    svc = OutlineForkService(
        OutlineRepository(db_session),
        ChapterRepository(db_session),
        db_session,
    )

    with pytest.raises(NotFoundException):
        svc.fork(
            outline.id,
            name="bad fork chapter",
            project_id=project.id,
            fork_chapter_id=8888,
        )


# ---------------------------------------------------------------------------
# 4. Duplicate IFLine name is allowed (no uniqueness constraint on name)
# ---------------------------------------------------------------------------


def test_fork_outline_duplicate_name_allowed(db_session):
    project = _seed_project(db_session)
    outline, _ = _seed_outline_with_chapters(db_session, project.id)
    svc = OutlineForkService(
        OutlineRepository(db_session),
        ChapterRepository(db_session),
        db_session,
    )

    first = svc.fork(outline.id, name="同名", project_id=project.id)
    second = svc.fork(outline.id, name="同名", project_id=project.id)

    assert first["if_line_id"] != second["if_line_id"]
    assert first["forked_outline_id"] != second["forked_outline_id"]

    db_session.expire_all()
    rows = db_session.query(IFLine).filter(IFLine.name == "同名").all()
    assert len(rows) == 2


# ---------------------------------------------------------------------------
# 5. Rich fields are copied to the new outline's chapters
# ---------------------------------------------------------------------------


def test_fork_outline_copies_rich_fields(db_session):
    project = _seed_project(db_session)
    rich_chapter_payload = {
        "title": "第一章",
        "chapter_order": 1,
        "summary": "主角下山",
        "status": "drafting",
        "word_count": 1500,
        "content": "<p>正文...</p>",
        "notes": "伏笔：古剑裂纹",
        "note_category": "foreshadow",
        "note_pinned": True,
        "battle_station_data": "{\"characters\": [\"林澈\"]}",
        "sections": [
            {"title": "开端", "summary": "主角登场"},
            {"title": "冲突", "summary": "门派追杀"},
        ],
        "pacing_notes": "前1/3慢热，后2/3高潮",
        "character_dynamics": "主角内心挣扎",
        "foreshadowing": "玉佩裂纹",
    }
    outline, _ = _seed_outline_with_chapters(
        db_session,
        project.id,
        chapter_specs=[rich_chapter_payload],
    )
    svc = OutlineForkService(
        OutlineRepository(db_session),
        ChapterRepository(db_session),
        db_session,
    )

    result = svc.fork(
        outline.id,
        name="带丰富字段的支线",
        project_id=project.id,
    )

    db_session.expire_all()
    copied = (
        db_session.query(Chapter)
        .filter(Chapter.outline_id == result["forked_outline_id"])
        .all()
    )
    assert len(copied) == 1
    ch = copied[0]
    assert ch.sections == rich_chapter_payload["sections"]
    assert ch.pacing_notes == rich_chapter_payload["pacing_notes"]
    assert ch.character_dynamics == rich_chapter_payload["character_dynamics"]
    assert ch.foreshadowing == rich_chapter_payload["foreshadowing"]
    assert ch.summary == rich_chapter_payload["summary"]
    assert ch.status == rich_chapter_payload["status"]
    assert ch.word_count == rich_chapter_payload["word_count"]
    assert ch.content == rich_chapter_payload["content"]
    assert ch.notes == rich_chapter_payload["notes"]
    assert ch.note_category == rich_chapter_payload["note_category"]
    assert ch.note_pinned is True
    assert ch.battle_station_data == rich_chapter_payload["battle_station_data"]
    assert ch.chapter_order == rich_chapter_payload["chapter_order"]


# ---------------------------------------------------------------------------
# 6. Schema validation
# ---------------------------------------------------------------------------


def test_fork_outline_request_missing_required_fields():
    """Required: name, project_id. fork_chapter_id is optional."""
    with pytest.raises(PydanticValidationError):
        ForkOutlineRequest()  # type: ignore[call-arg]

    with pytest.raises(PydanticValidationError):
        ForkOutlineRequest(name="x")  # type: ignore[call-arg]


def test_fork_outline_request_fork_chapter_id_is_optional():
    """fork_chapter_id defaults to None when not provided."""
    req = ForkOutlineRequest(name="abc", project_id=7)
    assert req.fork_chapter_id is None
    assert req.name == "abc"
    assert req.project_id == 7


# ---------------------------------------------------------------------------
# 7. Integration via TestClient
# ---------------------------------------------------------------------------


@pytest.fixture
def fork_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = session_factory()

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client, session
    app.dependency_overrides.clear()
    session.close()
    engine.dispose()


def test_fork_outline_integration_happy(fork_client):
    client, db_session = fork_client

    proj = client.post("/api/v1/projects", json={"name": "integration fork"}).json()
    assert proj["success"] is True
    project_id = proj["data"]["id"]

    out = client.post(
        "/api/v1/chapters/outlines",
        json={"project_id": project_id, "title": "原大纲"},
    ).json()
    assert out["success"] is True
    outline_id = out["data"]["id"]

    # Seed 3 chapters via the chapter endpoint.
    chapter_ids = []
    for i in range(1, 4):
        ch_resp = client.post(
            "/api/v1/chapters",
            json={
                "project_id": project_id,
                "outline_id": outline_id,
                "title": f"第{i}章",
                "chapter_order": i,
            },
        )
        assert ch_resp.status_code == 200, ch_resp.text
        chapter_ids.append(ch_resp.json()["data"]["id"])

    resp = client.post(
        f"/api/v1/chapters/outlines/{outline_id}/fork",
        json={"name": "支线", "project_id": project_id},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["if_line_id"] is not None
    assert body["forked_outline_id"] is not None
    assert isinstance(body["common_chapters"], list)
    assert len(body["common_chapters"]) == 3


def test_fork_outline_integration_404_on_missing_outline(fork_client):
    client, _ = fork_client
    proj = client.post("/api/v1/projects", json={"name": "p"}).json()
    project_id = proj["data"]["id"]

    resp = client.post(
        "/api/v1/chapters/outlines/424242/fork",
        json={"name": "ghost", "project_id": project_id},
    )
    assert resp.status_code == 404, resp.text
    body = resp.json()
    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"


def test_fork_outline_integration_validation_error(fork_client):
    client, _ = fork_client
    # Missing required field 'project_id' — FastAPI returns 422 for body validation.
    resp = client.post(
        "/api/v1/chapters/outlines/1/fork",
        json={"name": "x"},
    )
    assert resp.status_code == 422, resp.text
