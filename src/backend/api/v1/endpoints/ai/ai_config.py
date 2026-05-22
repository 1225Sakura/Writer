# Auto Novel Writer - AI Provider Health & Failover Endpoints
# GET /health, GET /provider-health, POST /failover

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional

from backend.core.services.ai.ai_service import ai_service

router = APIRouter()


# Request/Response models

class FailoverRequest(BaseModel):
    """Request for manual provider failover."""
    model_config = {"json_schema_extra": {"example": {"target_provider": None}}}

    target_provider: Optional[str] = Field(
        None,
        description="Specific provider name to promote to primary. If omitted, cycles to next healthy provider."
    )


class FailoverResponse(BaseModel):
    """Response for provider failover."""
    model_config = {"json_schema_extra": {
        "example": {"success": True, "new_primary": "minimax", "message": "Failover complete"}
    }}

    success: bool = Field(..., description="Whether failover succeeded")
    new_primary: str = Field(..., description="New primary provider name")
    message: str = Field(..., description="Status message")


# Endpoints

@router.get(
    "/health",
    summary="AI提供商健康状态",
    description="返回各AI提供商的健康状态、降级状态、错误率、调用次数、成功率和平均延迟。",
)
async def get_ai_provider_health() -> dict:
    """Return AI provider health status and metrics.

    Shows each provider's degradation status, error rate, call counts,
    success rate, and average latency. Also indicates the currently
    recommended (best) provider.
    """
    health = ai_service.get_provider_health()
    return health


@router.get(
    "/provider-health",
    summary="AI提供商健康状态（别名）",
    description="/health 的别名端点，返回各AI提供商的健康状态、降级状态、错误率、调用次数、成功率和平均延迟。",
)
async def get_ai_provider_health_alias() -> dict:
    """Alias for /ai/health - return AI provider health status and metrics."""
    health = ai_service.get_provider_health()
    return health


@router.post(
    "/failover",
    response_model=FailoverResponse,
    summary="手动触发提供商故障转移",
    description="手动切换到下一个健康的AI提供商，或提升指定的提供商为主提供商。",
)
async def trigger_failover(request: FailoverRequest) -> FailoverResponse:
    """Manually trigger a provider failover (admin use).

    Cycles to the next healthy provider, or promotes a specific
    provider if target_provider is given.
    """
    svc_router = ai_service.router
    if svc_router is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Provider router not initialized"
        )

    try:
        new_primary = svc_router.force_failover(target_name=request.target_provider)
        return FailoverResponse(
            success=True,
            new_primary=new_primary,
            message=f"Failover complete. New primary provider: {new_primary}"
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failover failed: {str(e)}"
        )
