"""World-setting CRUD and router performance tests."""
import time

from app.repositories.world_setting import WorldSettingRepository
from app.schemas.settings_entities import WorldSettingCreate, WorldSettingUpdate
from app.services.world_setting import WorldSettingService


def test_create_world_setting(db_session):
    svc = WorldSettingService(WorldSettingRepository(db_session))
    setting = svc.create(
        WorldSettingCreate(project_id=1, name="九州地理", category="geography")
    )
    assert setting.id is not None
    assert setting.name == "九州地理"
    assert setting.user_id == "default-user"


def test_list_world_settings(db_session):
    svc = WorldSettingService(WorldSettingRepository(db_session))
    svc.create(WorldSettingCreate(project_id=1, name="A"))
    svc.create(WorldSettingCreate(project_id=1, name="B"))
    assert len(svc.list(project_id=1)) == 2


def test_get_world_setting(db_session):
    svc = WorldSettingService(WorldSettingRepository(db_session))
    setting = svc.create(WorldSettingCreate(project_id=1, name="X"))
    fetched = svc.get(setting.id)
    assert fetched is not None
    assert fetched.name == "X"


def test_update_world_setting(db_session):
    svc = WorldSettingService(WorldSettingRepository(db_session))
    setting = svc.create(WorldSettingCreate(project_id=1, name="旧设定"))
    updated = svc.update(setting.id, WorldSettingUpdate(description="新的描述"))
    assert updated is not None
    assert updated.description == "新的描述"
    assert updated.name == "旧设定"


def test_delete_world_setting(db_session):
    svc = WorldSettingService(WorldSettingRepository(db_session))
    setting = svc.create(WorldSettingCreate(project_id=1, name="待删除"))
    assert svc.delete(setting.id) is True
    assert svc.get(setting.id) is None


def test_world_setting_router_list_performance(client, db_session):
    svc = WorldSettingService(WorldSettingRepository(db_session))
    for index in range(100):
        svc.create(WorldSettingCreate(project_id=1, name=f"Setting {index}"))

    started = time.perf_counter()
    response = client.get("/api/v1/settings/world-settings?project_id=1")
    elapsed = time.perf_counter() - started

    assert response.status_code == 200
    assert len(response.json()["data"]) == 100
    assert elapsed < 0.5
