"""Agent Routes - API endpoints for AI agent execution.

Provides endpoints for running specialized AI agents:
- StyleAgent: Writing style analysis
- ReviewAgent: Multi-round quality review
- PlotAgent: Plot design and rhythm analysis
- Checkers: Quality checkers (consistency, continuity, pacing, etc.)
"""

from __future__ import annotations

import json
from typing import Any, Optional, Dict

from fastapi import APIRouter, HTTPException, Depends, status, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from backend.middleware.auth import require_auth
from backend.services.ai.provider import AIProvider
from backend.services.ai_service import AIService, ai_service
from backend.database import get_db
from backend.config import settings
from backend.utils.event_bus import AsyncEventBus
from backend.models.entities import (
    Chapter, DraftVersion, Outline, Character, Location, Item,
    Faction, WorldSetting, Rule, PlotThread, Project, WritingSettings
)
from backend.agents.checkers import (
    BaseChecker,
    CheckerResult,
    CheckerPipeline,
    OutlineLawEnforcer,
    SettingPhysicsEnforcer,
)
from backend.agents.checkers.consistency_checker import ConsistencyChecker
from backend.agents.checkers.continuity_checker import ContinuityChecker
from backend.agents.checkers.pacing_checker import PacingChecker
from backend.agents.checkers.ooc_checker import OOCChecker
from backend.agents.checkers.high_point_checker import HighPointChecker
from backend.agents.checkers.reader_pull_checker import ReaderPullChecker
from backend.middleware.rate_limit import check_checker_rate_limit

router = APIRouter(prefix="/agents", tags=["agents"])


# ------------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------------

_event_bus: Optional[AsyncEventBus] = None
_ai_provider: Optional[AIProvider] = None


def get_event_bus() -> AsyncEventBus:
    """Get or create the shared event bus instance."""
    global _event_bus
    if _event_bus is None:
        _event_bus = AsyncEventBus()
    return _event_bus


def set_ai_provider(provider: AIProvider) -> None:
    """Set the global AI provider for agent routes."""
    global _ai_provider
    _ai_provider = provider


def get_ai_provider() -> AIProvider:
    """Get the configured AI provider."""
    if _ai_provider is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI provider not configured",
        )
    return _ai_provider


def get_ai_service() -> AIService:
    """Get AI service singleton instance."""
    if not settings.minimax_api_key:
        raise HTTPException(
            status_code=500,
            detail="MiniMax API key not configured. Set MINIMAX_API_KEY in environment."
        )
    if ai_service.api_key != settings.minimax_api_key:
        ai_service.api_key = settings.minimax_api_key
    if ai_service.base_url != settings.minimax_api_url.rstrip("/"):
        ai_service.base_url = settings.minimax_api_url.rstrip("/")
    return ai_service


def require_checker_rate_limit(request: Request) -> None:
    """Dependency to enforce stricter rate limits on checker endpoints."""
    client_ip = request.client.host if request.client else "unknown"
    allowed, limit, remaining = check_checker_rate_limit(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Checker rate limit exceeded. Please wait before running another check.",
            headers={"Retry-After": "60"}
        )
    request.state.rate_limit_remaining = remaining
    request.state.rate_limit_limit = limit


# ------------------------------------------------------------------
# Request/Response Models
# ------------------------------------------------------------------

class StyleAnalysisRequest(BaseModel):
    """Request model for StyleAgent analysis."""
    content: str = Field(..., description="Text content to analyze style")
    style_reference: Optional[str] = Field(None, description="Reference style name (e.g., '江南', '卡夫卡')")

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        if len(v) > 100000:
            raise ValueError('Content exceeds maximum length of 100000 characters')
        return v.strip()


class StyleAnalysisResponse(BaseModel):
    """Response model for StyleAgent analysis."""
    style_match_score: int = Field(..., ge=0, le=100, description="How well content matches target style")
    detected_style: str = Field("", description="Detected writing style")
    suggestions: list[str] = Field(default_factory=list)
    analysis: str = Field("", description="Detailed style analysis")


class ReviewRequest(BaseModel):
    """Request model for ReviewAgent execution."""
    content: str = Field(..., description="Chapter content to review")
    context: dict[str, Any] = Field(default_factory=dict, description="Additional context for deep analysis")
    settings: dict[str, Any] = Field(default_factory=dict, description="Review settings and constraints")

    @field_validator("content")
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Content cannot be empty")
        return v.strip()


