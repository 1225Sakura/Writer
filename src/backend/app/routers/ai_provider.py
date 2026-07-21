"""AI provider routes (v0.4 P0-Sec5: full CRUD + activate + dual schema)."""
from fastapi import APIRouter, Depends, HTTPException, status

from app.dependencies import get_ai_provider_service
from app.core.security import decrypt_api_key, verify_api_key
from app.schemas.ai import AIProviderCreate, AIProviderKeyOut, AIProviderOut, AIProviderUpdate
from app.schemas.ai_provider_test import AIProviderTestRequest, AIProviderTestResponse
from app.schemas.response import ApiResponse
from app.services.ai_provider import AIProviderService

router = APIRouter(prefix="/settings/ai-provider", tags=["Settings"], dependencies=[Depends(verify_api_key)])


@router.get("")
def list_ai_providers(
    service: AIProviderService = Depends(get_ai_provider_service),
) -> ApiResponse[list]:
    # v0.4 P0-Sec5 D.2.1: list returns masked_key (NOT full key)
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


@router.put("/{provider_id}")
def update_ai_provider(
    provider_id: int,
    data: AIProviderUpdate,
    service: AIProviderService = Depends(get_ai_provider_service),
) -> ApiResponse[dict]:
    provider = service.update(provider_id, data)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return ApiResponse(
        data=AIProviderOut.model_validate(provider).model_dump(),
        message="AI provider updated",
    )


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_ai_provider(
    provider_id: int,
    service: AIProviderService = Depends(get_ai_provider_service),
) -> None:
    if not service.delete(provider_id):
        raise HTTPException(status_code=404, detail="Provider not found")


@router.post("/{provider_id}/activate")
def activate_ai_provider(
    provider_id: int,
    service: AIProviderService = Depends(get_ai_provider_service),
) -> ApiResponse[dict]:
    # v0.4 P0-Sec5: idempotent + single active constraint (DB partial unique index)
    provider = service.activate(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return ApiResponse(
        data=AIProviderOut.model_validate(provider).model_dump(),
        message=f"Provider {provider_id} activated",
    )


# v0.4 P0-Sec5 D.2.1: separate endpoint for full key retrieval (NEVER in list)
@router.get("/{provider_id}/key")
def get_ai_provider_key(
    provider_id: int,
    service: AIProviderService = Depends(get_ai_provider_service),
) -> ApiResponse[dict]:
    provider = service.get(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    decrypted = decrypt_api_key(provider.api_key_encrypted) if provider.api_key_encrypted else None
    return ApiResponse(
        data=AIProviderKeyOut(api_key=decrypted).model_dump(),
    )


@router.post("/test")
def test_ai_provider(
    data: AIProviderTestRequest,
    service: AIProviderService = Depends(get_ai_provider_service),
) -> ApiResponse[AIProviderTestResponse]:
    return ApiResponse(data=service.test_connection(data))