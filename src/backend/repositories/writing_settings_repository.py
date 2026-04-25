# Auto Novel Writer - Writing Settings Repository
# WritingSettings-specific queries extending BaseRepository

from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from repositories.base import BaseRepository
from core.domain.entities import WritingSettings


class WritingSettingsRepository(BaseRepository[WritingSettings]):
    """Repository for WritingSettings entity.

    WritingSettings is a singleton-like entity (only one record expected).
    This repository provides convenience methods for get-or-create patterns.
    """

    def __init__(self, db: AsyncSession):
        super().__init__(db, WritingSettings)

    async def get_or_create(self) -> WritingSettings:
        """Get existing settings or create default if none exists."""
        result = await self.db.execute(select(WritingSettings))
        settings = result.scalar_one_or_none()
        if not settings:
            settings = WritingSettings()
            self.db.add(settings)
            await self.db.flush()
            await self.db.refresh(settings)
        return settings
