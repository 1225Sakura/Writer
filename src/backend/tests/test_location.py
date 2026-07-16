"""Happy-path tests for Location CRUD."""
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
