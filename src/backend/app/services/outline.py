"""OutlineService: business logic for outline CRUD under a project."""
from app.models import Outline
from app.schemas.chapter import OutlineCreate, OutlineUpdate
from app.repositories.outline import OutlineRepository


class OutlineService:
    def __init__(self, repo: OutlineRepository):
        self._repo = repo

    def create(self, data: OutlineCreate, *, project_id: int) -> Outline:
        payload = data.model_dump(exclude_unset=True)
        pid = payload.pop("project_id", project_id)
        return self._repo.create(Outline(project_id=pid, **payload))

    def list(self, project_id: int | None = None, skip: int = 0, limit: int = 100) -> list[Outline]:
        return self._repo.list(project_id=project_id, skip=skip, limit=limit)

    def get(self, id: int) -> Outline | None:
        return self._repo.get(id)

    def update(self, id: int, data: OutlineUpdate) -> Outline | None:
        outline = self._repo.get(id)
        if not outline:
            return None
        return self._repo.update(outline, data.model_dump(exclude_unset=True))

    def delete(self, id: int) -> bool:
        return self._repo.delete(id)
