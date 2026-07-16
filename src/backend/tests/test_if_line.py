"""Tests for US-014: IFLine model, schemas, relationships, and migration."""
from __future__ import annotations

import os
import tempfile
import time
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, inspect, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import get_settings
from app.database import Base, get_db
from app.main import app
from app.models import Chapter, IFLine, Project
from app.schemas.if_line import IFLineCreate, IFLineOut, IFLineUpdate


def _create_project(db_session, name: str = "IFLine project") -> Project:
    project = Project(name=name)
    db_session.add(project)
    db_session.commit()
    db_session.refresh(project)
    return project


def _create_if_line(db_session, *, project_id: int, name: str = "主线", **values) -> IFLine:
    data = IFLineCreate(project_id=project_id, name=name, **values)
    if_line = IFLine(**data.model_dump())
    db_session.add(if_line)
    db_session.commit()
    db_session.refresh(if_line)
    return if_line


def test_create_if_line(db_session):
    project = _create_project(db_session)

    if_line = _create_if_line(db_session, project_id=project.id, name="魔道支线")

    assert if_line.id is not None
    assert if_line.user_id == "default-user"
    assert if_line.project_id == project.id
    assert if_line.name == "魔道支线"
    assert if_line.parent_line_id is None
    assert if_line.fork_chapter_id is None
    assert if_line.content is None
    assert if_line.created_at is not None
    assert if_line.updated_at is not None


def test_list_if_lines_by_project(db_session):
    project_a = _create_project(db_session, "A")
    project_b = _create_project(db_session, "B")
    _create_if_line(db_session, project_id=project_a.id, name="A-主线")
    _create_if_line(db_session, project_id=project_a.id, name="A-支线")
    _create_if_line(db_session, project_id=project_b.id, name="B-主线")

    rows = db_session.query(IFLine).filter(IFLine.project_id == project_a.id).all()

    assert [row.name for row in rows] == ["A-主线", "A-支线"]


def test_get_if_line_by_id(db_session):
    project = _create_project(db_session)
    created = _create_if_line(db_session, project_id=project.id, name="可检索支线")

    fetched = db_session.get(IFLine, created.id)

    assert fetched is not None
    assert fetched.id == created.id
    assert fetched.name == "可检索支线"


def test_update_if_line(db_session):
    project = _create_project(db_session)
    if_line = _create_if_line(db_session, project_id=project.id, name="旧名称")
    changes = IFLineUpdate(name="新名称", content={"status": "diverged"})

    for field, value in changes.model_dump(exclude_unset=True).items():
        setattr(if_line, field, value)
    db_session.commit()
    db_session.refresh(if_line)

    assert if_line.name == "新名称"
    assert if_line.content == {"status": "diverged"}


def test_delete_if_line(db_session):
    project = _create_project(db_session)
    if_line = _create_if_line(db_session, project_id=project.id, name="待删除支线")
    if_line_id = if_line.id

    db_session.delete(if_line)
    db_session.commit()

    assert db_session.get(IFLine, if_line_id) is None


def test_if_line_self_referential_parent_line_id(db_session):
    project = _create_project(db_session)
    parent = _create_if_line(db_session, project_id=project.id, name="父线")
    child = _create_if_line(
        db_session,
        project_id=project.id,
        name="子线",
        parent_line_id=parent.id,
    )
    db_session.expire_all()

    fetched_child = db_session.get(IFLine, child.id)
    fetched_parent = db_session.get(IFLine, parent.id)

    assert fetched_child is not None
    assert fetched_child.parent_line_id == parent.id
    assert fetched_child.parent.id == parent.id
    assert [line.id for line in fetched_parent.children] == [child.id]


def test_if_line_parent_delete_sets_child_null(db_session):
    db_session.execute(text("PRAGMA foreign_keys=ON"))
    project = _create_project(db_session)
    parent = _create_if_line(db_session, project_id=project.id, name="父线")
    child = _create_if_line(
        db_session,
        project_id=project.id,
        name="保留的子线",
        parent_line_id=parent.id,
    )
    child_id = child.id

    db_session.delete(parent)
    db_session.commit()
    db_session.expire_all()

    fetched_child = db_session.get(IFLine, child_id)
    assert fetched_child is not None
    assert fetched_child.parent_line_id is None
    assert fetched_child.parent is None


def test_if_line_cascade_delete_with_project(db_session):
    db_session.execute(text("PRAGMA foreign_keys=ON"))
    project = _create_project(db_session)
    if_line = _create_if_line(db_session, project_id=project.id, name="随项目删除")
    if_line_id = if_line.id

    db_session.execute(delete(Project).where(Project.id == project.id))
    db_session.commit()
    db_session.expire_all()

    assert db_session.get(IFLine, if_line_id) is None


def test_if_line_content_json_storage(db_session):
    project = _create_project(db_session)
    content = {
        "state": {"chapter": 7, "flags": ["救下师妹", "暴露身份"]},
        "characters": {"林澈": {"alive": True, "realm": "金丹"}},
        "notes": ["与主线共享前三章", {"conflict": None}],
    }

    if_line = _create_if_line(
        db_session,
        project_id=project.id,
        name="复杂状态支线",
        content=content,
    )
    db_session.expire_all()

    assert db_session.get(IFLine, if_line.id).content == content


