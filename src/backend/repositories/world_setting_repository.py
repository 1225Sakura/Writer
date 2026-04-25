# Auto Novel Writer - World Setting Repository
# WorldSetting-specific queries extending BaseRepository

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from repositories.base import BaseRepository
from core.domain.entities import WorldSetting


class WorldSettingRepository(BaseRepository[WorldSetting]):
    """Repository for WorldSetting entity."""

    def __init__(self, db: AsyncSession):
        super().__init__(db, WorldSetting)
