"""Statistics API routes.

Provides project-level overview statistics for dashboard display.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.middleware.auth import require_auth
from backend.models.entities import (
    Chapter,
    Character,
    DraftVersion,
    Outline,
    IFLine,
    PlotThread,
    ChatSession,
)

router = APIRouter(prefix="/stats", tags=["stats"])


class ProjectStatsResponse(BaseModel):
    """Project overview statistics."""
    model_config = {"json_schema_extra": {
        "example": {
            "total_chapters": 12,
            "total_characters": 8,
            "total_outlines": 1,
            "total_if_lines": 3,
            "total_draft_versions": 24,
            "total_plot_threads": 5,
            "total_word_count": 45000,
            "total_chat_sessions": 2,
            "chapters_by_status": {"draft": 8, "review": 3, "published": 1}
        }
    }}

    total_chapters: int = Field(..., description="Total number of chapters")
    total_characters: int = Field(..., description="Total number of characters")
    total_outlines: int = Field(..., description="Total number of outlines")
    total_if_lines: int = Field(..., description="Total number of IF lines")
    total_draft_versions: int = Field(..., description="Total number of draft versions")
    total_plot_threads: int = Field(..., description="Total number of plot threads")
    total_word_count: int = Field(..., description="Total word count across all chapters")
    total_chat_sessions: int = Field(..., description="Total number of chat sessions")
    chapters_by_status: dict[str, int] = Field(..., description="Chapter count grouped by status")


@router.get(
    "/overview",
    response_model=ProjectStatsResponse,
    dependencies=[require_auth],
    summary="获取项目概览统计",
    description="返回项目级别的统计数据，包括章节数、角色数、字数等关键指标。",
)
async def get_project_stats(db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Get overall project statistics.

    Returns counts of key entities and aggregated metrics.
    """
    # Count queries
    chapter_count = await db.scalar(select(func.count()).select_from(Chapter))
    character_count = await db.scalar(select(func.count()).select_from(Character))
    outline_count = await db.scalar(select(func.count()).select_from(Outline))
    if_line_count = await db.scalar(select(func.count()).select_from(IFLine))
    draft_count = await db.scalar(select(func.count()).select_from(DraftVersion))
    plot_thread_count = await db.scalar(select(func.count()).select_from(PlotThread))
    chat_session_count = await db.scalar(select(func.count()).select_from(ChatSession))

    # Word count aggregation
    word_count_result = await db.execute(select(func.sum(Chapter.word_count)))
    total_words = word_count_result.scalar_one_or_none() or 0

    # Chapters by status
    status_result = await db.execute(
        select(Chapter.status, func.count())
        .group_by(Chapter.status)
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
