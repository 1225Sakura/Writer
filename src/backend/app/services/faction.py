"""FactionService: business logic for faction CRUD under a project."""
from app.models import Faction
from app.repositories.faction import FactionRepository
from app.schemas.settings_entities import FactionCreate, FactionUpdate


class FactionService:
    def __init__(self, repo: FactionRepository):
        self._repo = repo

    def create(self, data: FactionCreate, *, project_id: int | None = None) -> Faction:
        project_id = project_id if project_id is not None else 1
        payload = data.model_dump(exclude_unset=True, exclude={"project_id"})
        return self._repo.create(Faction(project_id=project_id, **payload))

    def list(
        self, project_id: int | None = None, skip: int = 0, limit: int = 100
    ) -> list[Faction]:
        return self._repo.list(project_id=project_id, skip=skip, limit=limit)

    def get(self, id: int) -> Faction | None:
        return self._repo.get(id)

    def update(self, id: int, data: FactionUpdate) -> Faction | None:
        faction = self._repo.get(id)
        if not faction:
            return None
        return self._repo.update(faction, data.model_dump(exclude_unset=True))

    def delete(self, id: int) -> bool:
        return self._repo.delete(id)
