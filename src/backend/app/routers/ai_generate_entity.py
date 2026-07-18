"""AI entity generation router (US-008).

POST /api/v1/ai/generate-entity
  body: {type, hint, projectId}
  resp: ApiResponse[dict] -> data == {"entity": {...}}

POST /api/v1/ai-tools/generate-entity
  body: {entity_type, context}
  resp: ApiResponse[dict] -> data == {"entity": {...}}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_entity_generator_service
from app.schemas.ai_generate_entity import (
    GenerateEntityRequest,
    GenerateEntityToolRequest,
)
from app.schemas.base import ApiResponse
from app.services.ai_generate_entity import EntityGeneratorService


router = APIRouter(prefix="/ai", tags=["AI"])
tools_router = APIRouter(prefix="/ai-tools", tags=["AI"])


@router.post("/generate-entity")
def generate_entity(
    body: GenerateEntityRequest,
    svc: EntityGeneratorService = Depends(get_entity_generator_service),
) -> ApiResponse[dict]:
    result = svc.generate(body.type, body.hint, body.project_id)
    return ApiResponse(data=result)


@tools_router.post("/generate-entity")
def generate_entity_tool(
    body: GenerateEntityToolRequest,
    svc: EntityGeneratorService = Depends(get_entity_generator_service),
) -> ApiResponse[dict]:
    entity_type = "world_setting" if body.entity_type == "world" else body.entity_type
    result = svc.generate(entity_type, body.context, project_id=0)
    return ApiResponse(data=result)