"""Happy-path tests for Location CRUD."""
import time
from app.repositories.location import LocationRepository
from app.services.location import LocationService
from app.schemas.settings_entities import LocationCreate, LocationUpdate

def test_create_location(db_session):
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    loc = svc.create(LocationCreate(name="青云峰"), project_id=1)
    assert loc.id is not None
    assert loc.name == "青云峰"
    assert loc.importance == "normal"

def test_list_locations(db_session):
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    svc.create(LocationCreate(name="A"), project_id=1)
    svc.create(LocationCreate(name="B"), project_id=1)
    assert len(svc.list(project_id=1)) == 2

def test_get_location(db_session):
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    l = svc.create(LocationCreate(name="X"), project_id=1)
    fetched = svc.get(l.id)
    assert fetched.name == "X"

def test_update_location(db_session):
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    l = svc.create(LocationCreate(name="Old"), project_id=1)
    updated = svc.update(l.id, LocationUpdate(importance="major"))
    assert updated.importance == "major"
    assert updated.name == "Old"

def test_delete_location(db_session):
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    l = svc.create(LocationCreate(name="Doomed"), project_id=1)
    assert svc.delete(l.id) is True
    assert svc.get(l.id) is None


# ---------------------------------------------------------------------------
# Coverage expansion (US-006): edge + error + perf + multi-user + pagination
# ---------------------------------------------------------------------------


def test_create_location_with_empty_optional_fields(db_session):
    """edge: create with only required fields; importance=normal default, rest=None."""
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    loc = svc.create(LocationCreate(name="无名之地"), project_id=1)
    assert loc.id is not None
    assert loc.name == "无名之地"
    assert loc.importance == "normal"
    assert loc.description is None
    assert loc.tags is None
    assert loc.project_id == 1


def test_get_location_nonexistent_returns_none(db_session):
    """error: get for a non-existing id returns None."""
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    assert svc.get(99999) is None


def test_update_location_nonexistent_returns_none(db_session):
    """error: update for a non-existing id returns None."""
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    assert svc.update(99999, LocationUpdate(name="Ghost")) is None


def test_delete_location_nonexistent_returns_false(db_session):
    """error: delete for a non-existing id returns False."""
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    assert svc.delete(99999) is False


def test_list_locations_100_entities_under_500ms(db_session):
    """performance: listing 100 locations completes in under 500ms."""
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    for idx in range(100):
        svc.create(LocationCreate(name=f"地点{idx}"), project_id=1)
    started = time.perf_counter()
    items = svc.list(project_id=1)
    elapsed = time.perf_counter() - started
    assert len(items) == 100
    assert elapsed < 0.5


def test_user_id_filter_isolation(db_session):
    """multi-user: locations in different projects are isolated by project_id filter.

    Location model carries project_id (not user_id) as the ownership discriminator.
    service.list(project_id=...) must only return entities from that project.
    """
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    svc.create(LocationCreate(name="A1"), project_id=1)
    svc.create(LocationCreate(name="A2"), project_id=1)
    svc.create(LocationCreate(name="B1"), project_id=2)

    a_rows = svc.list(project_id=1)
    b_rows = svc.list(project_id=2)
    assert len(a_rows) == 2
    assert len(b_rows) == 1
    assert {l.name for l in a_rows} == {"A1", "A2"}
    assert {l.name for l in b_rows} == {"B1"}
    assert all(l.project_id == 1 for l in a_rows)
    assert all(l.project_id == 2 for l in b_rows)


def test_list_locations_pagination(db_session):
    """pagination: skip/limit correctly partition the result set."""
    repo = LocationRepository(db_session)
    svc = LocationService(repo)
    for idx in range(5):
        svc.create(LocationCreate(name=f"L{idx}"), project_id=1)

    page1 = svc.list(project_id=1, skip=0, limit=2)
    page2 = svc.list(project_id=1, skip=2, limit=10)
    page3 = svc.list(project_id=1, skip=10, limit=10)

    assert len(page1) == 2
    assert len(page2) == 3
    assert page3 == []
    seen = {l.id for l in page1} | {l.id for l in page2}
    assert len(seen) == 5
