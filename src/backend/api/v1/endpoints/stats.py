"""Statistics API routes.

Provides project-level overview statistics for dashboard display.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.middleware.auth import require_auth
from backend.core.services.stats.stats_service import StatsService

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


def get_stats_service(db: AsyncSession = Depends(get_db)) -> StatsService:
    """Dependency to inject StatsService."""
    return StatsService(db)


@router.get(
    "/overview",
    response_model=ProjectStatsResponse,
    dependencies=[require_auth],
    summary="获取项目概览统计",
    description="返回项目级别的统计数据，包括章节数、角色数、字数等关键指标。",
)
async def get_project_stats(
    stats_service: StatsService = Depends(get_stats_service),
) -> dict[str, Any]:
    """Get overall project statistics.

    Returns counts of key entities and aggregated metrics.
    """
    return await stats_service.get_project_overview()
