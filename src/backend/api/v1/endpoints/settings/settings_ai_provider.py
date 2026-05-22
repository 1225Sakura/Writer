# Auto Novel Writer - AI Provider Config Routes

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.api.v1.dependencies import get_event_bus
from backend.core.domain.schemas.request_schemas import (
    AIProviderConfigCreateRequest,
    AIProviderConfigUpdateRequest,
    AIProviderConfigTestRequest,
)
from backend.core.domain.schemas.response_schemas import (
    AIProviderConfigResponse,
    ConnectionTestResponse,
)
from backend.services.ai_provider_config_service import AIProviderConfigService
from backend.core.services.ai.ai_service import ai_service

router = APIRouter()


def get_ai_provider_config_service(db: AsyncSession = Depends(get_db)) -> AIProviderConfigService:
    return AIProviderConfigService(db, get_event_bus(), get_cache_service())


@router.get("/ai-provider", response_model=List[AIProviderConfigResponse])
async def list_ai_providers(
    project_id: Optional[int] = None,
    service: AIProviderConfigService = Depends(get_ai_provider_config_service),
):
    """List all AI provider configurations."""
    return await service.list_configs(project_id)


@router.post("/ai-provider", response_model=AIProviderConfigResponse, status_code=201)
async def create_ai_provider(
    data: AIProviderConfigCreateRequest,
    service: AIProviderConfigService = Depends(get_ai_provider_config_service),
):
    """Create a new AI provider configuration."""
    return await service.create_config(data)


@router.get("/ai-provider/{config_id}", response_model=AIProviderConfigResponse)
async def get_ai_provider(
    config_id: int,
    service: AIProviderConfigService = Depends(get_ai_provider_config_service),
):
    """Get a specific AI provider configuration."""
    try:
        return await service.get_config(config_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="AI provider config not found")


@router.patch("/ai-provider/{config_id}", response_model=AIProviderConfigResponse)
async def update_ai_provider(
    config_id: int,
    data: AIProviderConfigUpdateRequest,
    service: AIProviderConfigService = Depends(get_ai_provider_config_service),
):
    """Update an AI provider configuration."""
    try:
        return await service.update_config(config_id, data)
    except ValueError:
        raise HTTPException(status_code=404, detail="AI provider config not found")


@router.delete("/ai-provider/{config_id}", status_code=204)
async def delete_ai_provider(
    config_id: int,
    service: AIProviderConfigService = Depends(get_ai_provider_config_service),
):
    """Delete an AI provider configuration."""
    try:
        await service.delete_config(config_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="AI provider config not found")


@router.post("/ai-provider/{config_id}/activate", response_model=AIProviderConfigResponse)
async def activate_ai_provider(
    config_id: int,
    service: AIProviderConfigService = Depends(get_ai_provider_config_service),
):
    """Activate an AI provider and trigger hot reload."""
    try:
        config = await service.activate_config(config_id)
        await ai_service.reload_from_config(config)
        return config
    except ValueError:
        raise HTTPException(status_code=404, detail="AI provider config not found")


@router.post("/ai-provider/{config_id}/test", response_model=ConnectionTestResponse)
async def test_ai_provider(
    config_id: int,
    service: AIProviderConfigService = Depends(get_ai_provider_config_service),
):
    """Test connection for a saved AI provider configuration."""
    try:
        result = await service.test_connection(config_id)
        return ConnectionTestResponse(
            success=result.success,
            latency_ms=result.latency_ms,
            message=result.message,
            error_detail=result.error_detail,
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="AI provider config not found")


@router.post("/ai-provider/test", response_model=ConnectionTestResponse)
async def test_ai_provider_params(
    params: AIProviderConfigTestRequest,
    service: AIProviderConfigService = Depends(get_ai_provider_config_service),
):
    """Test connection with unsaved AI provider parameters."""
    result = await service.test_connection_with_params(params)
    return ConnectionTestResponse(
        success=result.success,
        latency_ms=result.latency_ms,
        message=result.message,
        error_detail=result.error_detail,
    )
