"""Happy-path tests for Project CRUD."""
import pytest
from app.repositories.project import ProjectRepository
from app.services.project import ProjectService
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.models import Project, WritingSettings

def test_create_project(db_session):
    repo = ProjectRepository(db_session)
    svc = ProjectService(repo)
    project = svc.create_with_defaults(ProjectCreate(name="My Novel", genre="玄幻"))
    assert project.id is not None
    assert project.name == "My Novel"
    # Auto-create WritingSettings
    settings = db_session.query(WritingSettings).filter(WritingSettings.project_id == project.id).first()
    assert settings is not None

def test_list_projects(db_session):
    repo = ProjectRepository(db_session)
    svc = ProjectService(repo)
    svc.create_with_defaults(ProjectCreate(name="A"))
    svc.create_with_defaults(ProjectCreate(name="B"))
    assert len(svc.list()) == 2

def test_get_project(db_session):
    repo = ProjectRepository(db_session)
    svc = ProjectService(repo)
    p = svc.create_with_defaults(ProjectCreate(name="X"))
    fetched = svc.get(p.id)
    assert fetched.name == "X"

def test_update_project(db_session):
    repo = ProjectRepository(db_session)
    svc = ProjectService(repo)
    p = svc.create_with_defaults(ProjectCreate(name="Old"))
    updated = svc.update(p.id, ProjectUpdate(description="Added description"))
    assert updated.description == "Added description"
    assert updated.name == "Old"

def test_delete_project(db_session):
    repo = ProjectRepository(db_session)
    svc = ProjectService(repo)
    p = svc.create_with_defaults(ProjectCreate(name="Doomed"))
    assert svc.delete(p.id) is True
    assert svc.get(p.id) is None