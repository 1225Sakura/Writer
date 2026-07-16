"""Happy-path tests for Chapter CRUD."""
from app.repositories.chapter import ChapterRepository
from app.services.chapter import ChapterService
from app.schemas.chapter import ChapterCreate, ChapterUpdate


def test_create_chapter(db_session):
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    ch = svc.create(ChapterCreate(title="第一章 初出茅庐", outline_id=None), project_id=1)
    assert ch.id is not None
    assert ch.title == "第一章 初出茅庐"
    assert ch.project_id == 1


def test_list_chapters(db_session):
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    svc.create(ChapterCreate(title="A"), project_id=1)
    svc.create(ChapterCreate(title="B"), project_id=1)
    assert len(svc.list(project_id=1)) == 2


def test_get_chapter(db_session):
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    ch = svc.create(ChapterCreate(title="X"), project_id=1)
    fetched = svc.get(ch.id)
    assert fetched.title == "X"
    assert fetched.project_id == 1


def test_update_chapter(db_session):
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    ch = svc.create(ChapterCreate(title="Old"), project_id=1)
    updated = svc.update(ch.id, ChapterUpdate(title="New", word_count=1500))
    assert updated.title == "New"
    assert updated.word_count == 1500


def test_delete_chapter(db_session):
    repo = ChapterRepository(db_session)
    svc = ChapterService(repo)
    ch = svc.create(ChapterCreate(title="Doomed"), project_id=1)
    assert svc.delete(ch.id) is True
    assert svc.get(ch.id) is None
