"""Chapter repository: typed data access on top of SQLAlchemy."""
from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models import Chapter


class ChapterRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[Chapter]:
        return self._db.query(Chapter).filter(Chapter.id == id).first()

    def list(
        self,
        project_id: int | None = None,
        outline_id: int | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Chapter]:
        q = self._db.query(Chapter)
        if project_id is not None:
            q = q.filter(Chapter.project_id == project_id)
        if outline_id is not None:
            q = q.filter(Chapter.outline_id == outline_id)
        return q.offset(skip).limit(limit).all()

    def create(self, chapter: Chapter) -> Chapter:
        self._db.add(chapter)
        self._db.commit()
        self._db.refresh(chapter)
        return chapter

    def update(self, chapter: Chapter, changes: dict) -> Chapter:
        for k, v in changes.items():
            setattr(chapter, k, v)
        self._db.commit()
        self._db.refresh(chapter)
        return chapter

    def delete(self, id: int) -> bool:
        chapter = self.get(id)
        if not chapter:
            return False
        self._db.delete(chapter)
        self._db.commit()
        return True
