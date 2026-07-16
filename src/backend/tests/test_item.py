"""Happy-path tests for Item CRUD."""
from app.repositories.item import ItemRepository
from app.services.item import ItemService
from app.schemas.settings_entities import ItemCreate, ItemUpdate

def test_create_item(db_session):
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    item = svc.create(ItemCreate(name="玄铁剑"), project_id=1)
    assert item.id is not None
    assert item.name == "玄铁剑"

def test_list_items(db_session):
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    svc.create(ItemCreate(name="A"), project_id=1)
    svc.create(ItemCreate(name="B"), project_id=1)
    assert len(svc.list(project_id=1)) == 2

def test_get_item(db_session):
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    i = svc.create(ItemCreate(name="X"), project_id=1)
    fetched = svc.get(i.id)
    assert fetched.name == "X"

def test_update_item(db_session):
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    i = svc.create(ItemCreate(name="Old"), project_id=1)
    updated = svc.update(i.id, ItemUpdate(description="一柄短剑"))
    assert updated.description == "一柄短剑"
    assert updated.name == "Old"

def test_delete_item(db_session):
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    i = svc.create(ItemCreate(name="Doomed"), project_id=1)
    assert svc.delete(i.id) is True
    assert svc.get(i.id) is None
