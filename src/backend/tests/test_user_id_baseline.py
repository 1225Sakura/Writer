"""Tests for the Phase 0 user_id baseline."""
from __future__ import annotations

from pathlib import Path
import time

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text

from app.config import get_settings
from app.models import (
    AIProvider,
    Chapter,
    Character,
    Draft,
    Item,
    Location,
    Outline,
    Project,
    WritingSettings,
)


USER_ID = "u-1"
PREVIOUS_REVISION = "db1188343db9"
USER_SCOPED_TABLES = (
    "projects",
    "ai_providers",
    "writing_settings",
    "outlines",
    "chapters",
    "characters",
    "items",
    "locations",
    "drafts",
)


def _project() -> Project:
    return Project(name="Project", user_id=USER_ID)


def _ai_provider() -> AIProvider:
    return AIProvider(name="MiniMax", model_name="MiniMax-M2", user_id=USER_ID)


def _writing_settings() -> WritingSettings:
    return WritingSettings(project=_project(), user_id=USER_ID)


def _outline() -> Outline:
    return Outline(project=_project(), title="Outline", user_id=USER_ID)


def _chapter() -> Chapter:
    return Chapter(project=_project(), title="Chapter", user_id=USER_ID)


def _character() -> Character:
    return Character(project=_project(), name="Character", user_id=USER_ID)


def _item() -> Item:
    return Item(project=_project(), name="Item", user_id=USER_ID)


def _location() -> Location:
    return Location(project=_project(), name="Location", user_id=USER_ID)


def _draft() -> Draft:
    chapter = Chapter(project=_project(), title="Chapter", user_id=USER_ID)
    return Draft(chapter=chapter, version_number=1, content="Draft", user_id=USER_ID)


@pytest.mark.parametrize(
    "model_factory",
    [
        pytest.param(_project, id="project"),
        pytest.param(_ai_provider, id="ai-provider"),
        pytest.param(_writing_settings, id="writing-settings"),
        pytest.param(_outline, id="outline"),
        pytest.param(_chapter, id="chapter"),
        pytest.param(_character, id="character"),
        pytest.param(_item, id="item"),
        pytest.param(_location, id="location"),
        pytest.param(_draft, id="draft"),
    ],
)
def test_user_id_round_trip_for_core_models(db_session, model_factory):
    model = model_factory()
    db_session.add(model)
    db_session.commit()
    model_id = model.id
    model_type = type(model)
    db_session.expunge_all()

    stored = db_session.get(model_type, model_id)

    assert stored is not None
    assert stored.user_id == USER_ID


def test_user_id_defaults_to_default_user(db_session):
    project = Project(name="Default owner")
    db_session.add(project)
    db_session.commit()

    assert project.user_id == "default-user"


@pytest.fixture
def alembic_db(tmp_path, monkeypatch):
    db_path = tmp_path / "user-id-baseline.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    get_settings.cache_clear()
    config = Config(str(Path(__file__).resolve().parent.parent / "alembic.ini"))
    yield config, db_path
    get_settings.cache_clear()


def test_user_id_migration_backfills_existing_rows(alembic_db):
    config, db_path = alembic_db
    command.upgrade(config, PREVIOUS_REVISION)
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO projects (name) VALUES ('Project')"))
        connection.execute(text("INSERT INTO outlines (project_id, title) VALUES (1, 'Outline')"))
        connection.execute(text("INSERT INTO chapters (project_id, title) VALUES (1, 'Chapter')"))
        connection.execute(
            text("INSERT INTO characters (project_id, name) VALUES (1, 'Character')")
        )
        connection.execute(text("INSERT INTO items (project_id, name) VALUES (1, 'Item')"))
        connection.execute(text("INSERT INTO locations (project_id, name) VALUES (1, 'Location')"))
        connection.execute(
            text(
                "INSERT INTO drafts (chapter_id, version_number, content) "
                "VALUES (1, 1, 'Draft')"
            )
        )

    command.upgrade(config, "head")

    schema = inspect(engine)
    for table_name in USER_SCOPED_TABLES:
        columns = {column["name"]: column for column in schema.get_columns(table_name)}
        assert "user_id" in columns
        assert columns["user_id"]["nullable"] is False
        assert "VARCHAR(64)" in str(columns["user_id"]["type"]).upper()

    with engine.connect() as connection:
        for table_name in ("outlines", "chapters", "characters", "items", "locations", "drafts"):
            value = connection.execute(text(f"SELECT user_id FROM {table_name}")).scalar_one()
            assert value == "default-user"
    engine.dispose()


def test_user_id_migration_under_one_second_with_9999_rows(alembic_db):
    config, db_path = alembic_db
    command.upgrade(config, PREVIOUS_REVISION)
    engine = create_engine(f"sqlite:///{db_path.as_posix()}")
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO projects (name) VALUES ('Project')"))
        connection.execute(
            text("INSERT INTO items (project_id, name) VALUES (1, :name)"),
            [{"name": f"Item {index}"} for index in range(9999)],
        )

    started_at = time.perf_counter()
    command.upgrade(config, "head")
    elapsed = time.perf_counter() - started_at

    assert elapsed < 1.0, f"user_id migration took {elapsed:.3f}s"
    with engine.connect() as connection:
        migrated = connection.execute(
            text("SELECT COUNT(*) FROM items WHERE user_id = 'default-user'")
        ).scalar_one()
    assert migrated == 9999
    engine.dispose()