class ReviewResponse(BaseModel):
    """Response model for ReviewAgent execution."""
    overall_score: int = Field(..., ge=0, le=100)
    severity: str
    total_issues: int
    issues: list[dict[str, Any]]
    suggestions: list[str]
    checker_scores: dict[str, int]
    phase_results: dict[str, Any]
    disagreements: list[dict[str, Any]]
    confidence: float = Field(..., ge=0.0, le=1.0)
    metadata: dict[str, Any]


class PlotRequest(BaseModel):
    """Request model for PlotAgent execution."""
    task_type: str = Field("full", description="Analysis type: foreshadowing, climax, rhythm, full")
    content: str = Field("", description="Current chapter content")
    outline: dict[str, Any] = Field(default_factory=dict, description="Story outline")
    chapters: list[dict[str, Any]] = Field(default_factory=list, description="Previous chapter summaries")
    active_threads: list[dict[str, Any]] = Field(default_factory=list, description="Active plot threads")
    progress: float = Field(0.5, ge=0.0, le=1.0, description="Story progress 0.0-1.0")

    @field_validator("task_type")
    @classmethod
    def validate_task_type(cls, v: str) -> str:
        allowed = {"foreshadowing", "climax", "rhythm", "full"}
        if v not in allowed:
            raise ValueError(f"task_type must be one of: {', '.join(sorted(allowed))}")
        return v


class PlotResponse(BaseModel):
    """Response model for PlotAgent execution."""
    results: dict[str, Any]
    confidence: float = Field(..., ge=0.0, le=1.0)
    metadata: dict[str, Any]


class CheckerInfo(BaseModel):
    """Info about an available checker."""
    name: str
    description: str
    supports_quick_scan: bool = True
    supports_deep_analyze: bool = True


class CheckerListResponse(BaseModel):
    """Response listing all available checkers."""
    checkers: list[CheckerInfo]
    total: int


class CheckerRunRequest(BaseModel):
    """Request to run a specific checker."""
    checker_name: str = Field(..., description="Name of checker to run")
    chapter_id: int = Field(..., description="Chapter ID to check")
    mode: str = Field("quick", description="Run mode: 'quick' or 'deep'")

    @field_validator('checker_name')
    @classmethod
    def validate_checker_name(cls, v: str) -> str:
        valid_names = {
            "outline_law", "setting_physics", "consistency",
            "continuity", "pacing", "ooc", "high_point", "reader_pull"
        }
        if v not in valid_names:
            raise ValueError(f'checker_name must be one of: {", ".join(sorted(valid_names))}')
        return v

    @field_validator('chapter_id')
    @classmethod
    def validate_chapter_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('chapter_id must be a positive integer')
        return v

    @field_validator('mode')
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in ("quick", "deep"):
            raise ValueError("mode must be 'quick' or 'deep'")
        return v


class CheckerRunResponse(BaseModel):
    """Response from running a checker."""
    checker_name: str
    chapter_id: int
    mode: str
    score: int = Field(..., ge=0, le=100)
    issues: list[dict[str, Any]]
    suggestions: list[str]


class PipelineRequest(BaseModel):
    """Request to run all checkers via pipeline."""
    chapter_id: int = Field(..., description="Chapter ID to check")
    mode: str = Field("quick", description="Run mode: 'quick' or 'deep'")

    @field_validator('chapter_id')
    @classmethod
    def validate_chapter_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('chapter_id must be a positive integer')
        return v

    @field_validator('mode')
    @classmethod
    def validate_mode(cls, v: str) -> str:
        if v not in ("quick", "deep"):
            raise ValueError("mode must be 'quick' or 'deep'")
        return v


class PipelineResponse(BaseModel):
    """Response from running all checkers via pipeline."""
    chapter_id: int
    mode: str
    overall_score: int = Field(..., ge=0, le=100)
    severity: str = Field(..., description="low|medium|high|critical")
    total_issues: int
    issue_breakdown: dict[str, int]
    all_suggestions: list[str]
    checker_scores: dict[str, int]
    results: dict[str, CheckerRunResponse]


# ------------------------------------------------------------------
# Checker Registry
# ------------------------------------------------------------------

_CHECKER_REGISTRY: Dict[str, Any] = {
    "outline_law": OutlineLawEnforcer,
    "setting_physics": SettingPhysicsEnforcer,
    "consistency": ConsistencyChecker,
    "continuity": ContinuityChecker,
    "pacing": PacingChecker,
    "ooc": OOCChecker,
    "high_point": HighPointChecker,
    "reader_pull": ReaderPullChecker,
}


