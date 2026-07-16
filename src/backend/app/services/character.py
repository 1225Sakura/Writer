"""CharacterService: business logic for character CRUD."""
from app.models import Character
from app.schemas.character import CharacterCreate, CharacterUpdate
from app.repositories.character import CharacterRepository

class CharacterService:
    def __init__(self, repo: CharacterRepository):
        self._repo = repo

    def create(self, data: CharacterCreate) -> Character:
        return self._repo.create(Character(**data.model_dump(exclude_unset=True)))

    def list(self, project_id: int | None = None, skip: int = 0, limit: int = 100) -> list[Character]:
        return self._repo.list(project_id=project_id, skip=skip, limit=limit)

    def get(self, id: int) -> Character | None:
        return self._repo.get(id)

    def update(self, id: int, data: CharacterUpdate) -> Character | None:
        character = self._repo.get(id)
        if not character:
            return None
        return self._repo.update(character, data.model_dump(exclude_unset=True))

    def delete(self, id: int) -> bool:
        return self._repo.delete(id)