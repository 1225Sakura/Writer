"""Location repository: typed data access on top of SQLAlchemy."""
from typing import Optional
from sqlalchemy.orm import Session
from app.models import Location

class LocationRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[Location]:
        return self._db.query(Location).filter(Location.id == id).first()

    def list(self, project_id: int | None = None, skip: int = 0, limit: int = 100) -> list[Location]:
        q = self._db.query(Location)
        if project_id is not None:
            q = q.filter(Location.project_id == project_id)
        return q.offset(skip).limit(limit).all()

    def create(self, location: Location) -> Location:
        self._db.add(location)
        self._db.commit()
        self._db.refresh(location)
        return location

    def update(self, location: Location, changes: dict) -> Location:
        for k, v in changes.items():
            setattr(location, k, v)
        self._db.commit()
        self._db.refresh(location)
        return location

    def delete(self, id: int) -> bool:
        location = self.get(id)
        if not location:
            return False
        self._db.delete(location)
        self._db.commit()
        return True
