"""Rule CRUD and router performance tests."""
import time

from app.repositories.rule import RuleRepository
from app.schemas.settings_entities import RuleCreate, RuleUpdate
from app.services.rule import RuleService


def test_create_rule(db_session):
    svc = RuleService(RuleRepository(db_session))
    rule = svc.create(RuleCreate(project_id=1, name="灵力守恒", rule_type="magic"))
    assert rule.id is not None
    assert rule.name == "灵力守恒"
    assert rule.user_id == "default-user"


def test_list_rules(db_session):
    svc = RuleService(RuleRepository(db_session))
    svc.create(RuleCreate(project_id=1, name="A"))
    svc.create(RuleCreate(project_id=1, name="B"))
    assert len(svc.list(project_id=1)) == 2


def test_get_rule(db_session):
    svc = RuleService(RuleRepository(db_session))
    rule = svc.create(RuleCreate(project_id=1, name="X"))
    fetched = svc.get(rule.id)
    assert fetched is not None
    assert fetched.name == "X"


def test_update_rule(db_session):
    svc = RuleService(RuleRepository(db_session))
    rule = svc.create(RuleCreate(project_id=1, name="旧规则"))
    updated = svc.update(rule.id, RuleUpdate(description="新的描述"))
    assert updated is not None
    assert updated.description == "新的描述"
    assert updated.name == "旧规则"


def test_delete_rule(db_session):
    svc = RuleService(RuleRepository(db_session))
    rule = svc.create(RuleCreate(project_id=1, name="待删除"))
    assert svc.delete(rule.id) is True
    assert svc.get(rule.id) is None


def test_rule_router_list_performance(client, db_session):
    svc = RuleService(RuleRepository(db_session))
    for index in range(100):
        svc.create(RuleCreate(project_id=1, name=f"Rule {index}"))

    started = time.perf_counter()
    response = client.get("/api/v1/settings/rules?project_id=1")
    elapsed = time.perf_counter() - started

    assert response.status_code == 200
    assert len(response.json()["data"]) == 100
    assert elapsed < 0.5
