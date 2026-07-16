"""LocationService: business logic for location CRUD under a project."""
from app.models import Location
from app.schemas.settings_entities import LocationCreate, LocationUpdate
from app.repositories.location import LocationRepository

class LocationService:
    def __init__(self, repo: LocationRepository):
        self._repo = repo

    def create(self, data: LocationCreate, *, project_id: int) -> Location:
        payload = data.model_dump(exclude_unset=True, exclude={"project_id"})
        return self._repo.create(Location(project_id=project_id, **payload))

    def list(self, project_id: int | None = None, skip: int = 0, limit: int = 100) -> list[Location]:
        return self._repo.list(project_id=project_id, skip=skip, limit=limit)

    def get(self, id: int) -> Location | None:
        return self._repo.get(id)

    def update(self, id: int, data: LocationUpdate) -> Location | None:
        location = self._repo.get(id)
        if not location:
            return None
        return self._repo.update(location, data.model_dump(exclude_unset=True))

    def delete(self, id: int) -> bool:
        return self._repo.delete(id)
