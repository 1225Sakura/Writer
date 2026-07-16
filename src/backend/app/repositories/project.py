"""Project repository: typed data access on top of SQLAlchemy."""
from typing import Optional
from sqlalchemy.orm import Session
from app.models import Project, WritingSettings

class ProjectRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[Project]:
        return self._db.query(Project).filter(Project.id == id).first()

    def list(self, skip: int = 0, limit: int = 100) -> list[Project]:
        return self._db.query(Project).offset(skip).limit(limit).all()

    def create(self, project: Project) -> Project:
        self._db.add(project)
        self._db.commit()
        self._db.refresh(project)
        return project

    def create_with_defaults(self, project: Project) -> tuple[Project, WritingSettings]:
        """Atomic: create project + auto-create sibling WritingSettings row."""
        self._db.add(project)
        self._db.flush()
        settings = WritingSettings(project_id=project.id)
        self._db.add(settings)
        self._db.commit()
        self._db.refresh(project)
        self._db.refresh(settings)
        return project, settings

    def update(self, project: Project, changes: dict) -> Project:
        for k, v in changes.items():
            setattr(project, k, v)
        self._db.commit()
        self._db.refresh(project)
        return project

    def delete(self, id: int) -> bool:
        project = self.get(id)
        if not project:
            return False
        self._db.delete(project)
        self._db.commit()
        return True