"""Character repository: typed data access."""
from typing import Optional
from sqlalchemy.orm import Session
from app.models import Character

class CharacterRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[Character]:
        return self._db.query(Character).filter(Character.id == id).first()

    def list(self, project_id: int | None = None, skip: int = 0, limit: int = 100) -> list[Character]:
        q = self._db.query(Character)
        if project_id is not None:
            q = q.filter(Character.project_id == project_id)
        return q.offset(skip).limit(limit).all()

    def create(self, character: Character) -> Character:
        self._db.add(character)
        self._db.commit()
        self._db.refresh(character)
        return character

    def update(self, character: Character, changes: dict) -> Character:
        for k, v in changes.items():
            setattr(character, k, v)
        self._db.commit()
        self._db.refresh(character)
        return character

    def delete(self, id: int) -> bool:
        character = self.get(id)
        if not character:
            return False
        self._db.delete(character)
        self._db.commit()
        return True