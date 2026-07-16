"""AI review-consistency router (US-009).

POST /api/v1/ai/review-consistency
  body:  {projectId, targetTypes? (list[entity_type])}
  resp:  ApiResponse[dict] -> data == {"issues": [...], "suggestions": [...]}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_consistency_review_service
from app.schemas.ai_review import ReviewConsistencyRequest
from app.schemas.base import ApiResponse
from app.services.ai_review_consistency import ConsistencyReviewService


router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/review-consistency")
def review_consistency(
    body: ReviewConsistencyRequest,
    svc: ConsistencyReviewService = Depends(get_consistency_review_service),
) -> ApiResponse[dict]:
    result = svc.review(body.project_id, body.target_types)
    return ApiResponse(data=result)
