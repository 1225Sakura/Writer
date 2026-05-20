# Auto Novel Writer - AI Routes
# AI generation and review endpoints

from fastapi import APIRouter, HTTPException, Depends, Request, status, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from typing import Optional, AsyncIterator, List

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.core.services.chapter.chapter_service import ChapterService
from backend.core.services.writing_settings.writing_settings_service import WritingSettingsService
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.core.services.ai.ai_service import AIService, ai_service
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
from backend.api.v1.dependencies import get_event_bus
from backend.agents.checkers.base import CheckerResult

router = APIRouter(prefix="/ai", tags=["ai"], dependencies=[require_auth])

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


# Request/Response models
class GenerateRequest(BaseModel):
    """Request for AI content generation."""
    model_config = {"json_schema_extra": {
        "example": {
            "prompt": "主角在山洞中发现了上古秘籍",
            "operation": "continue",
            "chapter_id": 1,
            "human_ai_ratio": 70,
            "style": "default"
        }
    }}

    prompt: str = Field(..., description="写作提示/上下文内容", max_length=10000)
    operation: str = Field(..., description="操作类型: continue/expand/condense/rewrite/polish/optimize")
    chapter_id: Optional[int] = Field(None, description="关联章节ID")
    human_ai_ratio: Optional[int] = Field(None, description="人机比例 0-100", ge=0, le=100)
    style: Optional[str] = Field(None, description="文笔风格")

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


class ReviewRequest(BaseModel):
    """Request for AI setting review."""
    model_config = {"json_schema_extra": {
        "example": {
            "settings_data": {"characters": [{"name": "主角", "personality": "冷静"}]}
        }
    }}

    settings_data: dict = Field(..., description="设定数据字典")

    @field_validator('settings_data')
    @classmethod
    def validate_settings_data(cls, v: dict) -> dict:
        if not v:
            raise ValueError('settings_data cannot be empty')
        return v


class ReviewResponse(BaseModel):
    """Response for AI review."""
    model_config = {"json_schema_extra": {
        "example": {
            "review_content": "设定审查结果...",
            "raw_response": {}
        }
    }}

    review_content: str = Field(..., description="审查结果文本")
    raw_response: dict = Field(..., description="原始AI响应")


