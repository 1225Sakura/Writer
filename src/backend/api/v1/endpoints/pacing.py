"""Pacing routes - API endpoints for Strand Weave pacing analysis.

Endpoints:
- GET /pacing/strands          : Get strand definitions and ideal ratios
- GET /pacing/analysis/{outline_id} : Analyze pacing for an outline
- GET /pacing/redlines         : Get current red line status
- POST /pacing/advice          : Get advice for next chapter's strand
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.middleware.auth import require_auth
from backend.services.pacing_analyzer import PacingAnalyzer
from backend.services.rhythm_advisor import RhythmAdvisor
from backend.services.strand_classifier import StrandClassifier

router = APIRouter(prefix="/pacing", tags=["pacing"], dependencies=[require_auth])


# ------------------------------------------------------------------
# Request/Response Models
# ------------------------------------------------------------------

class StrandDefinitionsResponse(BaseModel):
    """Strand definitions and ideal ratios."""
    strands: list[dict]
    red_lines: list[dict]
    ideal_ratios: dict[str, float]


class PacingAnalysisResponse(BaseModel):
    """Pacing analysis response."""
    outline_id: int
    total_chapters: int
    strand_ratios: dict[str, float]
    chapter_classifications: list[dict]
    red_line_violations: list[dict]
    quest_streak: int
    fire_gap: int
    constellation_gap: int
    health_score: int
    summary: str


class RedLinesResponse(BaseModel):
    """Current red line status."""
    red_lines: list[dict]
    current_status: dict[str, int]
    violations_count: int
    warnings_count: int


class AdviceRequest(BaseModel):
    """Request for strand advice."""
    outline_id: int = Field(..., gt=0, description="Outline ID to analyze")
    use_ai: bool = Field(default=False, description="Use AI-powered classification")
    chapter_position: Optional[int] = Field(
        default=None, gt=0, description="Specific chapter position (1-based). None = next chapter"
    )


class AdviceResponse(BaseModel):
    """Strand advice response."""
    recommended_strand: str
    confidence: float
    reasoning: str
    urgency: str
    alternative_strands: list[str]
    suggested_elements: list[str]
    warnings: list[str]
    current_ratios: Optional[dict[str, float]] = None
    health_score: Optional[int] = None


# ------------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------------

def get_pacing_analyzer() -> PacingAnalyzer:
    """Get PacingAnalyzer instance."""
    return PacingAnalyzer()


def get_rhythm_advisor() -> RhythmAdvisor:
    """Get RhythmAdvisor instance."""
    return RhythmAdvisor()


def get_strand_classifier() -> StrandClassifier:
    """Get StrandClassifier instance."""
    return StrandClassifier()


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.get(
    "/strands",
    response_model=StrandDefinitionsResponse,
    summary="获取Strand定义",
    description="获取三种故事线（Quest/Fire/Constellation）的定义、理想占比和红线规则。",
)
async def get_strand_definitions():
    """Get strand definitions and ideal ratios."""
    return StrandDefinitionsResponse(
        strands=[
            {
                "name": "quest",
                "display_name": "主线剧情",
                "description": "主角追求目标、完成任务、推进核心冲突的内容",
                "ideal_ratio": 0.60,
                "color": "#5b8ee8",
            },
            {
                "name": "fire",
                "display_name": "感情线",
                "description": "角色情感发展、关系变化、人物羁绊的内容",
                "ideal_ratio": 0.20,
                "color": "#c45c5c",
            },
            {
                "name": "constellation",
                "display_name": "世界观扩展",
                "description": "背景设定、势力介绍、规则体系、世界探索的内容",
                "ideal_ratio": 0.20,
                "color": "#9b7ed9",
            },
        ],
        red_lines=[
            {
                "strand": "quest",
                "rule": "continuous",
                "limit": 5,
                "description": "Quest连续出现不超过5章",
                "severity": "critical",
            },
            {
                "strand": "fire",
                "rule": "gap",
                "limit": 10,
                "description": "Fire断档不超过10章",
                "severity": "warning",
            },
            {
                "strand": "constellation",
                "rule": "gap",
                "limit": 15,
                "description": "Constellation断档不超过15章",
                "severity": "warning",
            },
        ],
        ideal_ratios={
            "quest": 0.60,
            "fire": 0.20,
            "constellation": 0.20,
        },
    )


@router.get(
    "/analysis/{outline_id}",
    response_model=PacingAnalysisResponse,
    summary="分析大纲节奏",
    description="分析指定大纲的所有章节的Strand比例、红线违规和健康评分。",
)
async def analyze_pacing(
    outline_id: int,
    use_ai: bool = Query(default=False, description="Use AI-powered classification"),
    db: AsyncSession = Depends(get_db),
    analyzer: PacingAnalyzer = Depends(get_pacing_analyzer),
):
    """Analyze pacing for all chapters in an outline.

    Args:
        outline_id: The outline ID to analyze.
        use_ai: If True, use AI for classification instead of heuristic.
        db: Database session.
        analyzer: PacingAnalyzer instance.

    Returns:
        PacingAnalysisResponse with full analysis.
    """
    from sqlalchemy import select
    from backend.core.domain import Outline

    # Verify outline exists
    result = await db.execute(select(Outline).where(Outline.id == outline_id))
    outline = result.scalar_one_or_none()
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")

    analysis = await analyzer.analyze_outline(outline_id, db, use_ai=use_ai)

    return PacingAnalysisResponse(
        outline_id=analysis.outline_id,
        total_chapters=analysis.total_chapters,
        strand_ratios=analysis.strand_ratios,
        chapter_classifications=analysis.chapter_classifications,
        red_line_violations=[v.to_dict() for v in analysis.red_line_violations],
        quest_streak=analysis.quest_streak,
        fire_gap=analysis.fire_gap,
        constellation_gap=analysis.constellation_gap,
        health_score=analysis.health_score,
        summary=analysis.summary,
    )


@router.get(
    "/redlines",
    response_model=RedLinesResponse,
    summary="获取红线状态",
    description="获取所有红线的定义和当前状态（需要指定outline_id查询实际状态）。",
)
async def get_redlines(
    outline_id: int = Query(..., gt=0, description="Outline ID to check"),
    db: AsyncSession = Depends(get_db),
    analyzer: PacingAnalyzer = Depends(get_pacing_analyzer),
):
    """Get current red line status for an outline.

    Args:
        outline_id: The outline ID to check.
        db: Database session.
        analyzer: PacingAnalyzer instance.

    Returns:
        RedLinesResponse with red line definitions and current status.
    """
    from sqlalchemy import select
    from backend.core.domain import Outline

    result = await db.execute(select(Outline).where(Outline.id == outline_id))
    outline = result.scalar_one_or_none()
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")

    analysis = await analyzer.analyze_outline(outline_id, db, use_ai=False)

    violations = [v.to_dict() for v in analysis.red_line_violations]
    violations_count = sum(1 for v in violations if v["severity"] == "critical")
    warnings_count = sum(1 for v in violations if v["severity"] == "warning")

    return RedLinesResponse(
        red_lines=[
            {
                "strand": "quest",
                "rule": "continuous",
                "limit": 5,
                "current": analysis.quest_streak,
                "status": "violated" if analysis.quest_streak > 5 else "warning" if analysis.quest_streak >= 4 else "ok",
            },
            {
                "strand": "fire",
                "rule": "gap",
                "limit": 10,
                "current": analysis.fire_gap,
                "status": "violated" if analysis.fire_gap > 10 else "warning" if analysis.fire_gap >= 8 else "ok",
            },
            {
                "strand": "constellation",
                "rule": "gap",
                "limit": 15,
                "current": analysis.constellation_gap,
                "status": "violated" if analysis.constellation_gap > 15 else "warning" if analysis.constellation_gap >= 12 else "ok",
            },
        ],
        current_status={
            "quest_streak": analysis.quest_streak,
            "fire_gap": analysis.fire_gap,
            "constellation_gap": analysis.constellation_gap,
            "health_score": analysis.health_score,
        },
        violations_count=violations_count,
        warnings_count=warnings_count,
    )


@router.post(
    "/advice",
    response_model=AdviceResponse,
    summary="获取下一章Strand建议",
    description="基于当前节奏状态，给出下一章应该侧重哪种故事线的建议。",
)
async def get_advice(
    request: AdviceRequest,
    db: AsyncSession = Depends(get_db),
    advisor: RhythmAdvisor = Depends(get_rhythm_advisor),
    analyzer: PacingAnalyzer = Depends(get_pacing_analyzer),
):
    """Get advice for the next chapter's strand.

    Args:
        request: AdviceRequest with outline_id and options.
        db: Database session.
        advisor: RhythmAdvisor instance.
        analyzer: PacingAnalyzer instance.

    Returns:
        AdviceResponse with recommendation and reasoning.
    """
    from sqlalchemy import select
    from backend.core.domain import Outline

    result = await db.execute(select(Outline).where(Outline.id == request.outline_id))
    outline = result.scalar_one_or_none()
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")

    if request.chapter_position is not None:
        advice = await advisor.advise_for_chapter_position(
            request.outline_id, request.chapter_position, db, use_ai=request.use_ai
        )
    else:
        advice = await advisor.advise_next_chapter(
            request.outline_id, db, use_ai=request.use_ai
        )

    # Get current ratios for context
    analysis = await analyzer.analyze_outline(request.outline_id, db, use_ai=request.use_ai)

    return AdviceResponse(
        recommended_strand=advice.recommended_strand,
        confidence=advice.confidence,
        reasoning=advice.reasoning,
        urgency=advice.urgency,
        alternative_strands=advice.alternative_strands,
        suggested_elements=advice.suggested_elements,
        warnings=advice.warnings,
        current_ratios=analysis.strand_ratios,
        health_score=analysis.health_score,
    )
