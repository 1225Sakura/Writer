# -*- coding: utf-8 -*-
"""
Engagement / Hook Analysis Routes

Endpoints for reader engagement analysis, hook detection, and narrative debt tracking.

- POST /engagement/analyze/{chapter_id}  - Full engagement analysis
- GET  /engagement/hooks/{chapter_id}    - Hook detection for a chapter
- GET  /engagement/debts                 - Narrative debt tracking
- GET  /engagement/score/{chapter_id}    - Overall engagement score
"""

import json
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from backend.database import get_db
from backend.middleware.auth import require_auth
from backend.core.domain import Chapter, DraftVersion, AIInspectionResult, PlotThread
from backend.services.content_storage import ContentStorage
from backend.services.hook_detector import HookDetector, hook_detector
from backend.services.engagement_analyzer import EngagementAnalyzer, engagement_analyzer
from backend.services.debt_tracker import DebtTracker, debt_tracker, NarrativeDebt
from backend.services.cache_service import cached, get_cache_service
from backend.config import settings


# ------------------------------------------------------------------
# Response Models
# ------------------------------------------------------------------

class HookItem(BaseModel):
    """A single detected hook."""
    model_config = ConfigDict(populate_by_name=True)

    type: str
    position: str
    text: str
    confidence: float
    keywords: List[str]
    context: str
    line_number: Optional[int] = None


class HookAnalysisResponse(BaseModel):
    """Hook analysis response."""
    model_config = ConfigDict(populate_by_name=True)

    chapter_id: int
    total_hooks: int
    hooks_by_type: dict
    hooks_by_position: dict
    hooks: List[HookItem]
    opening_hook_strength: float
    ending_hook_strength: float
    overall_hook_score: float
    suggestions: List[str]


class CoolPointItem(BaseModel):
    """A single cool point."""
    model_config = ConfigDict(populate_by_name=True)

    type: str
    text: str
    intensity: float
    position: float
    context: str


class FulfillmentItem(BaseModel):
    """A single fulfillment moment."""
    model_config = ConfigDict(populate_by_name=True)

    size: str
    text: str
    position: float
    context: str


class EngagementAnalysisResponse(BaseModel):
    """Full engagement analysis response."""
    model_config = ConfigDict(populate_by_name=True)

    chapter_id: int
    word_count: int
    cool_points: List[CoolPointItem]
    cool_point_count: int
    cool_point_density: float
    cool_point_score: float
    fulfillments: List[FulfillmentItem]
    fulfillment_count: int
    fulfillment_score: float
    predicted_retention: float
    retention_factors: dict
    overall_engagement_score: float
    pacing_analysis: dict
    suggestions: List[str]


class DebtItem(BaseModel):
    """A single narrative debt."""
    model_config = ConfigDict(populate_by_name=True)

    id: Optional[int] = None
    type: str
    status: str
    priority: str
    title: str
    description: str
    created_chapter_id: Optional[int] = None
    created_chapter_title: Optional[str] = None
    expected_chapter_id: Optional[int] = None
    resolved_chapter_id: Optional[int] = None
    keywords: List[str]
    overdue_chapters: int = 0


class DebtReportResponse(BaseModel):
    """Narrative debt report response."""
    model_config = ConfigDict(populate_by_name=True)

    total_debts: int
    active_debts: int
    fulfilled_debts: int
    overdue_debts: int
    abandoned_debts: int
    debts_by_type: dict
    debts_by_priority: dict
    critical_overdue: List[DebtItem]
    high_priority_active: List[DebtItem]
    debt_health_score: float
    risk_assessment: str
    suggestions: List[str]


class EngagementScoreResponse(BaseModel):
    """Simplified engagement score response."""
    model_config = ConfigDict(populate_by_name=True)

    chapter_id: int
    hook_score: float
    engagement_score: float
    predicted_retention: float
    overall_score: float
    grade: str
    suggestions: List[str]


# ------------------------------------------------------------------
# Router
# ------------------------------------------------------------------

router = APIRouter(prefix="/engagement", tags=["engagement"], dependencies=[require_auth])

content_storage = ContentStorage()


# ------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------

