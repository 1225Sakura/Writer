"""Item repository: typed data access on top of SQLAlchemy."""
from typing import Optional
from sqlalchemy.orm import Session
from app.models import Item

class ItemRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[Item]:
        return self._db.query(Item).filter(Item.id == id).first()

    def list(self, project_id: int | None = None, skip: int = 0, limit: int = 100) -> list[Item]:
        q = self._db.query(Item)
        if project_id is not None:
            q = q.filter(Item.project_id == project_id)
        return q.offset(skip).limit(limit).all()

    def create(self, item: Item) -> Item:
        self._db.add(item)
        self._db.commit()
        self._db.refresh(item)
        return item

    def update(self, item: Item, changes: dict) -> Item:
        for k, v in changes.items():
            setattr(item, k, v)
        self._db.commit()
        self._db.refresh(item)
        return item

    def delete(self, id: int) -> bool:
        item = self.get(id)
        if not item:
            return False
        self._db.delete(item)
        self._db.commit()
        return True
