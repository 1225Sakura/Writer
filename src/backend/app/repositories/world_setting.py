"""World-setting repository: typed data access."""
from typing import Optional

from sqlalchemy.orm import Session

from app.models import WorldSetting


class WorldSettingRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[WorldSetting]:
        return self._db.query(WorldSetting).filter(WorldSetting.id == id).first()

    def list(
        self, project_id: int | None = None, skip: int = 0, limit: int = 100
    ) -> list[WorldSetting]:
        q = self._db.query(WorldSetting)
        if project_id is not None:
            q = q.filter(WorldSetting.project_id == project_id)
        return q.offset(skip).limit(limit).all()

    def create(self, world_setting: WorldSetting) -> WorldSetting:
        self._db.add(world_setting)
        self._db.commit()
        self._db.refresh(world_setting)
        return world_setting

    def update(self, world_setting: WorldSetting, changes: dict) -> WorldSetting:
        for key, value in changes.items():
            setattr(world_setting, key, value)
        self._db.commit()
        self._db.refresh(world_setting)
        return world_setting

    def delete(self, id: int) -> bool:
        world_setting = self.get(id)
        if not world_setting:
            return False
        self._db.delete(world_setting)
        self._db.commit()
        return True
