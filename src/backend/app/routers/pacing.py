"""Pacing routes (v0.5 Phase 1 Track B.3).

4 endpoints (all X-API-Key + verify_api_key):
1. GET    /api/v1/pacing/{chapter_id}/curve                  — return latest pacing curve
2. POST   /api/v1/pacing/{chapter_id}/analyze                — heuristic analyze + persist curve
3. GET    /api/v1/pacing/{chapter_id}/recommendations        — list pacing recommendations
4. POST   /api/v1/pacing/recommendations/{id}/apply          — mark recommendation as applied

Analysis algorithm (heuristic, deterministic): split chapter content into N
buckets, compute per-bucket word-density as intensity proxy, derive avg + variance.
Real AI pacing analysis belongs to Phase 2+ (would use the active provider).
"""
from __future__ import annotations

import hashlib
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Path, status
from sqlalchemy.orm import Session

from app.core.security import verify_api_key
from app.database import get_db
from app.models import Chapter
from app.repositories.pacing import PacingRepository
from app.schemas.pacing import (
    AnalysisResult,
    AnalyzeRequest,
    ApplyResult,
    CurveBucket,
    PacingCurveOut,
    RecommendationList,
    RecommendationOut,
)
from app.schemas.response import ApiResponse

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/pacing",
    tags=["Pacing"],
    dependencies=[Depends(verify_api_key)],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _analyze_chapter(
    content: str, num_buckets: int = 10
) -> tuple[list[dict], float, float]:
    """Compute pacing curve from chapter content.

    Returns (curve_data, avg_intensity, variance).
    - Splits content into N roughly equal-length buckets.
    - Per-bucket intensity = word_count / max_word_count (normalized 0-1).
    - Empty content → flat 0.5 curve.
    """
    if not content or not content.strip():
        curve_data = [
            {"position": i, "intensity": 0.5, "label": "empty"}
            for i in range(num_buckets)
        ]
        return curve_data, 0.5, 0.0

    text = content.strip()
    bucket_size = max(1, len(text) // num_buckets)
    buckets = []
    word_counts = []
    for i in range(num_buckets):
        start = i * bucket_size
        end = (i + 1) * bucket_size if i < num_buckets - 1 else len(text)
        segment = text[start:end]
        word_count = len(segment.split())
        word_counts.append(word_count)
        buckets.append({"position": i, "intensity": 0.0, "label": "low"})  # fill later

    max_wc = max(word_counts) or 1
    for i, wc in enumerate(word_counts):
        buckets[i]["intensity"] = round(wc / max_wc, 3)
        buckets[i]["label"] = (
            "high" if buckets[i]["intensity"] > 0.7
            else "low" if buckets[i]["intensity"] < 0.3
            else "medium"
        )

    avg = sum(word_counts) / len(word_counts)
    avg_intensity = round(avg / max_wc, 3)
    variance = round(
        sum((wc - avg) ** 2 for wc in word_counts) / len(word_counts), 4
    )
    return buckets, avg_intensity, variance


# ---------------------------------------------------------------------------
# Endpoint 1: GET /pacing/{chapter_id}/curve
# ---------------------------------------------------------------------------

@router.get("/{chapter_id}/curve")
def get_curve(
    chapter_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Return latest pacing curve for a chapter; auto-init if missing."""
    repo = PacingRepository(db)
    curve = repo.get_curve(chapter_id)
    if curve is None:
        # Auto-init from chapter content if available
        chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
        content = chapter.content if chapter else ""
        curve_data, avg_int, var = _analyze_chapter(content or "")
        curve = repo.upsert_curve(chapter_id, curve_data, avg_int, var)

    curve_out = [
        CurveBucket(
            position=b["position"],
            intensity=b["intensity"],
            label=b.get("label", ""),
        )
        for b in curve.curve_data
    ]
    payload = PacingCurveOut(
        chapter_id=chapter_id,
        curve=curve_out,
        avg_intensity=curve.avg_intensity,
        variance=curve.variance,
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 2: POST /pacing/{chapter_id}/analyze
# ---------------------------------------------------------------------------

@router.post("/{chapter_id}/analyze")
def analyze(
    chapter_id: int = Path(..., ge=1),
    body: Optional[AnalyzeRequest] = None,
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Trigger pacing analyze; persist curve + auto-generate recommendations."""
    repo = PacingRepository(db)
    chapter = db.query(Chapter).filter(Chapter.id == chapter_id).first()
    content = chapter.content if chapter else ""
    num_buckets = body.num_buckets if body else 10

    curve_data, avg_int, var = _analyze_chapter(content or "", num_buckets)
    curve = repo.upsert_curve(chapter_id, curve_data, avg_int, var)

    # Auto-generate recommendations based on heuristic
    if var > 0.3:
        # High variance → recommend smoothing
        repo.create_recommendation(
            chapter_id=chapter_id,
            title="平滑节奏波动",
            description=f"本章节奏波动较大 (variance={var:.2f})，建议在过渡段增加铺垫降低波动。",
            category="rhythm",
            priority=3,
        )
    if avg_int < 0.3:
        repo.create_recommendation(
            chapter_id=chapter_id,
            title="增强张力",
            description=f"本章平均强度偏低 (avg={avg_int:.2f})，建议加入冲突或悬念提升张力。",
            category="tension",
            priority=2,
        )

    payload = AnalysisResult(
        chapter_id=chapter_id,
        analyzed_at=curve.updated_at.isoformat() if hasattr(curve.updated_at, "isoformat") else str(curve.updated_at),
        num_buckets=num_buckets,
        avg_intensity=avg_int,
        variance=var,
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 3: GET /pacing/{chapter_id}/recommendations
# ---------------------------------------------------------------------------

@router.get("/{chapter_id}/recommendations")
def list_recommendations(
    chapter_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """List pacing recommendations for a chapter."""
    repo = PacingRepository(db)
    rows = repo.list_recommendations(chapter_id)
    recs = [
        RecommendationOut(
            id=r.id,
            chapter_id=r.chapter_id,
            title=r.title,
            description=r.description,
            category=r.category,
            priority=r.priority,
            applied=r.applied,
        )
        for r in rows
    ]
    payload = RecommendationList(
        chapter_id=chapter_id, recommendations=recs, total=len(recs)
    )
    return ApiResponse(data=payload.model_dump())


# ---------------------------------------------------------------------------
# Endpoint 4: POST /pacing/recommendations/{id}/apply
# ---------------------------------------------------------------------------

@router.post("/recommendations/{rec_id}/apply")
def apply_recommendation(
    rec_id: int = Path(..., ge=1),
    db: Session = Depends(get_db),
) -> ApiResponse[dict]:
    """Mark a recommendation as applied."""
    repo = PacingRepository(db)
    rec = repo.apply_recommendation(rec_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
    payload = ApplyResult(
        id=rec.id,
        applied=rec.applied,
        applied_at=rec.updated_at.isoformat() if hasattr(rec.updated_at, "isoformat") else str(rec.updated_at),
    )
    return ApiResponse(data=payload.model_dump())
