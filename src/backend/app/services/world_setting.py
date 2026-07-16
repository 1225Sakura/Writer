"""WorldSettingService: business logic for world-setting CRUD."""
from app.models import WorldSetting
from app.repositories.world_setting import WorldSettingRepository
from app.schemas.settings_entities import WorldSettingCreate, WorldSettingUpdate


class WorldSettingService:
    def __init__(self, repo: WorldSettingRepository):
        self._repo = repo

    def create(
        self, data: WorldSettingCreate, *, project_id: int | None = None
    ) -> WorldSetting:
        project_id = project_id if project_id is not None else 1
        payload = data.model_dump(exclude_unset=True, exclude={"project_id"})
        return self._repo.create(WorldSetting(project_id=project_id, **payload))

    def list(
        self, project_id: int | None = None, skip: int = 0, limit: int = 100
    ) -> list[WorldSetting]:
        return self._repo.list(project_id=project_id, skip=skip, limit=limit)

    def get(self, id: int) -> WorldSetting | None:
        return self._repo.get(id)

    def update(self, id: int, data: WorldSettingUpdate) -> WorldSetting | None:
        world_setting = self._repo.get(id)
        if not world_setting:
            return None
        return self._repo.update(world_setting, data.model_dump(exclude_unset=True))

    def delete(self, id: int) -> bool:
        return self._repo.delete(id)
