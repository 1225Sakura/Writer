"""AI generate-entity router (US-008).

POST /api/v1/ai/generate-entity
  body: {type, hint, projectId}
  resp: ApiResponse[dict] -> data == {"entity": {...}}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_entity_generator_service
from app.schemas.ai_generate_entity import GenerateEntityRequest
from app.schemas.base import ApiResponse
from app.services.ai_generate_entity import EntityGeneratorService


router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/generate-entity")
def generate_entity(
    body: GenerateEntityRequest,
    svc: EntityGeneratorService = Depends(get_entity_generator_service),
) -> ApiResponse[dict]:
    result = svc.generate(body.type, body.hint, body.project_id)
    return ApiResponse(data=result)