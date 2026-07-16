"""Happy-path tests for Item CRUD."""
import time
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


# ---------------------------------------------------------------------------
# Coverage expansion (US-006): edge + error + perf + multi-user + pagination
# ---------------------------------------------------------------------------


def test_create_item_with_empty_optional_fields(db_session):
    """edge: create with only required fields; optional fields stay None."""
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    item = svc.create(ItemCreate(name="无名之物"), project_id=1)
    assert item.id is not None
    assert item.name == "无名之物"
    assert item.description is None
    assert item.owner is None
    assert item.location is None
    assert item.tags is None
    assert item.project_id == 1


def test_get_item_nonexistent_returns_none(db_session):
    """error: get for a non-existing id returns None."""
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    assert svc.get(99999) is None


def test_update_item_nonexistent_returns_none(db_session):
    """error: update for a non-existing id returns None."""
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    assert svc.update(99999, ItemUpdate(name="Ghost")) is None


def test_delete_item_nonexistent_returns_false(db_session):
    """error: delete for a non-existing id returns False."""
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    assert svc.delete(99999) is False


def test_list_items_100_entities_under_500ms(db_session):
    """performance: listing 100 items completes in under 500ms."""
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    for idx in range(100):
        svc.create(ItemCreate(name=f"物品{idx}"), project_id=1)
    started = time.perf_counter()
    items = svc.list(project_id=1)
    elapsed = time.perf_counter() - started
    assert len(items) == 100
    assert elapsed < 0.5


def test_user_id_filter_isolation(db_session):
    """multi-user: items in different projects are isolated by project_id filter.

    Item model carries project_id (not user_id) as the ownership discriminator.
    service.list(project_id=...) must only return entities from that project.
    """
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    svc.create(ItemCreate(name="A1"), project_id=1)
    svc.create(ItemCreate(name="A2"), project_id=1)
    svc.create(ItemCreate(name="B1"), project_id=2)

    a_rows = svc.list(project_id=1)
    b_rows = svc.list(project_id=2)
    assert len(a_rows) == 2
    assert len(b_rows) == 1
    assert {i.name for i in a_rows} == {"A1", "A2"}
    assert {i.name for i in b_rows} == {"B1"}
    assert all(i.project_id == 1 for i in a_rows)
    assert all(i.project_id == 2 for i in b_rows)


def test_list_items_pagination(db_session):
    """pagination: skip/limit correctly partition the result set."""
    repo = ItemRepository(db_session)
    svc = ItemService(repo)
    for idx in range(5):
        svc.create(ItemCreate(name=f"I{idx}"), project_id=1)

    page1 = svc.list(project_id=1, skip=0, limit=2)
    page2 = svc.list(project_id=1, skip=2, limit=10)
    page3 = svc.list(project_id=1, skip=10, limit=10)

    assert len(page1) == 2
    assert len(page2) == 3
    assert page3 == []
    seen = {i.id for i in page1} | {i.id for i in page2}
    assert len(seen) == 5
