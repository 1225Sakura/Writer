"""Tests for US-017 IF-line sync endpoint with conflict detection.

Covers IFLineSyncService in isolation (happy, single conflict, multi
conflict, idempotent, missing chapter, 404s) plus a TestClient integration
check and a 50-chapter perf smoke.
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.exceptions import NotFoundException
from app.database import Base, get_db
from app.main import app
from app.models import Chapter, IFLine, Outline, Project
from app.repositories.chapter import ChapterRepository
from app.repositories.if_line import IFLineRepository
from app.repositories.outline import OutlineRepository
from app.services.if_line_sync import IFLineSyncService


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _seed_project(db_session, name: str = "sync project") -> Project:
    project = Project(name=name)
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


def _seed_outline(db_session, project_id: int, title: str = "主线") -> Outline:
    outline = Outline(project_id=project_id, title=title)
    db_session.add(outline)
    db_session.commit()
    db_session.refresh(outline)
    return outline


def _seed_chapter(
    db_session,
    *,
    project_id: int,
    outline_id: int,
    title: str = "章节",
    chapter_order: int = 1,
    content: str | None = None,
) -> Chapter:
    chapter = Chapter(
        project_id=project_id,
        outline_id=outline_id,
        title=title,
        chapter_order=chapter_order,
        content=content,
    )
    db_session.add(chapter)
    db_session.commit()
    db_session.refresh(chapter)
    return chapter


def _seed_if_line(
    db_session,
    *,
    project_id: int,
    name: str = "支线",
    fork_chapter_id: int | None = None,
) -> IFLine:
    line = IFLine(
        user_id="default-user",
        project_id=project_id,
        name=name,
        fork_chapter_id=fork_chapter_id,
    )
    db_session.add(line)
    db_session.commit()
    db_session.refresh(line)
    return line


def _make_service(db_session) -> IFLineSyncService:
    return IFLineSyncService(
        db_session,
        IFLineRepository(db_session),
        ChapterRepository(db_session),
        OutlineRepository(db_session),
    )


# ---------------------------------------------------------------------------
# 1. Happy path — base unchanged, target chapters get synced
# ---------------------------------------------------------------------------


def test_sync_happy(db_session):
    project = _seed_project(db_session)
    main_outline = _seed_outline(db_session, project.id, "主线")
    branch_outline = _seed_outline(db_session, project.id, "支线")
    chapter = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=main_outline.id,
        title="第一章",
        chapter_order=1,
        content="<p>基线正文</p>",
    )
    branch_ch = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=branch_outline.id,
        title="支线 1",
        chapter_order=1,
        content="<p>旧正文</p>",
    )
    # Two IF lines both anchored at the main chapter.
    main_line = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=chapter.id
    )
    target = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=branch_ch.id
    )

    # Fast-forward the fork timestamps so neither side appears "modified
    # after fork" — the IFLine was created in the past.
    past = datetime(2020, 1, 1, 0, 0, 0)
    main_line.created_at = past
    main_line.updated_at = past
    target.created_at = past
    target.updated_at = past
    chapter.created_at = past
    chapter.updated_at = past
    branch_ch.created_at = past
    branch_ch.updated_at = past
    db_session.commit()

    svc = _make_service(db_session)
    result = svc.sync(main_line.id, chapter.id, [target.id])

    db_session.expire_all()
    refreshed_target_ch = db_session.get(Chapter, branch_ch.id)
    assert refreshed_target_ch.content == "<p>基线正文</p>"
    assert len(result["synced"]) == 1
    assert result["synced"][0]["chapterId"] == branch_ch.id
    assert isinstance(result["synced"][0]["newRevision"], str)
    assert result["conflicts"] == []


# ---------------------------------------------------------------------------
# 2. Single conflict — target modified after fork
# ---------------------------------------------------------------------------


def test_sync_single_conflict(db_session):
    project = _seed_project(db_session)
    main_outline = _seed_outline(db_session, project.id, "主线")
    branch_outline = _seed_outline(db_session, project.id, "支线")
    base_chapter = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=main_outline.id,
        title="分叉点",
        chapter_order=1,
        content="<p>主分支新正文</p>",
    )
    branch_ch = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=branch_outline.id,
        title="支线 1",
        chapter_order=1,
        content="<p>用户修改过的支线正文</p>",
    )
    main_line = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=base_chapter.id
    )
    target = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=branch_ch.id
    )

    # Anchor all created_at in the past; branch_ch has been edited after fork.
    past = datetime(2020, 1, 1, 0, 0, 0)
    future = datetime.now() + timedelta(hours=1)
    base_chapter.created_at = past
    base_chapter.updated_at = past
    branch_ch.created_at = past
    branch_ch.updated_at = future  # target edited after fork
    main_line.created_at = past
    main_line.updated_at = past
    target.created_at = past
    target.updated_at = past
    db_session.commit()

    svc = _make_service(db_session)
    result = svc.sync(main_line.id, base_chapter.id, [target.id])

    assert result["synced"] == []
    assert len(result["conflicts"]) == 1
    assert result["conflicts"][0]["chapterId"] == branch_ch.id
    # base wasn't edited after fork; target was → "content_mismatch".
    assert result["conflicts"][0]["type"] == "content_mismatch"
    db_session.expire_all()
    assert db_session.get(Chapter, branch_ch.id).content == "<p>用户修改过的支线正文</p>"


# ---------------------------------------------------------------------------
# 3. Multiple conflicts across targets
# ---------------------------------------------------------------------------


def test_sync_multiple_conflicts(db_session):
    project = _seed_project(db_session)
    main_outline = _seed_outline(db_session, project.id, "主线")
    b1_outline = _seed_outline(db_session, project.id, "B1")
    b2_outline = _seed_outline(db_session, project.id, "B2")
    main_ch = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=main_outline.id,
        title="主章节",
        chapter_order=1,
        content="<p>新主正文</p>",
    )
    b1 = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=b1_outline.id,
        title="B1 ch1",
        chapter_order=1,
        content="<p>B1 独立编辑过</p>",
    )
    b2 = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=b2_outline.id,
        title="B2 ch1",
        chapter_order=1,
        content="<p>B2 独立编辑过</p>",
    )
    main_line = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=main_ch.id
    )
    target_a = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=b1.id
    )
    target_b = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=b2.id
    )

    past = datetime(2020, 1, 1, 0, 0, 0)
    future = datetime.now() + timedelta(hours=1)
    main_ch.created_at = past
    main_ch.updated_at = future  # base edited after fork
    b1.created_at = past
    b1.updated_at = future  # target A edited after fork → both_modified
    b2.created_at = past
    b2.updated_at = future  # target B edited after fork → both_modified
    main_line.created_at = past
    main_line.updated_at = past
    target_a.created_at = past
    target_a.updated_at = past
    target_b.created_at = past
    target_b.updated_at = past
    db_session.commit()

    svc = _make_service(db_session)
    result = svc.sync(main_line.id, main_ch.id, [target_a.id, target_b.id])

    assert result["synced"] == []
    conflict_ids = {c["chapterId"] for c in result["conflicts"]}
    assert conflict_ids == {b1.id, b2.id}
    for c in result["conflicts"]:
        assert c["type"] == "both_modified"


# ---------------------------------------------------------------------------
# 4. Idempotent — running twice with same args is a no-op the second time
# ---------------------------------------------------------------------------


def test_sync_idempotent(db_session):
    project = _seed_project(db_session)
    main_outline = _seed_outline(db_session, project.id, "主线")
    branch_outline = _seed_outline(db_session, project.id, "支线")
    chapter = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=main_outline.id,
        chapter_order=1,
        content="<p>基线</p>",
    )
    branch_ch = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=branch_outline.id,
        chapter_order=1,
        content="<p>旧</p>",
    )
    main_line = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=chapter.id
    )
    target = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=branch_ch.id
    )

    past = datetime(2020, 1, 1, 0, 0, 0)
    chapter.created_at = past
    chapter.updated_at = past
    branch_ch.created_at = past
    branch_ch.updated_at = past
    main_line.created_at = past
    main_line.updated_at = past
    target.created_at = past
    target.updated_at = past
    db_session.commit()

    svc = _make_service(db_session)
    first = svc.sync(main_line.id, chapter.id, [target.id])
    assert len(first["synced"]) == 1
    assert first["conflicts"] == []

    second = svc.sync(main_line.id, chapter.id, [target.id])
    # Second call: content already matches, no DB write, no entry in synced.
    assert second["synced"] == []
    assert second["conflicts"] == []
    db_session.expire_all()
    assert db_session.get(Chapter, branch_ch.id).content == "<p>基线</p>"


# ---------------------------------------------------------------------------
# 5. Missing chapter — target IFLine has no chapter at base's order
# ---------------------------------------------------------------------------


def test_sync_target_with_no_matching_chapter(db_session):
    project = _seed_project(db_session)
    main_outline = _seed_outline(db_session, project.id, "主线")
    empty_outline = _seed_outline(db_session, project.id, "空支线")
    chapter = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=main_outline.id,
        chapter_order=1,
        content="<p>主</p>",
    )
    # Seed a chapter at a DIFFERENT order in target's outline.
    other_ch = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=empty_outline.id,
        chapter_order=99,
        content="<p>无关章</p>",
    )
    main_line = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=chapter.id
    )
    target = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=other_ch.id
    )

    past = datetime(2020, 1, 1, 0, 0, 0)
    chapter.created_at = past
    chapter.updated_at = past
    main_line.created_at = past
    main_line.updated_at = past
    target.created_at = past
    target.updated_at = past
    db_session.commit()

    svc = _make_service(db_session)
    result = svc.sync(main_line.id, chapter.id, [target.id])

    assert result["synced"] == []
    assert len(result["conflicts"]) == 1
    assert result["conflicts"][0]["type"] == "missing_chapter"


# ---------------------------------------------------------------------------
# 6. Nonexistent IFLine → 404
# ---------------------------------------------------------------------------


def test_sync_if_line_not_found_raises_404(db_session):
    project = _seed_project(db_session)
    main_outline = _seed_outline(db_session, project.id)
    chapter = _seed_chapter(
        db_session, project_id=project.id, outline_id=main_outline.id
    )

    svc = _make_service(db_session)
    with pytest.raises(NotFoundException):
        svc.sync(99999, chapter.id, [])


# ---------------------------------------------------------------------------
# 7. Nonexistent base chapter → 404
# ---------------------------------------------------------------------------


def test_sync_base_chapter_not_found_raises_404(db_session):
    project = _seed_project(db_session)
    main_line = _seed_if_line(db_session, project_id=project.id)

    svc = _make_service(db_session)
    with pytest.raises(NotFoundException):
        svc.sync(main_line.id, 99999, [])


# ---------------------------------------------------------------------------
# 8. Empty target list — both response lists empty
# ---------------------------------------------------------------------------


def test_sync_empty_target_line_ids(db_session):
    project = _seed_project(db_session)
    main_outline = _seed_outline(db_session, project.id)
    chapter = _seed_chapter(
        db_session, project_id=project.id, outline_id=main_outline.id
    )
    main_line = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=chapter.id
    )

    svc = _make_service(db_session)
    result = svc.sync(main_line.id, chapter.id, [])

    assert result == {"synced": [], "conflicts": []}


# ---------------------------------------------------------------------------
# 9. Integration via TestClient
# ---------------------------------------------------------------------------


@pytest.fixture
def sync_client():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(
        autocommit=False, autoflush=False, bind=engine
    )
    session = session_factory()

    def override_db():
        yield session

    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as test_client:
        yield test_client, session
    app.dependency_overrides.clear()
    session.close()
    engine.dispose()


def test_sync_integration(sync_client):
    client, db_session = sync_client
    proj = client.post("/api/v1/projects", json={"name": "sync integration"}).json()
    project_id = proj["data"]["id"]

    # Seed outline + base chapter + branch chapter + lines directly.
    main_outline = Outline(project_id=project_id, title="主")
    branch_outline = Outline(project_id=project_id, title="支")
    db_session.add(main_outline)
    db_session.add(branch_outline)
    db_session.commit()
    db_session.refresh(main_outline)
    db_session.refresh(branch_outline)

    main_ch = Chapter(
        project_id=project_id,
        outline_id=main_outline.id,
        chapter_order=1,
        title="主章",
        content="<p>v2 正文</p>",
    )
    branch_ch = Chapter(
        project_id=project_id,
        outline_id=branch_outline.id,
        chapter_order=1,
        title="支章",
        content="<p>v1 旧正文</p>",
    )
    db_session.add(main_ch)
    db_session.add(branch_ch)
    db_session.commit()
    db_session.refresh(main_ch)
    db_session.refresh(branch_ch)

    main_line = IFLine(
        user_id="default-user", project_id=project_id, name="主线", fork_chapter_id=main_ch.id
    )
    branch_line = IFLine(
        user_id="default-user", project_id=project_id, name="支线", fork_chapter_id=branch_ch.id
    )
    db_session.add(main_line)
    db_session.add(branch_line)
    db_session.commit()
    db_session.refresh(main_line)
    db_session.refresh(branch_line)

    # Pin fork timestamps in the past so neither side looks "edited after".
    past = datetime(2020, 1, 1, 0, 0, 0)
    main_ch.created_at = past
    main_ch.updated_at = past
    branch_ch.created_at = past
    branch_ch.updated_at = past
    main_line.created_at = past
    main_line.updated_at = past
    branch_line.created_at = past
    branch_line.updated_at = past
    db_session.commit()

    resp = client.post(
        f"/api/v1/chapters/if-lines/{main_line.id}/sync",
        json={"baseChapterId": main_ch.id, "targetLineIds": [branch_line.id]},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert len(body["synced"]) == 1
    assert body["synced"][0]["chapterId"] == branch_ch.id
    assert isinstance(body["synced"][0]["newRevision"], str)
    assert body["conflicts"] == []


def test_sync_integration_404_on_missing_chapter(sync_client):
    client, db_session = sync_client
    project = Project(name="404 project")
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)

    line = IFLine(
        user_id="default-user", project_id=project.id, name="L"
    )
    db_session.add(line)
    db_session.commit()
    db_session.refresh(line)

    resp = client.post(
        f"/api/v1/chapters/if-lines/{line.id}/sync",
        json={"baseChapterId": 555555, "targetLineIds": []},
    )
    assert resp.status_code == 404, resp.text
    body = resp.json()
    assert body["success"] is False
    assert body["error"]["code"] == "NOT_FOUND"


# ---------------------------------------------------------------------------
# 10. Perf smoke — 50 target chapters synced in < 2s
# ---------------------------------------------------------------------------


def test_sync_perf_50_chapters(db_session):
    project = _seed_project(db_session)
    main_outline = _seed_outline(db_session, project.id, "主")
    main_ch = _seed_chapter(
        db_session,
        project_id=project.id,
        outline_id=main_outline.id,
        chapter_order=1,
        content="<p>基线</p>",
    )
    main_line = _seed_if_line(
        db_session, project_id=project.id, fork_chapter_id=main_ch.id
    )

    # 50 branch outlines, each with one chapter and one IFLine.
    target_lines: list[int] = []
    for i in range(50):
        branch_outline = Outline(project_id=project.id, title=f"B{i}")
        db_session.add(branch_outline)
        db_session.flush()
        branch_ch = Chapter(
            project_id=project.id,
            outline_id=branch_outline.id,
            chapter_order=1,
            title=f"支章 {i}",
            content="<p>旧</p>",
        )
        db_session.add(branch_ch)
        db_session.flush()
        line = IFLine(
            user_id="default-user",
            project_id=project.id,
            name=f"L{i}",
            fork_chapter_id=branch_ch.id,
        )
        db_session.add(line)
        db_session.flush()
        target_lines.append(line.id)

    past = datetime(2020, 1, 1, 0, 0, 0)
    main_line.created_at = past
    main_line.updated_at = past
    main_ch.created_at = past
    main_ch.updated_at = past
    db_session.commit()

    svc = _make_service(db_session)
    started = time.perf_counter()
    result = svc.sync(main_line.id, main_ch.id, target_lines)
    elapsed = time.perf_counter() - started

    assert elapsed < 2.0, f"50-chapter sync took {elapsed:.3f}s (>2s)"
    assert len(result["synced"]) == 50
    assert result["conflicts"] == []
