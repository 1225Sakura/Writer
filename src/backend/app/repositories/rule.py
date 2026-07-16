"""Rule repository: typed data access."""
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Rule


class RuleRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> Optional[Rule]:
        return self._db.query(Rule).filter(Rule.id == id).first()

    def list(
        self, project_id: int | None = None, skip: int = 0, limit: int = 100
    ) -> list[Rule]:
        q = self._db.query(Rule)
        if project_id is not None:
            q = q.filter(Rule.project_id == project_id)
        return q.offset(skip).limit(limit).all()

    def create(self, rule: Rule) -> Rule:
        self._db.add(rule)
        self._db.commit()
        self._db.refresh(rule)
        return rule

    def update(self, rule: Rule, changes: dict) -> Rule:
        for key, value in changes.items():
            setattr(rule, key, value)
        self._db.commit()
        self._db.refresh(rule)
        return rule

    def delete(self, id: int) -> bool:
        rule = self.get(id)
        if not rule:
            return False
        self._db.delete(rule)
        self._db.commit()
        return True
