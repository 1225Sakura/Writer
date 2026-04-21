# Auto Novel Writer - AI Routes
# AI generation and review endpoints

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from typing import Optional, AsyncIterator, List

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import get_db
from backend.models.entities import WritingSettings, Chapter
from backend.services.ai_service import AIService, ai_service
from backend.config import settings
from backend.agents.context_agent import ContextAgent
from backend.agents.data_agent import DataAgent
from backend.agents.checkers import (
    ConsistencyChecker,
    ContinuityChecker,
    PacingChecker,
    OOCChecker,
    HighPointChecker,
    ReaderPullChecker,
)

from backend.middleware.auth import require_auth
from backend.middleware.rate_limit import check_checker_rate_limit

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[require_auth])

VALID_OPERATIONS = {"continue", "expand", "condense", "rewrite", "polish", "optimize"}
MAX_PROMPT_LENGTH = 10000
MAX_CONTENT_LENGTH = 100000


def get_ai_service() -> AIService:
    """Get AI service singleton instance."""
    if not settings.minimax_api_key:
        raise HTTPException(
            status_code=500,
            detail="MiniMax API key not configured. Set MINIMAX_API_KEY in environment."
        )
    # Update singleton with current settings if needed
    if ai_service.api_key != settings.minimax_api_key:
        ai_service.api_key = settings.minimax_api_key
    if ai_service.base_url != settings.minimax_api_url.rstrip("/"):
        ai_service.base_url = settings.minimax_api_url.rstrip("/")
    return ai_service


def require_checker_rate_limit(request) -> None:
    """Dependency to enforce stricter rate limits on AI checker endpoints."""
    client_ip = request.client.host if request.client else "unknown"
    allowed, limit, remaining = check_checker_rate_limit(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Checker rate limit exceeded. Please wait before running another check.",
            headers={"Retry-After": "60"}
        )
    # Store remaining in request state for response headers
    request.state.rate_limit_remaining = remaining
    request.state.rate_limit_limit = limit


# Request/Response models
class GenerateRequest(BaseModel):
    prompt: str
    operation: str
    chapter_id: Optional[int] = None
    human_ai_ratio: Optional[int] = None
    style: Optional[str] = None

    @field_validator('prompt')
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Prompt cannot be empty')
        if len(v) > MAX_PROMPT_LENGTH:
            raise ValueError(f'Prompt exceeds maximum length of {MAX_PROMPT_LENGTH} characters')
        return v.strip()

    @field_validator('operation')
    @classmethod
    def validate_operation(cls, v: str) -> str:
        if v not in VALID_OPERATIONS:
            raise ValueError(f'Operation must be one of: {", ".join(sorted(VALID_OPERATIONS))}')
        return v

    @field_validator('human_ai_ratio')
    @classmethod
    def validate_human_ai_ratio(cls, v: Optional[int]) -> Optional[int]:
        if v is not None:
            if v < 0 or v > 100:
                raise ValueError('human_ai_ratio must be between 0 and 100')
        return v

    @field_validator('chapter_id')
    @classmethod
    def validate_chapter_id(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError('chapter_id must be a positive integer')
        return v


class ReviewRequest(BaseModel):
    settings_data: dict

    @field_validator('settings_data')
    @classmethod
    def validate_settings_data(cls, v: dict) -> dict:
        if not v:
            raise ValueError('settings_data cannot be empty')
        return v


class ReviewResponse(BaseModel):
    review_content: str
    raw_response: dict


class ExtractEntitiesRequest(BaseModel):
    chat_messages: list

    @field_validator('chat_messages')
    @classmethod
    def validate_chat_messages(cls, v: list) -> list:
        if not v:
            raise ValueError('chat_messages cannot be empty')
        return v


# ============================================
# Checker Request/Response Models
# ============================================

class CheckerBaseRequest(BaseModel):
    chapter_id: int = Field(..., description="Chapter ID to check")

    @field_validator('chapter_id')
    @classmethod
    def validate_chapter_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('chapter_id must be a positive integer')
        return v


class OOCCheckerRequest(BaseModel):
    chapter_id: int = Field(..., description="Chapter ID to check")
    character_id: int = Field(..., description="Character ID to verify")

    @field_validator('chapter_id')
    @classmethod
    def validate_chapter_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('chapter_id must be a positive integer')
        return v

    @field_validator('character_id')
    @classmethod
    def validate_character_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('character_id must be a positive integer')
        return v


class CheckerBaseResponse(BaseModel):
    chapter_id: int
    score: int = Field(..., ge=0, le=100, description="Quality score 0-100")
    issues: List[str] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)


class ConsistencyCheckResponse(CheckerBaseResponse):
    pass


