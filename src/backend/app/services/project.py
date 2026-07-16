"""ProjectService: business logic for project lifecycle."""
from app.models import Project
from app.schemas.project import ProjectCreate, ProjectUpdate
from app.repositories.project import ProjectRepository

class ProjectService:
    def __init__(self, repo: ProjectRepository):
        self._repo = repo

    def create_with_defaults(self, data: ProjectCreate) -> Project:
        """Create a new project AND its default WritingSettings row."""
        project = Project(**data.model_dump(exclude_unset=True))
        project, _ = self._repo.create_with_defaults(project)
        return project

    def list(self, skip: int = 0, limit: int = 100) -> list[Project]:
        return self._repo.list(skip=skip, limit=limit)

    def get(self, id: int) -> Project | None:
        return self._repo.get(id)

    def update(self, id: int, data: ProjectUpdate) -> Project | None:
        project = self._repo.get(id)
        if not project:
            return None
        return self._repo.update(project, data.model_dump(exclude_unset=True))

    def delete(self, id: int) -> bool:
        return self._repo.delete(id)