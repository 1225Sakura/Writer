# Auto Novel Writer - Writing Settings Routes

from fastapi import APIRouter, Depends

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.api.v1.dependencies import get_event_bus
from backend.core.domain.schemas.request_schemas import WritingSettingsUpdateRequest
from backend.core.domain.schemas.response_schemas import WritingSettingsResponse
from backend.core.services.writing_settings.writing_settings_service import WritingSettingsService

router = APIRouter()


def get_writing_settings_service(db: AsyncSession = Depends(get_db)) -> WritingSettingsService:
    """Dependency to inject WritingSettingsService."""
    return WritingSettingsService(db, get_event_bus(), get_cache_service())


@router.get(
    "/writing",
    response_model=WritingSettingsResponse,
    summary="获取写作设定",
    description="获取当前的写作设定配置。如不存在则创建默认值。",
)
async def get_writing_settings(
    service: WritingSettingsService = Depends(get_writing_settings_service)
):
    """Get current writing settings."""
    result = await service.get_writing_settings()
    if result is None:
        # Create default writing settings if none exist
        defaults = {
            "human_ai_ratio": 0.5,
            "writing_style": "default",
            "target_word_count": 3000,
        }
        result = await service.create(defaults)
    return result


@router.patch(
    "/writing",
    response_model=WritingSettingsResponse,
    summary="更新写作设定",
    description="更新写作设定配置。",
)
async def update_writing_settings(
    updates: WritingSettingsUpdateRequest,
    service: WritingSettingsService = Depends(get_writing_settings_service)
):
    """Update writing settings."""
    settings = await service.get_writing_settings()
    db_settings = await service.update_writing_settings(settings.id, updates.model_dump(exclude_unset=True))
    if db_settings:
        get_cache_service().clear_entity_cache("writing_settings")
    return db_settings or settings
