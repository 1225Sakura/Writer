"""Tests for US-016 chapter fork endpoint.

Covers ChapterForkService happy path, same-outline fork, cross-outline fork,
rich-field copy, 404 on missing chapter/IFLine, schema validation, and an
end-to-end TestClient integration check that the new chapter can be edited
independently of the source.
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
from app.schemas.chapter import ChapterCreate, OutlineCreate
from app.schemas.chapter_fork import ForkChapterRequest
from app.services.chapter import ChapterService
from app.services.chapter_fork import ChapterForkService
from app.services.outline import OutlineService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _seed_project(db_session, name: str = "fork chapter project") -> Project:
    project = Project(name=name)
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


def _seed_outline_with_chapter(
    db_session,
    project_id: int,
    *,
    outline_title: str = "卷一",
    chapter: dict | None = None,
) -> tuple[Outline, Chapter]:
    outline_svc = OutlineService(OutlineRepository(db_session))
    outline = outline_svc.create(
        OutlineCreate(title=outline_title), project_id=project_id
    )
    chapter_svc = ChapterService(ChapterRepository(db_session))
    spec = chapter or {"title": "第一章", "chapter_order": 1}
    ch = chapter_svc.create(ChapterCreate(**spec), project_id=project_id)
    ch.outline_id = outline.id
    db_session.commit()
    db_session.refresh(ch)
    db_session.refresh(outline)
    return outline, ch


def _seed_if_line(
    db_session,
    *,
    project_id: int,
    name: str = "支线",
    fork_chapter_id: int | None = None,
) -> IFLine:
    if_line = IFLine(
        user_id="default-user",
        project_id=project_id,
        name=name,
        fork_chapter_id=fork_chapter_id,
    )
    db_session.add(if_line)
    db_session.commit()
    db_session.refresh(if_line)
    return if_line


# ---------------------------------------------------------------------------
# 1. Happy path — service
# ---------------------------------------------------------------------------


def test_fork_chapter_happy(db_session):
    project = _seed_project(db_session)
    _, source = _seed_outline_with_chapter(
        db_session,
        project.id,
        chapter={
            "title": "第一章 出山",
            "summary": "主角下山",
            "chapter_order": 1,
            "word_count": 1200,
            "content": "<p>开篇</p>",
        },
    )
    if_line = _seed_if_line(db_session, project_id=project.id, name="魔道支线")

    svc = ChapterForkService(
        ChapterRepository(db_session),
        OutlineRepository(db_session),
        db_session,
    )
    result = svc.fork(source.id, if_line.id)

    assert result["new_chapter_id"] != source.id
    assert result["parent_chapter_id"] == source.id
    assert result["if_line_id"] == if_line.id

    db_session.expire_all()
    new_ch = db_session.get(Chapter, result["new_chapter_id"])
    assert new_ch is not None
    assert new_ch.project_id == project.id
    assert new_ch.title == source.title
    assert new_ch.summary == source.summary
    assert new_ch.content == source.content
    assert new_ch.word_count == source.word_count
    assert new_ch.chapter_order == source.chapter_order


# ---------------------------------------------------------------------------
# 2. Same outline — IFLine.fork_chapter belongs to the same outline as source
# ---------------------------------------------------------------------------


def test_fork_chapter_same_outline(db_session):
    project = _seed_project(db_session)
    outline, source = _seed_outline_with_chapter(
        db_session,
        project.id,
        chapter={"title": "共同章节", "chapter_order": 1},
    )
    # IFLine is anchored at this same chapter (same outline)
    if_line = _seed_if_line(
        db_session,
        project_id=project.id,
        name="同 outline 分支",
        fork_chapter_id=source.id,
    )

    svc = ChapterForkService(
        ChapterRepository(db_session),
        OutlineRepository(db_session),
        db_session,
    )
    result = svc.fork(source.id, if_line.id)

    db_session.expire_all()
    new_ch = db_session.get(Chapter, result["new_chapter_id"])
    assert new_ch.outline_id == outline.id  # same outline
    assert new_ch.id != source.id


# ---------------------------------------------------------------------------
# 3. Cross outline — IFLine.fork_chapter belongs to a different outline
# ---------------------------------------------------------------------------


def test_fork_chapter_cross_outline(db_session):
    project = _seed_project(db_session)
    outline_a, source = _seed_outline_with_chapter(
        db_session,
        project.id,
        outline_title="大纲A",
        chapter={"title": "源章节", "chapter_order": 1},
    )
    outline_b, anchor = _seed_outline_with_chapter(
        db_session,
        project.id,
        outline_title="大纲B",
        chapter={"title": "锚点章节", "chapter_order": 1},
    )
    # IFLine is anchored in outline B; source chapter is in outline A.
    if_line = _seed_if_line(
        db_session,
        project_id=project.id,
        name="跨 outline 分支",
        fork_chapter_id=anchor.id,
    )

    svc = ChapterForkService(
        ChapterRepository(db_session),
        OutlineRepository(db_session),
        db_session,
    )
    result = svc.fork(source.id, if_line.id)

    db_session.expire_all()
    new_ch = db_session.get(Chapter, result["new_chapter_id"])
    assert new_ch.outline_id == outline_b.id  # IFLine's outline, not source's
    assert new_ch.outline_id != outline_a.id


# ---------------------------------------------------------------------------
# 4. Rich fields are copied to the new chapter
# ---------------------------------------------------------------------------


def test_fork_chapter_copies_rich_fields(db_session):
    project = _seed_project(db_session)
    rich = {
        "title": "第一章",
        "chapter_order": 1,
        "summary": "主角下山",
        "status": "drafting",
        "word_count": 1500,
        "content": "<p>正文...</p>",
        "notes": "伏笔：古剑裂纹",
        "note_category": "foreshadow",
        "note_pinned": True,
        "battle_station_data": '{"characters": ["林澈"]}',
        "sections": [
            {"title": "开端", "summary": "主角登场"},
            {"title": "冲突", "summary": "门派追杀"},
        ],
        "pacing_notes": "前1/3慢热，后2/3高潮",
        "character_dynamics": "主角内心挣扎",
        "foreshadowing": "玉佩裂纹",
    }
    _, source = _seed_outline_with_chapter(db_session, project.id, chapter=rich)
    if_line = _seed_if_line(db_session, project_id=project.id)

    svc = ChapterForkService(
        ChapterRepository(db_session),
        OutlineRepository(db_session),
        db_session,
    )
    result = svc.fork(source.id, if_line.id)

    db_session.expire_all()
    new_ch = db_session.get(Chapter, result["new_chapter_id"])
    assert new_ch.sections == rich["sections"]
    assert new_ch.pacing_notes == rich["pacing_notes"]
    assert new_ch.character_dynamics == rich["character_dynamics"]
    assert new_ch.foreshadowing == rich["foreshadowing"]
    assert new_ch.summary == rich["summary"]
    assert new_ch.status == rich["status"]
    assert new_ch.word_count == rich["word_count"]
    assert new_ch.content == rich["content"]
    assert new_ch.notes == rich["notes"]
    assert new_ch.note_category == rich["note_category"]
    assert new_ch.note_pinned is True
    assert new_ch.battle_station_data == rich["battle_station_data"]
    assert new_ch.chapter_order == rich["chapter_order"]


# ---------------------------------------------------------------------------
# 5. Nonexistent source chapter → 404
# ---------------------------------------------------------------------------


def test_fork_chapter_nonexistent_chapter_raises_404(db_session):
    project = _seed_project(db_session)
    if_line = _seed_if_line(db_session, project_id=project.id)
    svc = ChapterForkService(
        ChapterRepository(db_session),
        OutlineRepository(db_session),
        db_session,
    )

    with pytest.raises(NotFoundException):
        svc.fork(9999, if_line.id)


# ---------------------------------------------------------------------------
# 6. Nonexistent IFLine → 404
# ---------------------------------------------------------------------------


def test_fork_chapter_nonexistent_if_line_raises_404(db_session):
    project = _seed_project(db_session)
    _, source = _seed_outline_with_chapter(db_session, project.id)
    svc = ChapterForkService(
        ChapterRepository(db_session),
        OutlineRepository(db_session),
        db_session,
    )

    with pytest.raises(NotFoundException):
        svc.fork(source.id, 8888)


# ---------------------------------------------------------------------------
# 7. Schema validation
# ---------------------------------------------------------------------------


def test_fork_chapter_request_missing_if_line_id():
    with pytest.raises(PydanticValidationError):
        ForkChapterRequest()  # type: ignore[call-arg]


def test_fork_chapter_request_name_is_optional():
    req = ForkChapterRequest(ifLineId=3)
    assert req.ifLineId == 3
    assert req.name is None


# ---------------------------------------------------------------------------
# 8. Optional name overrides the source chapter's title
# ---------------------------------------------------------------------------


def test_fork_chapter_uses_name_override(db_session):
    project = _seed_project(db_session)
    _, source = _seed_outline_with_chapter(
        db_session,
        project.id,
        chapter={"title": "原标题", "chapter_order": 1},
    )
    if_line = _seed_if_line(db_session, project_id=project.id)
    svc = ChapterForkService(
        ChapterRepository(db_session),
        OutlineRepository(db_session),
        db_session,
    )

    result = svc.fork(source.id, if_line.id, name="分叉标题")

    db_session.expire_all()
    new_ch = db_session.get(Chapter, result["new_chapter_id"])
    assert new_ch.title == "分叉标题"
    # Other fields still copied
    assert new_ch.chapter_order == source.chapter_order


# ---------------------------------------------------------------------------
# 9. Integration via TestClient (new chapter editable independently)
# ---------------------------------------------------------------------------


@pytest.fixture
def chapter_fork_client():
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


def test_fork_chapter_integration_happy(chapter_fork_client):
    client, db_session = chapter_fork_client
    proj = client.post("/api/v1/projects", json={"name": "integration fork chapter"}).json()
    project_id = proj["data"]["id"]

    outline = client.post(
        "/api/v1/chapters/outlines",
        json={"project_id": project_id, "title": "原大纲"},
    ).json()
    outline_id = outline["data"]["id"]

    source = client.post(
        "/api/v1/chapters",
        json={
            "project_id": project_id,
            "outline_id": outline_id,
            "title": "源章节",
            "chapter_order": 1,
            "content": "<p>源正文</p>",
        },
    ).json()
    source_id = source["data"]["id"]

    # Seed an IFLine directly via the model layer (no IFLine router yet).
    from app.models import IFLine

    if_line = IFLine(user_id="default-user", project_id=project_id, name="支线A")
    db_session.add(if_line)
    db_session.commit()
    db_session.refresh(if_line)
    if_line_id = if_line.id

    resp = client.post(
        f"/api/v1/chapters/{source_id}/fork",
        json={"ifLineId": if_line_id, "name": "分叉章节"},
    )
    assert resp.status_code == 201, resp.text
    body = resp.json()
    assert body["new_chapter_id"] != source_id
    assert body["parent_chapter_id"] == source_id
    assert body["if_line_id"] == if_line_id

    # Edit the new chapter independently — source must remain unchanged.
    new_id = body["new_chapter_id"]
    edit_resp = client.patch(
        f"/api/v1/chapters/{new_id}",
        json={"title": "已编辑的标题", "word_count": 500},
    )
    assert edit_resp.status_code == 200, edit_resp.text

    fetch_source = client.get(f"/api/v1/chapters/{source_id}").json()
    fetch_new = client.get(f"/api/v1/chapters/{new_id}").json()
    assert fetch_source["data"]["title"] == "源章节"
    assert fetch_source["data"]["word_count"] == 0
    assert fetch_new["data"]["title"] == "已编辑的标题"
    assert fetch_new["data"]["word_count"] == 500


def test_fork_chapter_integration_404_on_missing_chapter(chapter_fork_client):
    client, _ = chapter_fork_client
    proj = client.post("/api/v1/projects", json={"name": "p"}).json()
    project_id = proj["data"]["id"]

    resp = client.post(
        "/api/v1/chapters/424242/fork",
        json={"ifLineId": 1, "name": "ghost"},
    )
    assert resp.status_code == 404, resp.text
    body = resp.json()
    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"


def test_fork_chapter_integration_validation_error(chapter_fork_client):
    client, _ = chapter_fork_client
    resp = client.post(
        "/api/v1/chapters/1/fork",
        json={"name": "missing ifLineId"},
    )
    assert resp.status_code == 422, resp.text