async def _build_checker_context(
    checker_name: str,
    chapter_id: int,
    db: AsyncSession
) -> Dict[str, Any]:
    """Build context dict for deep analysis from database."""
    context: Dict[str, Any] = {}

    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        return context

    result = await db.execute(
        select(DraftVersion)
        .where(DraftVersion.chapter_id == chapter_id)
        .order_by(DraftVersion.version_number.desc())
    )
    draft = result.scalar_one_or_none()
    context["chapter_content"] = draft.content if draft else chapter.summary or ""

    if chapter.outline_id:
        result = await db.execute(select(Outline).where(Outline.id == chapter.outline_id))
        outline = result.scalar_one_or_none()
        if outline:
            context["outline"] = {
                "id": outline.id,
                "title": outline.title,
                "description": outline.description,
            }

    result = await db.execute(select(WorldSetting))
    world_settings = result.scalars().all()
    context["world_settings"] = [
        {"id": ws.id, "name": ws.name, "description": ws.description}
        for ws in world_settings
    ]

    result = await db.execute(select(Rule))
    rules = result.scalars().all()
    context["rules"] = [
        {"id": r.id, "name": r.name, "description": r.description, "type": r.type}
        for r in rules
    ]

    result = await db.execute(select(Character))
    characters = result.scalars().all()
    context["characters"] = [
        {
            "id": c.id,
            "name": c.name,
            "gender": c.gender,
            "personality": c.personality,
            "desires": c.desires,
            "flaws": c.flaws,
            "cultivation_realm": c.cultivation_realm,
        }
        for c in characters
    ]

    result = await db.execute(
        select(Chapter)
        .where(
            Chapter.outline_id == chapter.outline_id,
            Chapter.chapter_order < chapter.chapter_order
        )
        .order_by(Chapter.chapter_order.desc())
        .limit(3)
    )
    prev_chapters = result.scalars().all()
    context["previous_chapters"] = [
        {"id": c.id, "title": c.title, "summary": c.summary}
        for c in prev_chapters
    ]

    result = await db.execute(
        select(func.count(Character.id)).where(Character.cultivation_realm.isnot(None))
    )
    has_cultivation = result.scalar() or 0
    if has_cultivation > 0:
        context["power_system"] = {
            "type": "cultivation",
            "note": f"检测到{has_cultivation}个角色有修为等级设定",
        }

    return context


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------


@router.post("/style", response_model=StyleAnalysisResponse, dependencies=[require_auth])
async def analyze_style(request: StyleAnalysisRequest):
    """Analyze writing style of provided content.

    Compares content against a reference style and returns match score
    and improvement suggestions. Currently returns a mock implementation
    until the full StyleAgent is implemented.
    """
    content = request.content
    style_ref = request.style_reference or "default"

    markers = {
        "江南": ["细腻", "忧伤", "唯美", "诗意", "婉约"],
        "卡夫卡": ["荒诞", "压抑", "变形", "孤独", "官僚"],
        "加缪": ["荒诞", "存在", "反抗", "阳光", "冷漠"],
        "热血": ["战斗", "热血", "燃烧", "突破", "逆天"],
        "悬疑": ["谜团", "线索", "真相", "隐藏", "秘密"],
    }

    detected = "default"
    max_matches = 0

    for style, keywords in markers.items():
        matches = sum(1 for kw in keywords if kw in content)
        if matches > max_matches:
            max_matches = matches
            detected = style

    match_score = min(100, max_matches * 20 + 20)

    suggestions = [
        f"当前检测到的风格倾向: {detected}",
        f"目标风格参考: {style_ref}",
    ]

    if detected != style_ref and style_ref in markers:
        missing = [kw for kw in markers[style_ref] if kw not in content]
        if missing:
            suggestions.append(f"建议增加以下{style_ref}风格关键词: {', '.join(missing)}")

    return StyleAnalysisResponse(
        style_match_score=match_score,
        detected_style=detected,
        suggestions=suggestions,
        analysis=f"基于关键词匹配的风格分析（预留接口，完整StyleAgent待实现）。检测到{max_matches}个风格标记词。"
    )


