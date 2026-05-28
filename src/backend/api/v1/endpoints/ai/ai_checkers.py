# Auto Novel Writer - AI Checker Endpoints
# POST /check/consistency, /check/continuity, /check/pacing, /check/ooc, /check/high-point, /check/reader-pull

from fastapi import APIRouter, HTTPException, Depends, Body, status
from pydantic import BaseModel, Field
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.core.services.chapter.chapter_service import ChapterService
from backend.agents.checkers import (
    ConsistencyChecker,
    ContinuityChecker,
    PacingChecker,
    OOCChecker,
    HighPointChecker,
    ReaderPullChecker,
)

from backend.utils.exceptions import CheckerError, AIServiceError

from .dependencies import (
    get_ai_service,
    get_chapter_service,
    _get_chapter_content,
    _checker_result_to_issues,
    require_checker_rate_limit,
)

router = APIRouter()


# Request/Response models

class CheckerBaseRequest(BaseModel):
    """Base request for checker endpoints."""
    model_config = {"json_schema_extra": {"example": {"chapter_id": 1}}}

    chapter_id: int = Field(..., description="Chapter ID to check", gt=0)


class OOCCheckerRequest(BaseModel):
    """Request for OOC (Out-Of-Character) check."""
    model_config = {"json_schema_extra": {"example": {"chapter_id": 1, "character_id": 2}}}

    chapter_id: int = Field(..., description="Chapter ID to check", gt=0)
    character_id: int = Field(..., description="Character ID to verify", gt=0)


class CheckerBaseResponse(BaseModel):
    """Base response for checker endpoints."""
    model_config = {"json_schema_extra": {
        "example": {"chapter_id": 1, "score": 85, "issues": [], "suggestions": []}
    }}

    chapter_id: int = Field(..., description="Checked chapter ID")
    score: int = Field(..., ge=0, le=100, description="Quality score 0-100")
    issues: List[str] = Field(default_factory=list, description="Found issues")
    suggestions: List[str] = Field(default_factory=list, description="Improvement suggestions")


class ConsistencyCheckResponse(CheckerBaseResponse):
    """Consistency check response."""
    pass


class ContinuityCheckResponse(CheckerBaseResponse):
    """Continuity check response."""
    plot_thread_status: dict = Field(default_factory=dict, description="Plot thread fulfillment status")


class PacingCheckResponse(CheckerBaseResponse):
    """Pacing check response."""
    strand_ratios: dict = Field(default_factory=dict, description="Story strand ratios")
    analysis: str = Field("", description="Pacing analysis text")


class OOCViolation(BaseModel):
    """Single OOC violation detail."""
    location: str = Field("", description="Location in text")
    expected_behavior: str = Field("", description="Expected character behavior")
    actual_behavior: str = Field("", description="Actual character behavior")
    reason: str = Field("", description="Why this is a violation")


class OOCCheckResponse(CheckerBaseResponse):
    """OOC check response."""
    character_id: int = Field(..., description="Checked character ID")
    violations: List[OOCViolation] = Field(default_factory=list, description="OOC violations found")


class HighPoint(BaseModel):
    """High point detail."""
    location: str = Field("", description="Location in text")
    type: str = Field("", description="High point type")
    intensity: int = Field(5, ge=1, le=10, description="Intensity 1-10")
    pacing: str = Field("", description="Pacing at this point")


class HighPointCheckResponse(CheckerBaseResponse):
    """High point check response."""
    high_points: List[HighPoint] = Field(default_factory=list, description="Found high points")
    excitement_density: str = Field("", description="Excitement density analysis")
    ending_hook: str = Field("", description="Ending hook strength")


class Hook(BaseModel):
    """Reader hook detail."""
    location: str = Field("", description="Location in text")
    type: str = Field("", description="Hook type")
    description: str = Field("", description="Hook description")
    effectiveness: int = Field(5, ge=1, le=10, description="Effectiveness 1-10")


class ReaderPullCheckResponse(CheckerBaseResponse):
    """Reader pull check response."""
    hooks: List[Hook] = Field(default_factory=list, description="Found hooks")
    opening_hook: str = Field("", description="Opening hook analysis")
    ending_hook: str = Field("", description="Ending hook analysis")
    curiosity_gaps: List[str] = Field(default_factory=list, description="Curiosity gaps")


# Endpoints

@router.post(
    "/check/consistency",
    response_model=ConsistencyCheckResponse,
    summary="检查世界一致性",
    description="验证章节的地点、时间线、实力等级、物品归属和势力关系是否符合已建立的世界设定。",
)
async def check_consistency(
    body: CheckerBaseRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    chapter_service: ChapterService = Depends(get_chapter_service),
    _rate_limit=Depends(require_checker_rate_limit)
) -> ConsistencyCheckResponse:
    """Check world consistency for a chapter.

    Validates locations, timelines, power levels, item ownership,
    and faction relationships against established world settings.
    """
    ai_svc = get_ai_service()
    checker = ConsistencyChecker(ai_svc)

    content = await _get_chapter_content(body.chapter_id, chapter_service)

    try:
        result = await checker.quick_scan(content)
        return ConsistencyCheckResponse(
            chapter_id=body.chapter_id,
            score=result.score,
            issues=_checker_result_to_issues(result),
            suggestions=result.suggestions,
        )
    except (CheckerError, AIServiceError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Consistency check failed: {str(e)}"
        )


