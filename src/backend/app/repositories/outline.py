"""Outline repository: typed data access on top of SQLAlchemy."""
from typing import Optional
from sqlalchemy.orm import Session
from app.models import Outline


class OutlineRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[Outline]:
        return self._db.query(Outline).filter(Outline.id == id).first()

    def list(self, project_id: int | None = None, skip: int = 0, limit: int = 100) -> list[Outline]:
        q = self._db.query(Outline)
        if project_id is not None:
            q = q.filter(Outline.project_id == project_id)
        return q.offset(skip).limit(limit).all()

    def create(self, outline: Outline) -> Outline:
        self._db.add(outline)
        self._db.commit()
        self._db.refresh(outline)
        return outline

    def update(self, outline: Outline, changes: dict) -> Outline:
        for k, v in changes.items():
            setattr(outline, k, v)
        self._db.commit()
        self._db.refresh(outline)
        return outline

    def delete(self, id: int) -> bool:
        outline = self.get(id)
        if not outline:
            return False
        self._db.delete(outline)
        self._db.commit()
        return True
