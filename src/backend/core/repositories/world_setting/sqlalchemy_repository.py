# Auto Novel Writer - WorldSetting Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of WorldSettingRepositoryInterface

from backend.core.repositories.base import SQLAlchemyBaseRepository
from backend.core.repositories.world_setting.interfaces import WorldSettingRepositoryInterface
from backend.core.domain.entities import WorldSetting


class SQLAlchemyWorldSettingRepository(SQLAlchemyBaseRepository[WorldSetting], WorldSettingRepositoryInterface):
    """SQLAlchemy implementation of WorldSetting repository."""

    def __init__(self, db):
        super().__init__(db, WorldSetting)
