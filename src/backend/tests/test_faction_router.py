"""Faction CRUD and router performance tests."""
import time

from app.repositories.faction import FactionRepository
from app.schemas.settings_entities import FactionCreate, FactionUpdate
from app.services.faction import FactionService


def test_create_faction(db_session):
    svc = FactionService(FactionRepository(db_session))
    faction = svc.create(FactionCreate(project_id=1, name="青云宗", type="sect"))
    assert faction.id is not None
    assert faction.name == "青云宗"
    assert faction.user_id == "default-user"


def test_list_factions(db_session):
    svc = FactionService(FactionRepository(db_session))
    svc.create(FactionCreate(project_id=1, name="A"))
    svc.create(FactionCreate(project_id=1, name="B"))
    assert len(svc.list(project_id=1)) == 2


def test_get_faction(db_session):
    svc = FactionService(FactionRepository(db_session))
    faction = svc.create(FactionCreate(project_id=1, name="X"))
    fetched = svc.get(faction.id)
    assert fetched is not None
    assert fetched.name == "X"


def test_update_faction(db_session):
    svc = FactionService(FactionRepository(db_session))
    faction = svc.create(FactionCreate(project_id=1, name="旧势力"))
    updated = svc.update(faction.id, FactionUpdate(description="新的描述"))
    assert updated is not None
    assert updated.description == "新的描述"
    assert updated.name == "旧势力"


def test_delete_faction(db_session):
    svc = FactionService(FactionRepository(db_session))
    faction = svc.create(FactionCreate(project_id=1, name="待删除"))
    assert svc.delete(faction.id) is True
    assert svc.get(faction.id) is None


def test_faction_router_list_performance(client, db_session):
    svc = FactionService(FactionRepository(db_session))
    for index in range(100):
        svc.create(FactionCreate(project_id=1, name=f"Faction {index}"))

    started = time.perf_counter()
    response = client.get("/api/v1/settings/factions?project_id=1")
    elapsed = time.perf_counter() - started

    assert response.status_code == 200
    assert len(response.json()["data"]) == 100
    assert elapsed < 0.5
