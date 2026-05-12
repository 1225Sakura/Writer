# Auto Novel Writer - WritingSettings Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of WritingSettingsRepositoryInterface

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.writing_settings.interfaces import WritingSettingsRepositoryInterface
from backend.core.domain.entities import WritingSettings


class SQLAlchemyWritingSettingsRepository(SQLAlchemyBaseRepository[WritingSettings], WritingSettingsRepositoryInterface):
    """SQLAlchemy implementation of WritingSettings repository."""

    def __init__(self, db):
        super().__init__(db, WritingSettings)
