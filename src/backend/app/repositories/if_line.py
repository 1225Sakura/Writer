"""IFLine repository: typed data access on top of SQLAlchemy."""
from __future__ import annotations

from typing import Optional

from sqlalchemy.orm import Session

from app.models import IFLine


class IFLineRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[IFLine]:
        return self._db.query(IFLine).filter(IFLine.id == id).first()

    def list(
        self,
        project_id: int | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> list[IFLine]:
        q = self._db.query(IFLine)
        if project_id is not None:
            q = q.filter(IFLine.project_id == project_id)
        return q.offset(skip).limit(limit).all()
