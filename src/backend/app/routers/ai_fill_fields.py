"""AI fill-fields router (US-010).

POST /api/v1/ai/fill-fields
  body:  {entityType, entityId, emptyFields}
  resp:  ApiResponse[dict] -> data == {"filled": {field_name: value, ...}}
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.dependencies import get_field_filler_service
from app.core.security import verify_api_key
from app.schemas.ai_fill_fields import FillFieldsRequest
from app.schemas.base import ApiResponse
from app.services.ai_fill_fields import FieldFillerService


router = APIRouter(prefix="/ai", tags=["AI"], dependencies=[Depends(verify_api_key)])


@router.post("/fill-fields")
def fill_fields(
    body: FillFieldsRequest,
    svc: FieldFillerService = Depends(get_field_filler_service),
) -> ApiResponse[dict]:
    result = svc.fill(body.entity_type, body.entity_id, body.empty_fields)
    return ApiResponse(data=result)
