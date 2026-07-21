"""AI rewrite-description router (US-011).

POST /api/v1/ai/rewrite-description
  body:  {entityType, entityId, style}
  resp:  ApiResponse[dict] -> data == {"description": "...", "style", "entityType", "entityId"}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_description_rewriter_service
from app.core.security import verify_api_key
from app.schemas.ai_rewrite_description import RewriteDescriptionRequest
from app.schemas.base import ApiResponse
from app.services.ai_rewrite_description import DescriptionRewriterService


router = APIRouter(prefix="/ai", tags=["AI"], dependencies=[Depends(verify_api_key)])


@router.post("/rewrite-description")
def rewrite_description(
    body: RewriteDescriptionRequest,
    svc: DescriptionRewriterService = Depends(get_description_rewriter_service),
) -> ApiResponse[dict]:
    result = svc.rewrite(body.entity_type, body.entity_id, body.style)
    return ApiResponse(data=result)