@router.post("/review", response_model=ReviewResponse, dependencies=[require_auth])
async def run_review_agent(request: ReviewRequest) -> ReviewResponse:
    """Execute ReviewAgent for multi-round quality review.

    Runs a three-phase review process:
    1. Quick scan: Fast heuristic checks
    2. Deep analysis: AI-powered thorough analysis
    3. Cross-validation: Compare results and flag disagreements

    Returns a structured review report with overall score, issues,
    suggestions, and phase comparison.
    """
    from backend.agents.review_agent import ReviewAgent
    from backend.agents.base import AgentContext

    provider = get_ai_provider()
    event_bus = get_event_bus()

    agent = ReviewAgent(provider, event_bus)

    context = AgentContext(
        task=request.content,
        settings={"context": request.context, **request.settings},
    )

    try:
        result = await agent.execute(context)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Review agent execution failed: {str(exc)}",
        )

    content = result.content if isinstance(result.content, dict) else {}

    return ReviewResponse(
        overall_score=content.get("overall_score", 0),
        severity=content.get("severity", "unknown"),
        total_issues=content.get("total_issues", 0),
        issues=content.get("issues", []),
        suggestions=content.get("suggestions", []),
        checker_scores=content.get("checker_scores", {}),
        phase_results=content.get("phase_results", {}),
        disagreements=content.get("disagreements", []),
        confidence=result.confidence,
        metadata=result.metadata,
    )


@router.post("/plot", response_model=PlotResponse, dependencies=[require_auth])
async def run_plot_agent(request: PlotRequest) -> PlotResponse:
    """Execute PlotAgent for plot design and rhythm analysis.

    Supports three analysis modes:
    - foreshadowing: Suggest new hooks and resolve existing ones
    - climax: Plan climax pacing based on outline
    - rhythm: Analyze tension curve across chapters
    - full: Run all three analyses

    Returns structured plot suggestions and analysis.
    """
    from backend.agents.plot_agent import PlotAgent
    from backend.agents.base import AgentContext

    provider = get_ai_provider()
    event_bus = get_event_bus()

    agent = PlotAgent(provider, event_bus)

    context = AgentContext(
        task=request.task_type,
        settings={
            "content": request.content,
            "outline": request.outline,
            "chapters": request.chapters,
            "active_threads": request.active_threads,
            "progress": request.progress,
        },
    )

    try:
        result = await agent.execute(context)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Plot agent execution failed: {str(exc)}",
        )

    return PlotResponse(
        results=result.content if isinstance(result.content, dict) else {},
        confidence=result.confidence,
        metadata=result.metadata,
    )


@router.get("/checkers", response_model=CheckerListResponse)
async def list_checkers():
    """Get list of all available quality checkers."""
    checkers = [
        CheckerInfo(
            name="outline_law",
            description="检查正文是否违反大纲关键设定（角色生死、剧情走向、风格基调等）",
            supports_quick_scan=True,
            supports_deep_analyze=True,
        ),
        CheckerInfo(
            name="setting_physics",
            description="检查正文是否违反世界观的物理/规则一致性（修仙体系、魔法规则、力量层级等）",
            supports_quick_scan=True,
            supports_deep_analyze=True,
        ),
        CheckerInfo(
            name="consistency",
            description="检查世界设定一致性（地点、时间线、实力等级、物品归属等）",
            supports_quick_scan=False,
            supports_deep_analyze=True,
        ),
        CheckerInfo(
            name="continuity",
            description="检查叙事连续性（场景转换、事件连贯、角色状态、伏笔呼应等）",
            supports_quick_scan=False,
            supports_deep_analyze=True,
        ),
        CheckerInfo(
            name="pacing",
            description="检查叙事节奏和故事线比例（任务线/燃情线/星座线）",
            supports_quick_scan=False,
            supports_deep_analyze=True,
        ),
        CheckerInfo(
            name="ooc",
            description="检查角色行为是否符合性格设定（OOC检测）",
            supports_quick_scan=False,
            supports_deep_analyze=True,
        ),
        CheckerInfo(
            name="high_point",
            description="检查高潮分布和兴奋点密度",
            supports_quick_scan=False,
            supports_deep_analyze=True,
        ),
        CheckerInfo(
            name="reader_pull",
            description="检查读者吸引力和钩子效果",
            supports_quick_scan=False,
            supports_deep_analyze=True,
        ),
    ]

    return CheckerListResponse(checkers=checkers, total=len(checkers))


