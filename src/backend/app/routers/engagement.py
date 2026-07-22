"""Engagement routes (v0.5 Phase 1 Track B.2).

6 endpoints (all X-API-Key + verify_api_key):
1. GET    /api/v1/engagement/{chapter_id}/score         — latest engagement score
2. POST   /api/v1/engagement/{chapter_id}/compute       — trigger compute, persist score
3. GET    /api/v1/engagement/{chapter_id}/cool-points   — list cool points
4. POST   /api/v1/engagement/{chapter_id}/cool-points   — create cool point
5. DELETE /api/v1/engagement/cool-points/{id}           — delete cool point
6. GET    /api/v1/engagement/{chapter_id}/fulfillment   — list fulfillments

Scoring algorithm: simple heuristic based on cool point count + fulfillment
density. Real scoring (using AI service) is Phase 2+ work.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.core.security import verify_api_key
from app.database import get_db
from app.repositories.engagement import EngagementRepository
from app.schemas.engagement import (
    ComputeRequest,
    ComputeResponse,
    CoolPointCreate,
    CoolPointList,
    CoolPointOut,
    EngagementScoreOut,
    FulfillmentList,
    FulfillmentOut,
)
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/engagement",
    tags=["Engagement"],
    dependencies=[Depends(verify_api_key)],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _grade_from_score(overall: float) -> str:
    """Map overall score (0-1) to letter grade."""
    if overall >= 0.9:
        return "A"
    if overall >= 0.8:
        return "B"
    if overall >= 0.7:
        return "C"
    if overall >= 0.6:
        return "D"
    return "F"


def _compute_score_from_db(repo: EngagementRepository, chapter_id: int) -> EngagementScoreOut:
    """Compute a deterministic engagement score from cool_points + fulfillments.

    Formula (heuristic, deterministic — no AI):
      base = 0.5
      cool_bonus = min(0.3, cool_count * 0.05)
      fulfill_bonus = min(0.2, fulfill_count * 0.04)
      overall = clamp(base + cool_bonus + fulfill_bonus, 0, 1)
    """
    cool_points = repo.list_cool_points(chapter_id)
    fulfillments = repo.list_fulfillments(chapter_id)
    cool_count = len(cool_points)
    fulfill_count = len(fulfillments)

    base = 0.5
    cool_bonus = min(0.3, cool_count * 0.05)
    fulfill_bonus = min(0.2, fulfill_count * 0.04)
    overall = max(0.0, min(1.0, base + cool_bonus + fulfill_bonus))

    return EngagementScoreOut(
        chapter_id=chapter_id,
        hook_score=overall,  # simplified: hook ≈ overall
        engagement_score=overall,
        predicted_retention=overall,
        overall_score=overall,
        grade=_grade_from_score(overall),
        suggestions=[],
    )


# ---------------------------------------------------------------------------
# Endpoint 1: GET /engagement/{chapter_id}/score
# ---------------------------------------------------------------------------

@router.get("/{chapter_id}/score")
def get_score(
    chapter_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Return latest engagement score for a chapter; auto-compute if missing."""
    repo = EngagementRepository(db)
    score = repo.get_score(chapter_id)
    if score is None:
        # Auto-compute and persist
        computed = _compute_score_from_db(repo, chapter_id)
        score = repo.upsert_score(
            chapter_id=chapter_id,
            hook_score=computed.hook_score,
            engagement_score=computed.engagement_score,
            predicted_retention=computed.predicted_retention,
            overall_score=computed.overall_score,
            grade=computed.grade,
        )
    out = EngagementScoreOut(
        chapter_id=score.chapter_id,
        hook_score=score.hook_score,
        engagement_score=score.engagement_score,
        predicted_retention=score.predicted_retention,
        overall_score=score.overall_score,
        grade=score.grade,
        suggestions=[],
    )
    return ApiResponse(data=out.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 2: POST /engagement/{chapter_id}/compute
# ---------------------------------------------------------------------------

@router.post("/{chapter_id}/compute")
def compute_score(
    chapter_id: int = Path(..., ge=1),
    body: Optional[ComputeRequest] = None,
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Trigger score compute and persist result."""
    repo = EngagementRepository(db)
    computed = _compute_score_from_db(repo, chapter_id)
    score = repo.upsert_score(
        chapter_id=chapter_id,
        hook_score=computed.hook_score,
        engagement_score=computed.engagement_score,
        predicted_retention=computed.predicted_retention,
        overall_score=computed.overall_score,
        grade=computed.grade,
        factors={"note": body.note if body else None},
    )
    payload = ComputeResponse(
        chapter_id=chapter_id,
        computed_at=score.updated_at.isoformat() if hasattr(score.updated_at, "isoformat") else str(score.updated_at),
        score=EngagementScoreOut(
            chapter_id=score.chapter_id,
            hook_score=score.hook_score,
            engagement_score=score.engagement_score,
            predicted_retention=score.predicted_retention,
            overall_score=score.overall_score,
            grade=score.grade,
            suggestions=[],
        ),
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 3: GET /engagement/{chapter_id}/cool-points
# ---------------------------------------------------------------------------

@router.get("/{chapter_id}/cool-points")
def list_cool_points(
    chapter_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """List cool points for a chapter."""
    repo = EngagementRepository(db)
    rows = repo.list_cool_points(chapter_id)
    points = [
        CoolPointOut(
            id=r.id,
            chapter_id=r.chapter_id,
            point_type=r.point_type,
            text=r.text,
            intensity=r.intensity,
            position=r.position,
            context=r.context,
        )
        for r in rows
    ]
    payload = CoolPointList(chapter_id=chapter_id, points=points, total=len(points))
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 4: POST /engagement/{chapter_id}/cool-points
# ---------------------------------------------------------------------------

@router.post("/{chapter_id}/cool-points", status_code=status.HTTP_201_CREATED)
def create_cool_point(
    body: CoolPointCreate,
    chapter_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Create a cool point for a chapter."""
    repo = EngagementRepository(db)
    cp = repo.create_cool_point(
        chapter_id=chapter_id,
        text=body.text,
        point_type=body.point_type,
        intensity=body.intensity,
        position=body.position,
        context=body.context,
    )
    out = CoolPointOut(
        id=cp.id,
        chapter_id=cp.chapter_id,
        point_type=cp.point_type,
        text=cp.text,
        intensity=cp.intensity,
        position=cp.position,
        context=cp.context,
    )
    return ApiResponse(data=out.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 5: DELETE /engagement/cool-points/{id}
# ---------------------------------------------------------------------------

@router.delete("/cool-points/{cool_point_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_cool_point(
    cool_point_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> None:
    """Delete a cool point by id (idempotent)."""
    repo = EngagementRepository(db)
    if not repo.delete_cool_point(cool_point_id):
        raise HTTPException(status_code=404, detail="Cool point not found")


# ---------------------------------------------------------------------------
# Endpoint 6: GET /engagement/{chapter_id}/fulfillment
# ---------------------------------------------------------------------------

@router.get("/{chapter_id}/fulfillment")
def list_fulfillments(
    chapter_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """List narrative fulfillments for a chapter."""
    repo = EngagementRepository(db)
    rows = repo.list_fulfillments(chapter_id)
    fulfillments = [
        FulfillmentOut(
            id=r.id,
            chapter_id=r.chapter_id,
            size=r.size,
            text=r.text,
            position=r.position,
            context=r.context,
        )
        for r in rows
    ]
    payload = FulfillmentList(chapter_id=chapter_id, fulfillments=fulfillments, total=len(fulfillments))
    return ApiResponse(data=payload.model_dump())
