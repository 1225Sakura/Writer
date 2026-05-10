"""Cross-entity aggregation service for project statistics."""

from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.core.domain import (
    Chapter, Character, DraftVersion, Outline, IFLine, PlotThread, ChatSession,
)


class StatsService:
    """Service for project-level aggregate statistics."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_project_overview(self) -> dict[str, Any]:
        """Return counts of key entities and aggregated word count."""
        chapter_count = await self.db.scalar(select(func.count()).select_from(Chapter))
        character_count = await self.db.scalar(select(func.count()).select_from(Character))
        outline_count = await self.db.scalar(select(func.count()).select_from(Outline))
        if_line_count = await self.db.scalar(select(func.count()).select_from(IFLine))
        draft_count = await self.db.scalar(select(func.count()).select_from(DraftVersion))
        plot_thread_count = await self.db.scalar(select(func.count()).select_from(PlotThread))
        chat_session_count = await self.db.scalar(select(func.count()).select_from(ChatSession))

        word_count_result = await self.db.execute(select(func.sum(Chapter.word_count)))
        total_words = word_count_result.scalar_one_or_none() or 0

        status_result = await self.db.execute(
            select(Chapter.status, func.count()).group_by(Chapter.status)
        )
        chapters_by_status = {row[0] or "unknown": row[1] for row in status_result.all()}

        return {
            "total_chapters": chapter_count or 0,
            "total_characters": character_count or 0,
            "total_outlines": outline_count or 0,
            "total_if_lines": if_line_count or 0,
            "total_draft_versions": draft_count or 0,
            "total_plot_threads": plot_thread_count or 0,
            "total_word_count": int(total_words),
            "total_chat_sessions": chat_session_count or 0,
            "chapters_by_status": chapters_by_status,
        }
