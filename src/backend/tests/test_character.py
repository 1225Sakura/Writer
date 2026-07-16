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