def test_if_line_fork_chapter_fk(db_session):
    db_session.execute(text("PRAGMA foreign_keys=ON"))
    project = _create_project(db_session)
    chapter = Chapter(project_id=project.id, title="分叉点")
    db_session.add(chapter)
    db_session.commit()
    db_session.refresh(chapter)

    if_line = _create_if_line(
        db_session,
        project_id=project.id,
        name="章节分叉线",
        fork_chapter_id=chapter.id,
    )
    db_session.expire_all()

    fetched = db_session.get(IFLine, if_line.id)
    assert fetched.fork_chapter_id == chapter.id
    assert fetched.fork_chapter.id == chapter.id
    assert fetched.fork_chapter.title == "分叉点"


def test_if_line_fork_chapter_delete_sets_null(db_session):
    db_session.execute(text("PRAGMA foreign_keys=ON"))
    project = _create_project(db_session)
    chapter = Chapter(project_id=project.id, title="临时分叉点")
    db_session.add(chapter)
    db_session.commit()
    db_session.refresh(chapter)
    if_line = _create_if_line(
        db_session,
        project_id=project.id,
        name="保留的章节分叉线",
        fork_chapter_id=chapter.id,
    )
    if_line_id = if_line.id

    db_session.delete(chapter)
    db_session.commit()
    db_session.expire_all()

    fetched = db_session.get(IFLine, if_line_id)
    assert fetched is not None
    assert fetched.fork_chapter_id is None
    assert fetched.fork_chapter is None


@pytest.fixture
def if_line_client():
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


def test_if_line_integration(if_line_client):
    client, db_session = if_line_client
    project_response = client.post("/api/v1/projects", json={"name": "IFLine 集成项目"})
    assert project_response.status_code == 200
    project_id = project_response.json()["data"]["id"]

    chapter_response = client.post(
        "/api/v1/chapters",
        json={"project_id": project_id, "title": "共同章节"},
    )
    assert chapter_response.status_code == 200
    chapter_id = chapter_response.json()["data"]["id"]

    parent = _create_if_line(db_session, project_id=project_id, name="原时间线")
    child = _create_if_line(
        db_session,
        project_id=project_id,
        name="选择另一条路",
        parent_line_id=parent.id,
        fork_chapter_id=chapter_id,
        content={"choice": "拒绝入宗"},
    )
    db_session.expire_all()

    fetched = db_session.get(IFLine, child.id)
    output = IFLineOut.model_validate(fetched)
    assert output.project_id == project_id
    assert output.parent_line_id == parent.id
    assert output.fork_chapter_id == chapter_id
    assert fetched.parent.id == parent.id
    assert fetched.fork_chapter.id == chapter_id
    assert client.get(f"/api/v1/chapters/{chapter_id}").status_code == 200


@pytest.fixture
def alembic_database(monkeypatch):
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as file:
        database_path = file.name
    database_url = f"sqlite:///{database_path}"
    monkeypatch.setenv("DATABASE_URL", database_url)
    get_settings.cache_clear()
    config = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))

    yield config, database_url

    get_settings.cache_clear()
    try:
        os.unlink(database_path)
    except OSError:
        pass


def test_alembic_upgrade_0005(alembic_database):
    config, database_url = alembic_database
    command.upgrade(config, "head")

    engine = create_engine(database_url)
    inspector = inspect(engine)
    assert "if_lines" in inspector.get_table_names()

    columns = {column["name"]: column for column in inspector.get_columns("if_lines")}
    assert set(columns) == {
        "id",
        "user_id",
        "project_id",
        "name",
        "parent_line_id",
        "fork_chapter_id",
        "content",
        "created_at",
        "updated_at",
    }
    assert columns["user_id"]["nullable"] is False
    assert "default-user" in (columns["user_id"].get("default") or "")
    assert columns["parent_line_id"]["nullable"] is True
    assert columns["fork_chapter_id"]["nullable"] is True
    assert "JSON" in str(columns["content"]["type"]).upper()

    index_names = {index["name"] for index in inspector.get_indexes("if_lines")}
    assert {
        "ix_if_lines_user_id",
        "ix_if_lines_project_id",
        "ix_if_lines_parent_line_id",
    } <= index_names

    foreign_keys = {
        fk["constrained_columns"][0]: fk for fk in inspector.get_foreign_keys("if_lines")
    }
    assert foreign_keys["project_id"]["referred_table"] == "projects"
    assert foreign_keys["project_id"]["options"]["ondelete"] == "CASCADE"
    assert foreign_keys["parent_line_id"]["referred_table"] == "if_lines"
    assert foreign_keys["parent_line_id"]["options"]["ondelete"] == "SET NULL"
    assert foreign_keys["fork_chapter_id"]["referred_table"] == "chapters"
    assert foreign_keys["fork_chapter_id"]["options"]["ondelete"] == "SET NULL"
    engine.dispose()


def test_alembic_downgrade_0005(alembic_database):
    config, database_url = alembic_database
    command.upgrade(config, "head")
    command.downgrade(config, "533e9c5d9e10")

    engine = create_engine(database_url)
    assert "if_lines" not in inspect(engine).get_table_names()
    engine.dispose()


def test_alembic_0005_perf_under_1s(alembic_database):
    config, _ = alembic_database
    command.upgrade(config, "533e9c5d9e10")

    started = time.perf_counter()
    command.upgrade(config, "head")
    elapsed = time.perf_counter() - started

    assert elapsed < 1.0, f"alembic 0005 upgrade took {elapsed:.3f}s (>1s)"
