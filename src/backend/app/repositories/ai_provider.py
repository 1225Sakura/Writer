"""AI provider repository: typed SQLAlchemy data access."""
from sqlalchemy.orm import Session

from app.models import AIProvider


class AIProviderRepository:
    def __init__(self, db: Session):
        self._db = db

    def get(self, id: int) -> AIProvider | None:
        return self._db.query(AIProvider).filter(AIProvider.id == id).first()

    def list(self, skip: int = 0, limit: int = 100) -> list[AIProvider]:
        return (
            self._db.query(AIProvider)
            .order_by(AIProvider.id.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )

    def create(self, provider: AIProvider) -> AIProvider:
        self._db.add(provider)
        self._db.commit()
        self._db.refresh(provider)
        return provider

    def update(self, provider: AIProvider, changes: dict) -> AIProvider:
        for key, value in changes.items():
            setattr(provider, key, value)
        self._db.commit()
        self._db.refresh(provider)
        return provider

    def delete(self, id: int) -> bool:
        provider = self.get(id)
        if not provider:
            return False
        self._db.delete(provider)
        self._db.commit()
        return True
