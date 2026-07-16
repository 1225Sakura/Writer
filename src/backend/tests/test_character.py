"""Happy-path tests for Character CRUD via factory."""
import pytest
from app.repositories.character import CharacterRepository
from app.services.character import CharacterService
from app.schemas.character import CharacterCreate, CharacterUpdate

def test_create_character(db_session):
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    char = svc.create(CharacterCreate(project_id=1, name="林远图"))
    assert char.id is not None
    assert char.name == "林远图"

def test_list_characters(db_session):
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    svc.create(CharacterCreate(project_id=1, name="A"))
    svc.create(CharacterCreate(project_id=1, name="B"))
    assert len(svc.list(project_id=1)) == 2

def test_get_character(db_session):
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    c = svc.create(CharacterCreate(project_id=1, name="X"))
    fetched = svc.get(c.id)
    assert fetched.name == "X"

def test_update_character(db_session):
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    c = svc.create(CharacterCreate(project_id=1, name="Old"))
    updated = svc.update(c.id, CharacterUpdate(description="主角"))
    assert updated.description == "主角"

def test_delete_character(db_session):
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    c = svc.create(CharacterCreate(project_id=1, name="Doomed"))
    assert svc.delete(c.id) is True
    assert svc.get(c.id) is None


# ---------------------------------------------------------------------------
# Coverage expansion (US-006): edge + error + perf + multi-user + pagination
# ---------------------------------------------------------------------------
import time


def test_create_character_with_empty_optional_fields(db_session):
    """edge: create with only required fields; optional fields use defaults."""
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    char = svc.create(CharacterCreate(project_id=1, name="无名侠客"))
    assert char.id is not None
    assert char.name == "无名侠客"
    assert char.tier == "supporting"
    assert char.gender is None
    assert char.personality is None
    assert char.desires is None
    assert char.flaws is None
    assert char.description is None
    assert char.cultivation_realm is None


def test_get_character_nonexistent_returns_none(db_session):
    """error: get for a non-existing id returns None."""
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    assert svc.get(99999) is None


def test_update_character_nonexistent_returns_none(db_session):
    """error: update for a non-existing id returns None."""
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    assert svc.update(99999, CharacterUpdate(name="Ghost")) is None


def test_delete_character_nonexistent_returns_false(db_session):
    """error: delete for a non-existing id returns False."""
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    assert svc.delete(99999) is False


def test_list_characters_100_entities_under_500ms(db_session):
    """performance: listing 100 entities completes in under 500ms."""
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    for idx in range(100):
        svc.create(CharacterCreate(project_id=1, name=f"角色{idx}"))
    started = time.perf_counter()
    items = svc.list(project_id=1)
    elapsed = time.perf_counter() - started
    assert len(items) == 100
    assert elapsed < 0.5


def test_user_id_filter_isolation(db_session):
    """multi-user: characters in different projects are isolated by project_id filter.

    Character/Item/Location models carry project_id (not user_id) as the
    ownership discriminator. Two distinct project_ids emulate two different
    users; service.list(project_id=...) must only return entities from
    that project.
    """
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    # project 1 = "user A"
    svc.create(CharacterCreate(project_id=1, name="A1"))
    svc.create(CharacterCreate(project_id=1, name="A2"))
    # project 2 = "user B"
    svc.create(CharacterCreate(project_id=2, name="B1"))

    a_rows = svc.list(project_id=1)
    b_rows = svc.list(project_id=2)
    assert len(a_rows) == 2
    assert len(b_rows) == 1
    assert {c.name for c in a_rows} == {"A1", "A2"}
    assert {c.name for c in b_rows} == {"B1"}
    # cross-check via raw SQL: project 1 rows must never appear in project 2 list
    assert all(c.project_id == 1 for c in a_rows)
    assert all(c.project_id == 2 for c in b_rows)


def test_list_characters_pagination(db_session):
    """pagination: skip/limit correctly partition the result set."""
    repo = CharacterRepository(db_session)
    svc = CharacterService(repo)
    for idx in range(5):
        svc.create(CharacterCreate(project_id=1, name=f"C{idx}"))

    page1 = svc.list(project_id=1, skip=0, limit=2)
    page2 = svc.list(project_id=1, skip=2, limit=10)
    page3 = svc.list(project_id=1, skip=10, limit=10)

    assert len(page1) == 2
    assert len(page2) == 3
    assert page3 == []
    # Combined pages 1+2 should equal full set (5 distinct ids)
    seen = {c.id for c in page1} | {c.id for c in page2}
    assert len(seen) == 5