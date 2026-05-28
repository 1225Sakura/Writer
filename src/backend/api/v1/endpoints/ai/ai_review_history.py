# Auto Novel Writer - AI Review History Endpoints
# GET /review-history, POST /review-history, DELETE /review-history/{iteration_id}

from fastapi import APIRouter, HTTPException, Depends, Body, status
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from backend.infrastructure.database import get_db
from backend.core.domain.entities import AIReviewHistory

router = APIRouter()


# Request/Response models

class SeverityCounts(BaseModel):
    """Severity counts for a review iteration."""
    error: int = Field(0, ge=0)
    warning: int = Field(0, ge=0)
    suggestion: int = Field(0, ge=0)


class SuggestionItemData(BaseModel):
    """A single suggestion item (stored as JSON in DB)."""
    id: str
    type: str
    severity: str
    title: str
    description: str
    entityIds: Optional[List[int]] = None
    entityType: Optional[str] = None
    autoFixable: bool = False
    lineReference: Optional[str] = None


class ReviewIterationResponse(BaseModel):
    """A single review history iteration."""
    id: str = Field(..., description="Frontend-generated iteration ID")
    timestamp: str = Field(..., description="ISO timestamp of the review")
    category: str = Field(..., description="Entity category reviewed")
    issue_count: int = Field(..., description="Number of issues found")
    severity_counts: SeverityCounts
    suggestions: List[SuggestionItemData]


class ReviewHistoryResponse(BaseModel):
    """Full review history."""
    iterations: List[ReviewIterationResponse]


class SaveIterationRequest(BaseModel):
    """Request to save a review iteration."""
    id: str = Field(..., description="Frontend-generated iteration ID")
    timestamp: str = Field(..., description="ISO timestamp")
    category: str = Field(..., description="Entity category")
    issue_count: int = Field(0, ge=0)
    severity_counts: SeverityCounts
    suggestions: List[SuggestionItemData]


# Endpoints

@router.get(
    "/review-history",
    response_model=ReviewHistoryResponse,
    summary="获取AI审查历史",
    description="获取所有AI审查历史迭代记录，按时间正序排列。",
)
async def get_review_history(
    db: AsyncSession = Depends(get_db),
) -> ReviewHistoryResponse:
    """Retrieve all review history iterations."""
    result = await db.execute(
        select(AIReviewHistory).order_by(AIReviewHistory.created_at.asc())
    )
    rows = result.scalars().all()

    import json

    iterations = []
    for row in rows:
        severity_counts = json.loads(row.severity_counts_json) if row.severity_counts_json else {}
        suggestions = json.loads(row.suggestions_json) if row.suggestions_json else []
        iterations.append(ReviewIterationResponse(
            id=row.iteration_id,
            timestamp=row.created_at.isoformat() if row.created_at else "",
            category=row.category or "character",
            issue_count=row.issue_count or 0,
            severity_counts=SeverityCounts(
                error=severity_counts.get("error", 0),
                warning=severity_counts.get("warning", 0),
                suggestion=severity_counts.get("suggestion", 0),
            ),
            suggestions=[SuggestionItemData(**s) for s in suggestions],
        ))

    return ReviewHistoryResponse(iterations=iterations)


@router.post(
    "/review-history",
    response_model=ReviewIterationResponse,
    summary="保存AI审查迭代",
    description="保存一条AI审查历史迭代记录。如果iteration_id已存在则跳过。",
    status_code=status.HTTP_201_CREATED,
)
async def save_review_iteration(
    request: SaveIterationRequest = Body(...),
    db: AsyncSession = Depends(get_db),
) -> ReviewIterationResponse:
    """Save a single review iteration to history."""
    import json

    # Check for duplicate
    existing = await db.execute(
        select(AIReviewHistory).where(AIReviewHistory.iteration_id == request.id)
    )
    if existing.scalar_one_or_none():
        # Already saved — return existing
        return ReviewIterationResponse(
            id=request.id,
            timestamp=request.timestamp,
            category=request.category,
            issue_count=request.issue_count,
            severity_counts=request.severity_counts,
            suggestions=request.suggestions,
        )

    # Parse timestamp
    try:
        ts = datetime.fromisoformat(request.timestamp.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        ts = datetime.utcnow()

    row = AIReviewHistory(
        iteration_id=request.id,
        category=request.category,
        issue_count=request.issue_count,
        severity_counts_json=json.dumps({
            "error": request.severity_counts.error,
            "warning": request.severity_counts.warning,
            "suggestion": request.severity_counts.suggestion,
        }),
        suggestions_json=json.dumps([s.model_dump() for s in request.suggestions]),
        created_at=ts,
    )
    db.add(row)
    await db.flush()

    return ReviewIterationResponse(
        id=request.id,
        timestamp=request.timestamp,
        category=request.category,
        issue_count=request.issue_count,
        severity_counts=request.severity_counts,
        suggestions=request.suggestions,
    )


@router.delete(
    "/review-history",
    summary="清空AI审查历史",
    description="删除所有AI审查历史记录。",
)
async def clear_review_history(
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Clear all review history."""
    await db.execute(delete(AIReviewHistory))
    return {"success": True, "message": "Review history cleared"}