class ContinuityCheckResponse(CheckerBaseResponse):
    plot_thread_status: dict = Field(default_factory=dict)


class PacingCheckResponse(CheckerBaseResponse):
    strand_ratios: dict = Field(default_factory=dict)
    analysis: str = ""


class OOCViolation(BaseModel):
    location: str = ""
    expected_behavior: str = ""
    actual_behavior: str = ""
    reason: str = ""


class OOCCheckResponse(CheckerBaseResponse):
    character_id: int
    violations: List[OOCViolation] = Field(default_factory=list)


class HighPoint(BaseModel):
    location: str = ""
    type: str = ""
    intensity: int = Field(5, ge=1, le=10)
    pacing: str = ""


class HighPointCheckResponse(CheckerBaseResponse):
    high_points: List[HighPoint] = Field(default_factory=list)
    excitement_density: str = ""
    ending_hook: str = ""


class Hook(BaseModel):
    location: str = ""
    type: str = ""
    description: str = ""
    effectiveness: int = Field(5, ge=1, le=10)


class ReaderPullCheckResponse(CheckerBaseResponse):
    hooks: List[Hook] = Field(default_factory=list)
    opening_hook: str = ""
    ending_hook: str = ""
    curiosity_gaps: List[str] = Field(default_factory=list)


