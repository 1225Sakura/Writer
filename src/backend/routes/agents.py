"""Agent Routes - API endpoints for AI agent execution.

Provides endpoints for running specialized AI agents:
- ReviewAgent: Multi-round quality review
- PlotAgent: Plot design and rhythm analysis
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel, Field, field_validator

from backend.middleware.auth import require_auth
from backend.services.ai.provider import AIProvider
from backend.utils.event_bus import AsyncEventBus

router = APIRouter(prefix="/agents", tags=["agents"])

# ------------------------------------------------------------------
# Request/Response Models
# ------------------------------------------------------------------


class ReviewRequest(BaseModel):
    """Request model for ReviewAgent execution."""

    content: str = Field(..., description="Chapter content to review")
    context: dict[str, Any] = Field(
        default_factory=dict, description="Additional context for deep analysis"
    )
    settings: dict[str, Any] = Field(
        default_factory=dict, description="Review settings and constraints"
    )

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
    chapters: list[dict[str, Any]] = Field(
        default_factory=list, description="Previous chapter summaries"
    )
    active_threads: list[dict[str, Any]] = Field(
        default_factory=list, description="Active plot threads"
    )
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


# ------------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------------

# Global event bus instance (shared across agents)
_event_bus: Optional[AsyncEventBus] = None


def get_event_bus() -> AsyncEventBus:
    """Get or create the shared event bus instance."""
    global _event_bus
    if _event_bus is None:
        _event_bus = AsyncEventBus()
    return _event_bus


# Placeholder for AI provider dependency
# In production, this should be injected via a proper dependency mechanism
_ai_provider: Optional[AIProvider] = None


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


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------


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