@router.post(
    "/check/continuity",
    response_model=ContinuityCheckResponse,
    summary="检查叙事连续性",
    description="验证场景转换、事件连贯性、角色状态连续性、伏笔呼应和与前章细节的一致性。",
)
async def check_continuity(
    body: CheckerBaseRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    chapter_service: ChapterService = Depends(get_chapter_service),
    _rate_limit=Depends(require_checker_rate_limit)
) -> ContinuityCheckResponse:
    """Check scene and narrative continuity for a chapter.

    Validates scene transitions, event consistency, character state continuity,
    plot thread fulfillment, and detail coherence with previous chapters.
    """
    ai_svc = get_ai_service()
    checker = ContinuityChecker(ai_svc)

    content = await _get_chapter_content(body.chapter_id, chapter_service)

    try:
        result = await checker.quick_scan(content)
        return ContinuityCheckResponse(
            chapter_id=body.chapter_id,
            score=result.score,
            issues=_checker_result_to_issues(result),
            suggestions=result.suggestions,
        )
    except (CheckerError, AIServiceError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Continuity check failed: {str(e)}"
        )


@router.post(
    "/check/pacing",
    response_model=PacingCheckResponse,
    summary="检查叙事节奏",
    description="分析章节的任务线/燃情线/星座线比例是否符合目标60%/20%/20%分布。",
)
async def check_pacing(
    body: CheckerBaseRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    chapter_service: ChapterService = Depends(get_chapter_service),
    _rate_limit=Depends(require_checker_rate_limit)
) -> PacingCheckResponse:
    """Check narrative pacing and strand ratios for a chapter.

    Analyzes quest/fire/constellation strand ratios against the
    target 60%/20%/20% distribution.
    """
    ai_svc = get_ai_service()
    checker = PacingChecker(ai_svc)

    content = await _get_chapter_content(body.chapter_id, chapter_service)

    try:
        result = await checker.quick_scan(content)
        return PacingCheckResponse(
            chapter_id=body.chapter_id,
            score=result.score,
            issues=_checker_result_to_issues(result),
            suggestions=result.suggestions,
        )
    except (CheckerError, AIServiceError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pacing check failed: {str(e)}"
        )


@router.post(
    "/check/ooc",
    response_model=OOCCheckResponse,
    summary="检查角色OOC",
    description="验证章节中角色的行为是否符合其已建立的性格、欲望和缺陷设定。",
)
async def check_ooc(
    body: OOCCheckerRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    chapter_service: ChapterService = Depends(get_chapter_service),
    _rate_limit=Depends(require_checker_rate_limit)
) -> OOCCheckResponse:
    """Check for Out-Of-Character behavior.

    Validates that a character's actions in the chapter are consistent
    with their established personality, desires, and flaws.
    """
    ai_svc = get_ai_service()
    checker = OOCChecker(ai_svc)

    content = await _get_chapter_content(body.chapter_id, chapter_service)

    try:
        result = await checker.quick_scan(content)
        return OOCCheckResponse(
            chapter_id=body.chapter_id,
            character_id=body.character_id,
            score=result.score,
            issues=_checker_result_to_issues(result),
            suggestions=result.suggestions,
        )
    except (CheckerError, AIServiceError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OOC check failed: {str(e)}"
        )


@router.post(
    "/check/high-point",
    response_model=HighPointCheckResponse,
    summary="检查高潮分布",
    description="分析章节的高潮分布、情感节奏、铺垫充分性和结尾钩子强度。",
)
async def check_high_point(
    body: CheckerBaseRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    chapter_service: ChapterService = Depends(get_chapter_service),
    _rate_limit=Depends(require_checker_rate_limit)
) -> HighPointCheckResponse:
    """Check excitement density and high points for a chapter.

    Analyzes climax distribution, emotional pacing, buildup adequacy,
    and chapter-ending hook strength.
    """
    ai_svc = get_ai_service()
    checker = HighPointChecker(ai_svc)

    content = await _get_chapter_content(body.chapter_id, chapter_service)

    try:
        result = await checker.quick_scan(content)
        return HighPointCheckResponse(
            chapter_id=body.chapter_id,
            score=result.score,
            issues=_checker_result_to_issues(result),
            suggestions=result.suggestions,
        )
    except (CheckerError, AIServiceError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"High point check failed: {str(e)}"
        )


@router.post(
    "/check/reader-pull",
    response_model=ReaderPullCheckResponse,
    summary="检查读者吸引力",
    description="分析开头钩子、结尾悬念、冲突驱动力、好奇心缺口和情感共鸣点。",
)
async def check_reader_pull(
    body: CheckerBaseRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    chapter_service: ChapterService = Depends(get_chapter_service),
    _rate_limit=Depends(require_checker_rate_limit)
) -> ReaderPullCheckResponse:
    """Check reader engagement and hooks for a chapter.

    Analyzes opening hooks, ending suspense, conflict drivers,
    curiosity gaps, and emotional resonance points.
    """
    ai_svc = get_ai_service()
    checker = ReaderPullChecker(ai_svc)

    content = await _get_chapter_content(body.chapter_id, chapter_service)

    try:
        result = await checker.quick_scan(content)
        return ReaderPullCheckResponse(
            chapter_id=body.chapter_id,
            score=result.score,
            issues=_checker_result_to_issues(result),
            suggestions=result.suggestions,
        )
    except (CheckerError, AIServiceError) as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reader pull check failed: {str(e)}"
        )