class ExtractEntitiesRequest(BaseModel):
    """Request to extract entities from chat messages."""
    model_config = {"json_schema_extra": {
        "example": {
            "chat_messages": [{"role": "user", "content": "主角叫张三"}]
        }
    }}

    chat_messages: list = Field(..., description="聊天消息列表")

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
    "/generate",
    summary="AI内容生成",
    description="""
    使用AI生成内容，支持流式响应。

    操作类型:
    - **continue**: 续写后续内容
    - **expand**: 扩写当前内容
    - **condense**: 缩写当前内容
    - **rewrite**: 改写当前内容
    - **polish**: 润色当前内容
    - **optimize**: 优化当前内容
    """,
)
async def generate_content(
    request: GenerateRequest,
    writing_settings_service: WritingSettingsService = Depends(get_writing_settings_service),
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
    settings_list = await writing_settings_service.list_writing_settings()
    writing_settings = settings_list[0] if settings_list else None

    human_ai_ratio = request.human_ai_ratio
    style = request.style

    if human_ai_ratio is None and writing_settings:
        human_ai_ratio = int(writing_settings.human_ai_ratio * 100)
    if style is None and writing_settings:
        style = writing_settings.writing_style

    human_ai_ratio = human_ai_ratio if human_ai_ratio is not None else 70
    style = style if style is not None else "default"

    async def stream_response() -> AsyncIterator[str]:
        """Stream AI response in SSE format with progress tracking.

        Yields SSE-formatted events:
        - event: progress\ndata: {"percent": N}\n\n
        - event: chunk\ndata: <text>\n\n
        - event: done\ndata: {"total_chars": N}\n\n
        """
        accumulated = ""
        chunk_count = 0
        # Estimate total chunks for progress (rough heuristic: ~50 chars per chunk)
        estimated_total_chunks = max(1, len(request.prompt) // 50)

        yield f"event: progress\ndata: {{\"percent\": 5}}\n\n"

        try:
            async for chunk in ai_service.generate(
                prompt=request.prompt,
                operation=request.operation,
                human_ai_ratio=human_ai_ratio,
                style=style
            ):
                if not chunk:
                    continue
                accumulated += chunk
                chunk_count += 1
                # Calculate progress (cap at 95% until done)
                progress = min(95, int((chunk_count / estimated_total_chunks) * 100))
                yield f"event: progress\ndata: {{\"percent\": {progress}}}\n\n"
                yield f"event: chunk\ndata: {chunk}\n\n"

            yield f"event: done\ndata: {{\"total_chars\": {len(accumulated)}}}\n\n"
        except Exception as exc:
            yield f"event: error\ndata: {{\"message\": \"{str(exc).replace(chr(34), chr(92)+chr(34))}\"}}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "X-Operation": request.operation,
            "X-Human-AI-Ratio": str(human_ai_ratio),
            "X-Style": style,
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )


@router.post(
    "/review",
    summary="AI审查设定",
    description="使用AI审查世界设定的一致性，分析角色、地点、物品、势力、规则之间的逻辑一致性。",
)
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


@router.post(
    "/extract-entities",
    summary="从聊天中提取实体",
    description="从聊天消息中提取角色、地点、物品、势力等实体信息。",
)
async def extract_entities(request: ExtractEntitiesRequest) -> dict:
    """Extract entities from chat messages.

    Returns extracted characters, locations, items, factions, etc.
    """
    ai_service = get_ai_service()

    entities = await ai_service.extract_entities(request.chat_messages)
    return {"entities": entities}


@router.post(
    "/chapters/{chapter_id}/inspect",
    summary="AI审查章节",
    description="对指定章节进行AI审查，检查角色一致性、情节逻辑、世界观一致性、伏笔运用等。",
)
async def inspect_chapter(
    chapter_id: int,
    chapter_service: ChapterService = Depends(get_chapter_service),
) -> dict:
    """Run AI inspection on a chapter.

    Checks for consistency, plot holes, character consistency, etc.
    """
    # Get chapter
    chapter = await chapter_service.get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Get latest draft for this chapter
    drafts = await chapter_service.list_draft_versions(chapter_id)
    draft = max(drafts, key=lambda d: d.version_number, default=None) if drafts else None

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
    """Request for building chapter execution context."""
    model_config = {"json_schema_extra": {"example": {"chapter_id": 1}}}

    chapter_id: int = Field(..., description="Chapter ID", gt=0)


class ExtractRequest(BaseModel):
    """Request for extracting structured entities."""
    model_config = {"json_schema_extra": {
        "example": {"content": "章节正文内容...", "chapter_id": 1}
    }}

    content: str = Field(..., description="Chapter content text", max_length=100000)
    chapter_id: Optional[int] = Field(None, description="Optional chapter ID", gt=0)

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        if len(v) > MAX_CONTENT_LENGTH:
            raise ValueError(f'Content exceeds maximum length of {MAX_CONTENT_LENGTH} characters')
        return v.strip()


class ContextResponse(BaseModel):
    """Response containing chapter execution context."""
    model_config = {"json_schema_extra": {
        "example": {
            "chapter_id": 1,
            "chapter_title": "第一章",
            "core_task": {},
            "承接上文": {},
            "active_characters": [],
            "scene_constraints": {},
            "time_constraints": "",
            "style_guidance": "",
            "continuity": {},
            "engagement_strategy": "",
            "raw_ai_response": None
        }
    }}

    chapter_id: int = Field(..., description="Chapter ID")
    chapter_title: Optional[str] = Field(None, description="Chapter title")
    core_task: dict = Field(..., description="Core writing task")
    承接上文: dict = Field(..., description="Previous chapter hooks")
    active_characters: list = Field(..., description="Active characters with states")
    scene_constraints: dict = Field(..., description="Scene and power constraints")
    time_constraints: str = Field(..., description="Time constraints")
    style_guidance: str = Field(..., description="Style guidance")
    continuity: dict = Field(..., description="Continuity and foreshadowing")
    engagement_strategy: str = Field(..., description="Engagement strategy")
    raw_ai_response: Optional[str] = Field(None, description="Raw AI response")


class ExtractResponse(BaseModel):
    """Response containing extracted structured entities."""
    model_config = {"json_schema_extra": {
        "example": {
            "chapter_id": 1,
            "entities": [],
            "relationships": [],
            "state_changes": [],
            "scenes": [],
            "summary": ""
        }
    }}

    chapter_id: Optional[int] = Field(None, description="Chapter ID")
    entities: list = Field(..., description="Extracted entities")
    relationships: list = Field(..., description="Entity relationships")
    state_changes: list = Field(..., description="State changes")
    scenes: list = Field(..., description="Scene segmentation")
    summary: str = Field(..., description="Content summary")


@router.post(
    "/context",
    response_model=ContextResponse,
    summary="构建写作执行包",
    description="为指定章节构建完整的写作上下文包，包含核心任务、角色状态、场景约束、风格指导等。",
)
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
    provider = get_ai_provider()
    event_bus = get_event_bus()
    context_agent = ContextAgent(provider, event_bus, ai_service)

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


@router.post(
    "/extract",
    response_model=ExtractResponse,
    summary="提取结构化实体",
    description="从章节内容中提取角色、地点、物品、关系、状态变化、场景分段和摘要。",
)
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
    provider = get_ai_provider()
    event_bus = get_event_bus()
    data_agent = DataAgent(provider, event_bus, ai_service)

    result = await data_agent.process_chapter(
        chapter_id=request.chapter_id or 0,
        content=request.content,
        db=db
    )

    return ExtractResponse(**result)


# ============================================
# Checker Endpoints
# ============================================

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
    ai_service = get_ai_service()
    checker = ConsistencyChecker(ai_service)

    content = await _get_chapter_content(body.chapter_id, chapter_service)

    try:
        result = await checker.quick_scan(content)
        return ConsistencyCheckResponse(
            chapter_id=body.chapter_id,
            score=result.score,
            issues=_checker_result_to_issues(result),
            suggestions=result.suggestions,
        )
    except Exception as e:
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
    ai_service = get_ai_service()
    checker = ContinuityChecker(ai_service)

    content = await _get_chapter_content(body.chapter_id, chapter_service)

    try:
        result = await checker.quick_scan(content)
        return ContinuityCheckResponse(
            chapter_id=body.chapter_id,
            score=result.score,
            issues=_checker_result_to_issues(result),
            suggestions=result.suggestions,
        )
    except Exception as e:
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
    ai_service = get_ai_service()
    checker = PacingChecker(ai_service)

    content = await _get_chapter_content(body.chapter_id, chapter_service)

    try:
        result = await checker.quick_scan(content)
        return PacingCheckResponse(
            chapter_id=body.chapter_id,
            score=result.score,
            issues=_checker_result_to_issues(result),
            suggestions=result.suggestions,
        )
    except Exception as e:
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
    ai_service = get_ai_service()
    checker = OOCChecker(ai_service)

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
    except Exception as e:
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
    ai_service = get_ai_service()
    checker = HighPointChecker(ai_service)

    content = await _get_chapter_content(body.chapter_id, chapter_service)

    try:
        result = await checker.quick_scan(content)
        return HighPointCheckResponse(
            chapter_id=body.chapter_id,
            score=result.score,
            issues=_checker_result_to_issues(result),
            suggestions=result.suggestions,
        )
    except Exception as e:
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
    ai_service = get_ai_service()
    checker = ReaderPullChecker(ai_service)

    content = await _get_chapter_content(body.chapter_id, chapter_service)

    try:
        result = await checker.quick_scan(content)
        return ReaderPullCheckResponse(
            chapter_id=body.chapter_id,
            score=result.score,
            issues=_checker_result_to_issues(result),
            suggestions=result.suggestions,
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Reader pull check failed: {str(e)}"
        )


# ============================================
# Provider Health & Failover Endpoints
# ============================================

class FailoverRequest(BaseModel):
    """Request for manual provider failover."""
    model_config = {"json_schema_extra": {"example": {"target_provider": None}}}

    target_provider: Optional[str] = Field(
        None,
        description="Specific provider name to promote to primary. If omitted, cycles to next healthy provider."
    )


class FailoverResponse(BaseModel):
    """Response for provider failover."""
    model_config = {"json_schema_extra": {
        "example": {"success": True, "new_primary": "minimax", "message": "Failover complete"}
    }}

    success: bool = Field(..., description="Whether failover succeeded")
    new_primary: str = Field(..., description="New primary provider name")
    message: str = Field(..., description="Status message")


@router.get(
    "/health",
    summary="AI提供商健康状态",
    description="返回各AI提供商的健康状态、降级状态、错误率、调用次数、成功率和平均延迟。",
)
async def get_ai_provider_health() -> dict:
    """Return AI provider health status and metrics.

    Shows each provider's degradation status, error rate, call counts,
    success rate, and average latency. Also indicates the currently
    recommended (best) provider.
    """
    health = ai_service.get_provider_health()
    return health


@router.get(
    "/provider-health",
    summary="AI提供商健康状态（别名）",
    description="/health 的别名端点，返回各AI提供商的健康状态、降级状态、错误率、调用次数、成功率和平均延迟。",
)
async def get_ai_provider_health_alias() -> dict:
    """Alias for /ai/health - return AI provider health status and metrics."""
    health = ai_service.get_provider_health()
    return health


@router.post(
    "/failover",
    response_model=FailoverResponse,
    summary="手动触发提供商故障转移",
    description="手动切换到下一个健康的AI提供商，或提升指定的提供商为主提供商。",
)
async def trigger_failover(request: FailoverRequest) -> FailoverResponse:
    """Manually trigger a provider failover (admin use).

    Cycles to the next healthy provider, or promotes a specific
    provider if target_provider is given.
    """
    router = ai_service.router
    if router is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Provider router not initialized"
        )

    try:
        new_primary = router.force_failover(target_name=request.target_provider)
        return FailoverResponse(
            success=True,
            new_primary=new_primary,
            message=f"Failover complete. New primary provider: {new_primary}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failover failed: {str(e)}"
        )