# Endpoints
@router.post("/generate")
async def generate_content(
    request: GenerateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate AI content with streaming response.

    Operation types:
    - continue: 续写后续内容
    - expand: 扩写当前内容
    - condense: 缩写当前内容
    - rewrite: 改写当前内容
    - polish: 润色当前内容
    - optimize: 优化当前内容
    """
    ai_service = get_ai_service()

    # Get writing settings for defaults
    result = await db.execute(select(WritingSettings))
    writing_settings = result.scalar_one_or_none()

    human_ai_ratio = request.human_ai_ratio
    style = request.style

    if human_ai_ratio is None and writing_settings:
        human_ai_ratio = int(writing_settings.human_ai_ratio * 100)
    if style is None and writing_settings:
        style = writing_settings.writing_style

    human_ai_ratio = human_ai_ratio if human_ai_ratio is not None else 70
    style = style if style is not None else "default"

    async def stream_response() -> AsyncIterator[str]:
        async for chunk in ai_service.generate(
            prompt=request.prompt,
            operation=request.operation,
            human_ai_ratio=human_ai_ratio,
            style=style
        ):
            yield chunk

    return StreamingResponse(
        stream_response(),
        media_type="text/plain",
        headers={
            "X-Operation": request.operation,
            "X-Human-AI-Ratio": str(human_ai_ratio),
            "X-Style": style
        }
    )


@router.post("/review")
async def review_settings(request: ReviewRequest) -> ReviewResponse:
    """Review world settings for consistency using AI.

    Analyzes characters, locations, items, factions, and rules
    for logical consistency and potential issues.
    """
    ai_service = get_ai_service()

    result = await ai_service.review_settings(request.settings_data)
    return ReviewResponse(
        review_content=result["review_content"],
        raw_response=result["raw_response"]
    )


@router.post("/extract-entities")
async def extract_entities(request: ExtractEntitiesRequest) -> dict:
    """Extract entities from chat messages.

    Returns extracted characters, locations, items, factions, etc.
    """
    ai_service = get_ai_service()

    entities = await ai_service.extract_entities(request.chat_messages)
    return {"entities": entities}


@router.post("/chapters/{chapter_id}/inspect")
async def inspect_chapter(chapter_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    """Run AI inspection on a chapter.

    Checks for consistency, plot holes, character consistency, etc.
    """
    # Get chapter
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Get all drafts for this chapter
    from backend.models.entities import DraftVersion
    result = await db.execute(
        select(DraftVersion)
        .where(DraftVersion.chapter_id == chapter_id)
        .order_by(DraftVersion.version_number.desc())
        .limit(1)
    )
    draft = result.scalar_one_or_none()

    if not draft:
        raise HTTPException(status_code=404, detail="No draft found for chapter")

    ai_service = get_ai_service()

    # Build inspection prompt
    inspection_prompt = f"""请审查以下章节内容：

标题：{chapter.title or '无标题'}
大纲摘要：{chapter.summary or '无'}
章节内容：
{draft.content}

请检查以下方面：
1. 角色一致性（性格、行为是否矛盾）
2. 情节逻辑（是否有漏洞）
3. 世界观一致性（设定是否冲突）
4. 伏笔运用（伏笔是否有照应）
5. 建议优化

请以JSON格式返回，包含issues和suggestions字段。"""

    review_result = await ai_service.review_settings({"content": inspection_prompt})

    return {
        "chapter_id": chapter_id,
        "review_content": review_result["review_content"],
        "raw_response": review_result["raw_response"]
    }


# ============================================
# Agent Endpoints (consolidated from agents.py)
# ============================================

class ContextRequest(BaseModel):
    chapter_id: int

    @field_validator('chapter_id')
    @classmethod
    def validate_chapter_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('chapter_id must be a positive integer')
        return v


class ExtractRequest(BaseModel):
    content: str
    chapter_id: Optional[int] = None

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        if len(v) > MAX_CONTENT_LENGTH:
            raise ValueError(f'Content exceeds maximum length of {MAX_CONTENT_LENGTH} characters')
        return v.strip()

    @field_validator('chapter_id')
    @classmethod
    def validate_chapter_id(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError('chapter_id must be a positive integer')
        return v


class ContextResponse(BaseModel):
    chapter_id: int
    chapter_title: Optional[str] = None
    core_task: dict
    承接上文: dict
    active_characters: list
    scene_constraints: dict
    time_constraints: str
    style_guidance: str
    continuity: dict
    engagement_strategy: str
    raw_ai_response: Optional[str] = None


class ExtractResponse(BaseModel):
    chapter_id: Optional[int] = None
    entities: list
    relationships: list
    state_changes: list
    scenes: list
    summary: str


@router.post("/context", response_model=ContextResponse)
async def build_execution_package(
    request: ContextRequest,
    db: AsyncSession = Depends(get_db)
) -> ContextResponse:
    """Build a writing execution package for a chapter.

    Generates a complete context package containing:
    - Core task (goal/obstacle/cost)
    - Previous chapter hooks
    - Active characters with states
    - Scene and power constraints
    - Time constraints
    - Style guidance
    - Continuity and foreshadowing
    - Engagement strategy
    """
    ai_service = get_ai_service()
    context_agent = ContextAgent(ai_service)

    try:
        context = await context_agent.generate_chapter_context(
            chapter_id=request.chapter_id,
            db=db
        )
        return ContextResponse(**context)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build context: {str(e)}")


@router.post("/extract", response_model=ExtractResponse)
async def extract_structured_entities(
    request: ExtractRequest,
    db: AsyncSession = Depends(get_db)
) -> ExtractResponse:
    """Extract structured entities from chapter content.

    Extracts:
    - Characters, locations, items, factions
    - Relationships between entities
    - State changes
    - Scene segmentation
    - Summary
    """
    ai_service = get_ai_service()
    data_agent = DataAgent(ai_service)

    result = await data_agent.process_chapter(
        chapter_id=request.chapter_id or 0,
        content=request.content,
        db=db
    )

    return ExtractResponse(**result)


# ============================================
# Checker Endpoints
# ============================================

@router.post("/check/consistency", response_model=ConsistencyCheckResponse)
async def check_consistency(
    request: CheckerBaseRequest,
    db: AsyncSession = Depends(get_db),
    _rate_limit=Depends(require_checker_rate_limit)
) -> ConsistencyCheckResponse:
    """Check world consistency for a chapter.

    Validates locations, timelines, power levels, item ownership,
    and faction relationships against established world settings.
    """
    ai_service = get_ai_service()
    checker = ConsistencyChecker(ai_service)

    # Verify chapter exists
    result = await db.execute(select(Chapter).where(Chapter.id == request.chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter {request.chapter_id} not found"
        )

    try:
        result = await checker.check(request.chapter_id, db)
        return ConsistencyCheckResponse(
            chapter_id=request.chapter_id,
            score=result.get("score", 0),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", []),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Consistency check failed: {str(e)}"
        )


@router.post("/check/continuity", response_model=ContinuityCheckResponse)
async def check_continuity(
    request: CheckerBaseRequest,
    db: AsyncSession = Depends(get_db),
    _rate_limit=Depends(require_checker_rate_limit)
) -> ContinuityCheckResponse:
    """Check scene and narrative continuity for a chapter.

    Validates scene transitions, event consistency, character state continuity,
    plot thread fulfillment, and detail coherence with previous chapters.
    """
    ai_service = get_ai_service()
    checker = ContinuityChecker(ai_service)

    result = await db.execute(select(Chapter).where(Chapter.id == request.chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter {request.chapter_id} not found"
        )

    try:
        result = await checker.check(request.chapter_id, db)
        return ContinuityCheckResponse(
            chapter_id=request.chapter_id,
            score=result.get("score", 0),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", []),
            plot_thread_status=result.get("plot_thread_status", {}),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Continuity check failed: {str(e)}"
        )


@router.post("/check/pacing", response_model=PacingCheckResponse)
async def check_pacing(
    request: CheckerBaseRequest,
    db: AsyncSession = Depends(get_db),
    _rate_limit=Depends(require_checker_rate_limit)
) -> PacingCheckResponse:
    """Check narrative pacing and strand ratios for a chapter.

    Analyzes quest/fire/constellation strand ratios against the
    target 60%/20%/20% distribution.
    """
    ai_service = get_ai_service()
    checker = PacingChecker(ai_service)

    result = await db.execute(select(Chapter).where(Chapter.id == request.chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter {request.chapter_id} not found"
        )

    try:
        result = await checker.check(request.chapter_id, db)
        return PacingCheckResponse(
            chapter_id=request.chapter_id,
            score=result.get("score", 0),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", []),
            strand_ratios=result.get("strand_ratios", {}),
            analysis=result.get("analysis", ""),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pacing check failed: {str(e)}"
        )


@router.post("/check/ooc", response_model=OOCCheckResponse)
async def check_ooc(
    request: OOCCheckerRequest,
    db: AsyncSession = Depends(get_db),
    _rate_limit=Depends(require_checker_rate_limit)
) -> OOCCheckResponse:
    """Check for Out-Of-Character behavior.

    Validates that a character's actions in the chapter are consistent
    with their established personality, desires, and flaws.
    """
    ai_service = get_ai_service()
    checker = OOCChecker(ai_service)

    result = await db.execute(select(Chapter).where(Chapter.id == request.chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter {request.chapter_id} not found"
        )

    try:
        result = await checker.check(request.chapter_id, request.character_id, db)
        violations_raw = result.get("violations", [])
        violations = [
            OOCViolation(
                location=v.get("location", ""),
                expected_behavior=v.get("expected_behavior", ""),
                actual_behavior=v.get("actual_behavior", ""),
                reason=v.get("reason", ""),
            )
            for v in violations_raw
        ]
        return OOCCheckResponse(
            chapter_id=request.chapter_id,
            character_id=request.character_id,
            score=result.get("score", 0),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", []),
            violations=violations,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OOC check failed: {str(e)}"
        )


@router.post("/check/high-point", response_model=HighPointCheckResponse)
async def check_high_point(
    request: CheckerBaseRequest,
    db: AsyncSession = Depends(get_db),
    _rate_limit=Depends(require_checker_rate_limit)
) -> HighPointCheckResponse:
    """Check excitement density and high points for a chapter.

    Analyzes climax distribution, emotional pacing, buildup adequacy,
    and chapter-ending hook strength.
    """
    ai_service = get_ai_service()
    checker = HighPointChecker(ai_service)

    result = await db.execute(select(Chapter).where(Chapter.id == request.chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter {request.chapter_id} not found"
        )

    try:
        result = await checker.check(request.chapter_id, db)
        high_points_raw = result.get("high_points", [])
        high_points = [
            HighPoint(
                location=hp.get("location", ""),
                type=hp.get("type", ""),
                intensity=hp.get("intensity", 5),
                pacing=hp.get("pacing", ""),
            )
            for hp in high_points_raw
        ]
        return HighPointCheckResponse(
            chapter_id=request.chapter_id,
            score=result.get("score", 0),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", []),
            high_points=high_points,
            excitement_density=result.get("excitement_density", ""),
            ending_hook=result.get("ending_hook", ""),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"High point check failed: {str(e)}"
        )


@router.post("/check/reader-pull", response_model=ReaderPullCheckResponse)
async def check_reader_pull(
    request: CheckerBaseRequest,
    db: AsyncSession = Depends(get_db),
    _rate_limit=Depends(require_checker_rate_limit)
) -> ReaderPullCheckResponse:
    """Check reader engagement and hooks for a chapter.

    Analyzes opening hooks, ending suspense, conflict drivers,
    curiosity gaps, and emotional resonance points.
    """
    ai_service = get_ai_service()
    checker = ReaderPullChecker(ai_service)

    result = await db.execute(select(Chapter).where(Chapter.id == request.chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter {request.chapter_id} not found"
        )

    try:
        result = await checker.check(request.chapter_id, db)
        hooks_raw = result.get("hooks", [])
        hooks = [
            Hook(
                location=h.get("location", ""),
                type=h.get("type", ""),
                description=h.get("description", ""),
                effectiveness=h.get("effectiveness", 5),
            )
            for h in hooks_raw
        ]
        return ReaderPullCheckResponse(
            chapter_id=request.chapter_id,
            score=result.get("score", 0),
            issues=result.get("issues", []),
            suggestions=result.get("suggestions", []),
            hooks=hooks,
            opening_hook=result.get("opening_hook", ""),
            ending_hook=result.get("ending_hook", ""),
            curiosity_gaps=result.get("curiosity_gaps", []),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reader pull check failed: {str(e)}"
        )
