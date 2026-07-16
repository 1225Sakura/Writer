"""Faction repository: typed data access."""
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Faction


class FactionRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[Faction]:
        return self._db.query(Faction).filter(Faction.id == id).first()

    def list(
        self, project_id: int | None = None, skip: int = 0, limit: int = 100
    ) -> list[Faction]:
        q = self._db.query(Faction)
        if project_id is not None:
            q = q.filter(Faction.project_id == project_id)
        return q.offset(skip).limit(limit).all()

    def create(self, faction: Faction) -> Faction:
        self._db.add(faction)
        self._db.commit()
        self._db.refresh(faction)
        return faction

    def update(self, faction: Faction, changes: dict) -> Faction:
        for key, value in changes.items():
            setattr(faction, key, value)
        self._db.commit()
        self._db.refresh(faction)
        return faction

    def delete(self, id: int) -> bool:
        faction = self.get(id)
        if not faction:
            return False
        self._db.delete(faction)
        self._db.commit()
        return True