@router.post("/check", response_model=CheckerRunResponse, dependencies=[require_auth])
async def run_checker(
    request: CheckerRunRequest,
    db: AsyncSession = Depends(get_db),
    _rate_limit=Depends(require_checker_rate_limit)
):
    """Run a specific checker on a chapter.

    Supports both quick_scan (heuristic) and deep_analyze (AI-powered) modes.
    For 'deep' mode, automatically builds context from the database.
    """
    checker_cls = _CHECKER_REGISTRY.get(request.checker_name)
    if not checker_cls:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown checker: {request.checker_name}"
        )

    result = await db.execute(select(Chapter).where(Chapter.id == request.chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter {request.chapter_id} not found"
        )

    result = await db.execute(
        select(DraftVersion)
        .where(DraftVersion.chapter_id == request.chapter_id)
        .order_by(DraftVersion.version_number.desc())
    )
    draft = result.scalar_one_or_none()
    content = draft.content if draft else chapter.summary or ""

    ai_svc = get_ai_service()

    try:
        if request.mode == "quick":
            if issubclass(checker_cls, BaseChecker):
                checker = checker_cls(ai_svc)
                result_obj: CheckerResult = await checker.quick_scan(content)
            else:
                checker = checker_cls(ai_svc)
                raw = await checker.check(request.chapter_id, db)
                result_obj = CheckerResult(
                    score=raw.get("score", 0),
                    issues=[{"type": "legacy", "message": issue} for issue in raw.get("issues", [])],
                    suggestions=raw.get("suggestions", []),
                )
        else:
            context = await _build_checker_context(request.checker_name, request.chapter_id, db)

            if issubclass(checker_cls, BaseChecker):
                checker = checker_cls(ai_svc)
                result_obj = await checker.deep_analyze(content, context)
            else:
                checker = checker_cls(ai_svc)
                raw = await checker.check(request.chapter_id, db)
                result_obj = CheckerResult(
                    score=raw.get("score", 0),
                    issues=[{"type": "legacy", "message": issue} for issue in raw.get("issues", [])],
                    suggestions=raw.get("suggestions", []),
                )

        return CheckerRunResponse(
            checker_name=request.checker_name,
            chapter_id=request.chapter_id,
            mode=request.mode,
            score=result_obj.score,
            issues=result_obj.issues,
            suggestions=result_obj.suggestions,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Checker '{request.checker_name}' failed: {str(e)}"
        )


@router.post("/check-all", response_model=PipelineResponse, dependencies=[require_auth])
async def run_all_checkers(
    request: PipelineRequest,
    db: AsyncSession = Depends(get_db),
    _rate_limit=Depends(require_checker_rate_limit)
):
    """Run all available checkers on a chapter and aggregate results.

    Uses CheckerPipeline for parallel execution.
    """
    result = await db.execute(select(Chapter).where(Chapter.id == request.chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chapter {request.chapter_id} not found"
        )

    ai_svc = get_ai_service()

    base_checkers = []
    for name, cls in _CHECKER_REGISTRY.items():
        if issubclass(cls, BaseChecker):
            base_checkers.append(cls(ai_svc))

    if not base_checkers:
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="No BaseChecker implementations available for pipeline"
        )

    pipeline = CheckerPipeline(base_checkers)

    result = await db.execute(
        select(DraftVersion)
        .where(DraftVersion.chapter_id == request.chapter_id)
        .order_by(DraftVersion.version_number.desc())
    )
    draft = result.scalar_one_or_none()
    content = draft.content if draft else chapter.summary or ""

    try:
        if request.mode == "quick":
            results = await pipeline.run_quick_scan(content)
        else:
            context = await _build_checker_context("all", request.chapter_id, db)
            results = await pipeline.run_deep_analysis(content, context)

        aggregated = pipeline.aggregate_results(results)

        checker_results = {}
        for name, checker_result in results.items():
            checker_results[name] = CheckerRunResponse(
                checker_name=name,
                chapter_id=request.chapter_id,
                mode=request.mode,
                score=checker_result.score,
                issues=checker_result.issues,
                suggestions=checker_result.suggestions,
            )

        return PipelineResponse(
            chapter_id=request.chapter_id,
            mode=request.mode,
            overall_score=aggregated["overall_score"],
            severity=aggregated["severity"],
            total_issues=aggregated["total_issues"],
            issue_breakdown=aggregated["issue_breakdown"],
            all_suggestions=aggregated["all_suggestions"],
            checker_scores=aggregated["checker_scores"],
            results=checker_results,
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Pipeline execution failed: {str(e)}"
        )
