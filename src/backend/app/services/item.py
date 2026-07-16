"""ItemService: business logic for item CRUD under a project."""
from app.models import Item
from app.schemas.settings_entities import ItemCreate, ItemUpdate
from app.repositories.item import ItemRepository

class ItemService:
    def __init__(self, repo: ItemRepository):
        self._repo = repo

    def create(self, data: ItemCreate, *, project_id: int) -> Item:
        payload = data.model_dump(exclude_unset=True, exclude={"project_id"})
        return self._repo.create(Item(project_id=project_id, **payload))

    def list(self, project_id: int | None = None, skip: int = 0, limit: int = 100) -> list[Item]:
        return self._repo.list(project_id=project_id, skip=skip, limit=limit)

    def get(self, id: int) -> Item | None:
        return self._repo.get(id)

    def update(self, id: int, data: ItemUpdate) -> Item | None:
        item = self._repo.get(id)
        if not item:
            return None
        return self._repo.update(item, data.model_dump(exclude_unset=True))

    def delete(self, id: int) -> bool:
        return self._repo.delete(id)
