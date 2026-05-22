# Auto Novel Writer - AI Shared Dependencies
# Shared constants, utilities, and dependency functions for AI endpoints

from fastapi import HTTPException, Depends, Request, status
from pydantic import BaseModel, Field
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.core.services.chapter.chapter_service import ChapterService
from backend.core.services.writing_settings.writing_settings_service import WritingSettingsService
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.core.services.ai.ai_service import AIService, ai_service

from backend.middleware.auth import require_auth
from backend.middleware.rate_limit import check_checker_rate_limit
from backend.api.v1.dependencies import get_event_bus
from backend.agents.checkers.base import CheckerResult

VALID_OPERATIONS = {"continue", "expand", "condense", "rewrite", "polish", "optimize"}
MAX_PROMPT_LENGTH = 10000
MAX_CONTENT_LENGTH = 100000

# Global instances
_ai_provider = None  # Will be set during app startup


def set_ai_provider(provider) -> None:
    """Set the global AI provider for agent routes."""
    global _ai_provider
    _ai_provider = provider


def get_ai_provider():
    """Get the configured AI provider."""
    return _ai_provider


def get_ai_service() -> AIService:
    """Get AI service singleton instance."""
    if ai_service.router is None:
        raise HTTPException(status_code=503, detail="AI service not configured")
    return ai_service


def get_chapter_service(db: AsyncSession = Depends(get_db)) -> ChapterService:
    """Dependency: provide ChapterService instance."""
    return ChapterService(db, get_event_bus(), get_cache_service())


async def _get_chapter_content(chapter_id: int, chapter_service: ChapterService) -> str:
    """Get chapter content from latest draft or summary."""
    chapter = await chapter_service.get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail=f"Chapter {chapter_id} not found")
    drafts = await chapter_service.list_draft_versions(chapter_id)
    draft = drafts[0] if drafts else None
    return draft.content if draft else chapter.summary or ""


def _checker_result_to_issues(result: CheckerResult) -> list[str]:
    """Adapter: convert CheckerResult.issues (list[dict]) to List[str] for CheckerBaseResponse."""
    return [issue.get("message", str(issue)) for issue in result.issues]


def get_writing_settings_service(db: AsyncSession = Depends(get_db)) -> WritingSettingsService:
    """Dependency: provide WritingSettingsService instance."""
    return WritingSettingsService(db, get_event_bus(), get_cache_service())


async def require_checker_rate_limit(request: Request) -> None:
    """Dependency to enforce stricter rate limits on AI checker endpoints."""
    client_ip = request.client.host if request.client else "unknown"
    allowed, limit, remaining = await check_checker_rate_limit(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Checker rate limit exceeded. Please wait before running another check.",
            headers={"Retry-After": "60"}
        )
    # Store remaining in request state for response headers
    request.state.rate_limit_remaining = remaining
    request.state.rate_limit_limit = limit
