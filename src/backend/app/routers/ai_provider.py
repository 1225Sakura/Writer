"""AI provider routes."""
from fastapi import APIRouter, Depends

from app.dependencies import get_ai_provider_service
from app.core.security import verify_api_key
from app.schemas.ai import AIProviderCreate, AIProviderOut
from app.schemas.ai_provider_test import AIProviderTestRequest, AIProviderTestResponse
from app.schemas.response import ApiResponse
from app.services.ai_provider import AIProviderService

router = APIRouter(prefix="/settings/ai-provider", tags=["Settings"], dependencies=[Depends(verify_api_key)])


@router.get("")
def list_ai_providers(
    service: AIProviderService = Depends(get_ai_provider_service),
) -> ApiResponse[list]:
    providers = service.list()
    return ApiResponse(
        data=[AIProviderOut.model_validate(provider).model_dump() for provider in providers]
    )


@router.post("")
def create_ai_provider(
    data: AIProviderCreate,
    service: AIProviderService = Depends(get_ai_provider_service),
) -> ApiResponse[dict]:
    provider = service.create(data)
    return ApiResponse(
        data=AIProviderOut.model_validate(provider).model_dump(),
        message="AI provider created",
    )


@router.post("/test")
def test_ai_provider(
    data: AIProviderTestRequest,
    service: AIProviderService = Depends(get_ai_provider_service),
) -> ApiResponse[AIProviderTestResponse]:
    return ApiResponse(data=service.test_connection(data))
