# Auto Novel Writer - Chapter Repository (SQLAlchemy Implementation)
# Concrete SQLAlchemy implementation of ChapterRepositoryInterface

from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.core.repositories.chapter.interfaces import ChapterRepositoryInterface
from backend.core.domain.entities import Chapter, DraftVersion


class SQLAlchemyChapterRepository(ChapterRepositoryInterface):
    """SQLAlchemy implementation of Chapter repository."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, id: int) -> Optional[Chapter]:
        result = await self.db.execute(
            select(Chapter).where(Chapter.id == id)
        )
        return result.scalar_one_or_none()

    async def get_by_project(self, project_id: int) -> List[Chapter]:
        result = await self.db.execute(
            select(Chapter).where(Chapter.project_id == project_id)
        )
        return list(result.scalars().all())

    async def create(self, data: dict) -> Chapter:
        instance = Chapter(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def update(self, id: int, data: dict) -> Optional[Chapter]:
        result = await self.db.execute(
            select(Chapter).where(Chapter.id == id)
        )
        chapter = result.scalar_one_or_none()
        if chapter is None:
            return None
        for key, value in data.items():
            setattr(chapter, key, value)
        await self.db.flush()
        await self.db.refresh(chapter)
        return chapter

    async def delete(self, id: int) -> bool:
        result = await self.db.execute(
            select(Chapter).where(Chapter.id == id)
        )
        chapter = result.scalar_one_or_none()
        if chapter is None:
            return False
        await self.db.delete(chapter)
        await self.db.flush()
        return True

    async def list(self, skip: int = 0, limit: int = 100, **filters) -> List[Chapter]:
        stmt = select(Chapter)
        for column, value in filters.items():
            if hasattr(Chapter, column) and value is not None:
                stmt = stmt.where(getattr(Chapter, column) == value)
        stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    async def get_by_outline(self, outline_id: int, skip: int = 0, limit: int = 100) -> List[Chapter]:
        result = await self.db.execute(
            select(Chapter)
            .where(Chapter.outline_id == outline_id)
            .offset(skip)
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_draft_versions(self, chapter_id: int) -> List[DraftVersion]:
        result = await self.db.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
        )
        return list(result.scalars().all())

    async def create_draft_version(self, data: dict) -> DraftVersion:
        instance = DraftVersion(**data)
        self.db.add(instance)
        await self.db.flush()
        await self.db.refresh(instance)
        return instance

    async def get_draft_version(self, chapter_id: int, version_number: int) -> Optional[DraftVersion]:
        result = await self.db.execute(
            select(DraftVersion)
            .where(DraftVersion.chapter_id == chapter_id)
            .where(DraftVersion.version_number == version_number)
        )
        return result.scalar_one_or_none()
