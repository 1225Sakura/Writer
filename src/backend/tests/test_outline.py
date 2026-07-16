"""Happy-path tests for Outline CRUD."""
from app.repositories.outline import OutlineRepository
from app.services.outline import OutlineService
from app.schemas.chapter import OutlineCreate, OutlineUpdate


def test_create_outline(db_session):
    repo = OutlineRepository(db_session)
    svc = OutlineService(repo)
    outline = svc.create(OutlineCreate(title="第一卷 起源"), project_id=1)
    assert outline.id is not None
    assert outline.title == "第一卷 起源"
    assert outline.project_id == 1


def test_list_outlines(db_session):
    repo = OutlineRepository(db_session)
    svc = OutlineService(repo)
    svc.create(OutlineCreate(title="A"), project_id=1)
    svc.create(OutlineCreate(title="B"), project_id=1)
    assert len(svc.list(project_id=1)) == 2


def test_get_outline(db_session):
    repo = OutlineRepository(db_session)
    svc = OutlineService(repo)
    o = svc.create(OutlineCreate(title="X"), project_id=1)
    fetched = svc.get(o.id)
    assert fetched.title == "X"
    assert fetched.project_id == 1


def test_update_outline(db_session):
    repo = OutlineRepository(db_session)
    svc = OutlineService(repo)
    o = svc.create(OutlineCreate(title="Old"), project_id=1)
    updated = svc.update(o.id, OutlineUpdate(title="New", description="详细大纲"))
    assert updated.title == "New"
    assert updated.description == "详细大纲"


def test_delete_outline(db_session):
    repo = OutlineRepository(db_session)
    svc = OutlineService(repo)
    o = svc.create(OutlineCreate(title="Doomed"), project_id=1)
    assert svc.delete(o.id) is True
    assert svc.get(o.id) is None