async def _get_chapter_content(chapter_id: int, db: AsyncSession) -> str:
    """Get chapter content from storage or draft versions."""
    # Try to get chapter with content_storage_id
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Try content storage first
    if chapter.content_storage_id:
        try:
            return content_storage.load(
                chapter.content_storage_id,
                project_id=getattr(chapter, 'project_id', 1)
            )
        except FileNotFoundError:
            pass

    # Fall back to latest draft version
    result = await db.execute(
        select(DraftVersion)
        .where(DraftVersion.chapter_id == chapter_id)
        .order_by(desc(DraftVersion.version_number))
        .limit(1)
    )
    draft = result.scalar_one_or_none()
    if draft and draft.content:
        return draft.content

    # Try summary as last resort
    if chapter.summary:
        return chapter.summary

    return ""


def _grade_from_score(score: float) -> str:
    """Convert numeric score to letter grade."""
    if score >= 90:
        return "S"
    if score >= 80:
        return "A"
    if score >= 70:
        return "B"
    if score >= 60:
        return "C"
    if score >= 40:
        return "D"
    return "F"


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.post(
    "/analyze/{chapter_id}",
    response_model=EngagementAnalysisResponse,
    summary="分析章节吸引力",
    description="对指定章节进行完整的吸引力分析，包括爽点检测、微兑现检测、留存预测和节奏分析。",
)
async def analyze_chapter_engagement(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Perform full engagement analysis on a chapter."""
    content = await _get_chapter_content(chapter_id, db)
    if not content:
        raise HTTPException(status_code=400, detail="Chapter has no content to analyze")

    result = engagement_analyzer.analyze_quick(chapter_id, content)

    # Store result as AIInspectionResult for persistence
    inspection = AIInspectionResult(
        chapter_id=chapter_id,
        inspection_type="engagement_analysis",
        issues_json=json.dumps({
            "predicted_retention": result.get("predicted_retention"),
            "pacing": result.get("pacing_analysis", {}),
        }, ensure_ascii=False),
        suggestions_json=json.dumps(result.get("suggestions", []), ensure_ascii=False),
    )
    db.add(inspection)
    await db.flush()

    return result


@router.get(
    "/hooks/{chapter_id}",
    response_model=HookAnalysisResponse,
    summary="检测章节钩子",
    description="检测指定章节中的叙事钩子（悬念钩子、情感钩子、冲突钩子、谜题钩子、伏笔钩子）。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="engagement:hooks", invalidate_on=["chapters"])
async def detect_chapter_hooks(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Detect narrative hooks in a chapter."""
    content = await _get_chapter_content(chapter_id, db)
    if not content:
        raise HTTPException(status_code=400, detail="Chapter has no content to analyze")

    result = hook_detector.detect_quick(chapter_id, content)
    return result


@router.get(
    "/debts",
    response_model=DebtReportResponse,
    summary="获取叙事债务报告",
    description="获取当前项目的叙事债务追踪报告，包括已创建、已兑现和超期的债务。",
)
async def get_narrative_debts(
    project_id: Optional[int] = Query(None, description="Project ID to filter debts"),
    current_chapter_id: Optional[int] = Query(None, description="Current chapter for overdue calc"),
    db: AsyncSession = Depends(get_db),
):
    """Get narrative debt report."""
    # Load debts from PlotThread table (repurposed via JSON)
    query = select(PlotThread)
    if project_id:
        query = query.where(PlotThread.project_id == project_id)

    result = await db.execute(query.order_by(desc(PlotThread.created_at)))
    plot_threads = result.scalars().all()

    # Convert PlotThreads to NarrativeDebts
    debts = []
    for thread in plot_threads:
        # Parse description as JSON if it contains debt data
        if thread.description and thread.description.startswith("{"):
            try:
                debt_data = json.loads(thread.description)
                debt = debt_tracker.debt_from_json(debt_data)
                debt.id = thread.id
                debts.append(debt)
            except json.JSONDecodeError:
                # Treat as plain description, create generic debt
                debts.append(NarrativeDebt(
                    id=thread.id,
                    type=debt_tracker._infer_type_from_title(thread.title),
                    title=thread.title,
                    description=thread.description or "",
                    status=debt_tracker._status_from_string(thread.status),
                    created_chapter_id=thread.created_chapter_id,
                ))
        else:
            debts.append(NarrativeDebt(
                id=thread.id,
                type=debt_tracker._infer_type_from_title(thread.title),
                title=thread.title,
                description=thread.description or "",
                status=debt_tracker._status_from_string(thread.status),
                created_chapter_id=thread.created_chapter_id,
            ))

    report = debt_tracker.generate_report(debts, current_chapter_id)
    return debt_tracker.report_to_json(report)


@router.get(
    "/score/{chapter_id}",
    response_model=EngagementScoreResponse,
    summary="获取章节综合评分",
    description="获取指定章节的综合吸引力评分，包含钩子分、engagement分、留存预测和总评级。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="engagement:score", invalidate_on=["chapters"])
async def get_chapter_engagement_score(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get combined engagement score for a chapter."""
    content = await _get_chapter_content(chapter_id, db)
    if not content:
        raise HTTPException(status_code=400, detail="Chapter has no content to analyze")

    # Run both analyses
    hook_result = hook_detector.detect(chapter_id, content)
    engagement_result = engagement_analyzer.analyze(chapter_id, content)

    # Calculate overall score
    overall = (
        hook_result.overall_hook_score * 0.35 +
        engagement_result.overall_engagement_score * 0.35 +
        engagement_result.predicted_retention * 0.30
    )

    # Combine suggestions
    all_suggestions = list(set(
        hook_result.suggestions + engagement_result.suggestions
    ))

    return {
        "chapter_id": chapter_id,
        "hook_score": round(hook_result.overall_hook_score, 1),
        "engagement_score": round(engagement_result.overall_engagement_score, 1),
        "predicted_retention": round(engagement_result.predicted_retention, 1),
        "overall_score": round(overall, 1),
        "grade": _grade_from_score(overall),
        "suggestions": all_suggestions[:5],  # Limit to top 5
    }


@router.post(
    "/debts/detect/{chapter_id}",
    response_model=List[DebtItem],
    summary="从章节检测叙事债务",
    description="分析指定章节内容，检测新的叙事债务（承诺、伏笔、谜题等）。",
)
async def detect_debts_from_chapter(
    chapter_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Detect new narrative debts from chapter content."""
    content = await _get_chapter_content(chapter_id, db)
    if not content:
        raise HTTPException(status_code=400, detail="Chapter has no content to analyze")

    # Get chapter title
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Load existing debts
    existing_result = await db.execute(select(PlotThread))
    existing_threads = existing_result.scalars().all()
    existing_debts = []
    for thread in existing_threads:
        if thread.description and thread.description.startswith("{"):
            try:
                debt_data = json.loads(thread.description)
                debt = debt_tracker.debt_from_json(debt_data)
                debt.id = thread.id
                existing_debts.append(debt)
            except json.JSONDecodeError:
                pass

    # Detect new debts
    new_debts = debt_tracker.detect_debts_from_content(
        chapter_id=chapter_id,
        chapter_title=chapter.title or f"Chapter {chapter_id}",
        content=content,
        existing_debts=existing_debts,
    )

    # Save new debts as PlotThreads
    for debt in new_debts:
        thread = PlotThread(
            project_id=chapter.project_id,
            title=debt.title,
            description=json.dumps(debt_tracker.debt_to_json(debt), ensure_ascii=False),
            status="active",
            created_chapter_id=chapter_id,
        )
        db.add(thread)

    await db.flush()
    await get_cache_service().ainvalidate_tag("plotthreads")

    return [debt_tracker.debt_to_json(d) for d in new_debts]


@router.post(
    "/debts/resolve/{debt_id}",
    summary="标记债务为已兑现",
    description="将指定的叙事债务标记为已兑现状态。",
)
async def resolve_debt(
    debt_id: int,
    resolved_chapter_id: Optional[int] = Query(None, description="Chapter where debt was resolved"),
    db: AsyncSession = Depends(get_db),
):
    """Mark a narrative debt as fulfilled."""
    result = await db.execute(select(PlotThread).where(PlotThread.id == debt_id))
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status_code=404, detail="Debt not found")

    # Update status in JSON description
    if thread.description and thread.description.startswith("{"):
        try:
            debt_data = json.loads(thread.description)
            debt_data["status"] = "fulfilled"
            debt_data["resolved_chapter_id"] = resolved_chapter_id
            debt_data["resolved_at"] = datetime.utcnow().isoformat()
            thread.description = json.dumps(debt_data, ensure_ascii=False)
        except json.JSONDecodeError:
            pass

    thread.status = "resolved"
    if resolved_chapter_id:
        thread.reveal_chapter_id = resolved_chapter_id

    await db.flush()
    await get_cache_service().ainvalidate_tag("plotthreads")

    return {"message": "Debt marked as fulfilled", "debt_id": debt_id}
