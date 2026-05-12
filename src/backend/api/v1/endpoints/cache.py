# Auto Novel Writer - Cache Management Routes
# Admin endpoints for cache warmup, flush, and stats

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field

from backend.infrastructure.cache.cache_service import get_cache_service
from backend.middleware.auth import require_auth

router = APIRouter(prefix="/cache", tags=["cache"], dependencies=[require_auth])


class CacheStatsResponse(BaseModel):
    """Cache statistics response."""
    model_config = {"json_schema_extra": {
        "example": {"size": 42, "directory": "/tmp/writer_cache"}
    }}

    size: int = Field(..., description="Number of cached entries")
    directory: str = Field(..., description="Cache storage directory")


class CacheFlushResponse(BaseModel):
    """Cache flush response."""
    model_config = {"json_schema_extra": {
        "example": {"message": "Cache flushed successfully"}
    }}

    message: str = Field(..., description="Operation result message")


class CacheInvalidateResponse(BaseModel):
    """Cache invalidation response."""
    model_config = {"json_schema_extra": {
        "example": {"tag": "characters", "deleted_count": 5}
    }}

    tag: str = Field(..., description="Invalidated cache tag")
    deleted_count: int = Field(..., description="Number of entries removed")


@router.get(
    "/stats",
    response_model=CacheStatsResponse,
    summary="获取缓存统计",
    description="返回当前缓存条目数量和存储目录信息。",
)
async def get_cache_stats():
    """Get cache statistics."""
    stats = get_cache_service().stats()
    # Compute totals from all memory caches
    total_size = 0
    for cache_stats in stats.get("memory_caches", {}).values():
        total_size += cache_stats.get("size", 0)
    directory = ""
    disk = stats.get("disk_cache")
    if disk:
        total_size += disk.get("size", 0)
        directory = disk.get("directory", "")
    return CacheStatsResponse(size=total_size, directory=directory)


@router.post(
    "/flush",
    response_model=CacheFlushResponse,
    summary="清空所有缓存",
    description="清除所有缓存条目，强制下次请求重新生成数据。",
)
async def flush_cache():
    """Clear all cache entries."""
    get_cache_service().clear_all()
    return CacheFlushResponse(message="Cache flushed successfully")


@router.post(
    "/invalidate/{tag}",
    response_model=CacheInvalidateResponse,
    summary="按标签失效缓存",
    description="使指定标签关联的所有缓存条目失效。常用标签: characters, items, locations, chapters, outlines等。",
)
async def invalidate_tag(tag: str):
    """Invalidate all cache entries associated with a tag."""
    count = await get_cache_service().ainvalidate_tag(tag)
    return CacheInvalidateResponse(tag=tag, deleted_count=count)


class PreloadStatusResponse(BaseModel):
    """Startup preload status response."""
    model_config = {"json_schema_extra": {
        "example": {
            "status": "completed",
            "elapsed_ms": 1250.5,
            "total_items": 150,
            "categories": {"characters": 10, "items": 5, "locations": 3},
            "errors": []
        }
    }}

    status: str = Field(..., description="Preload status: completed, in_progress, failed")
    elapsed_ms: float = Field(..., description="Time elapsed in milliseconds")
    total_items: int = Field(..., description="Total number of preloaded items")
    categories: dict = Field(..., description="Items count by category")
    errors: list = Field(..., description="Any errors during preload")


@router.get(
    "/preload-status",
    response_model=PreloadStatusResponse,
    summary="获取预加载状态",
    description="获取启动时预加载服务的状态和统计信息。",
)
async def get_preload_status():
    """Get startup preload status and statistics."""
    from backend.services.preload_service import preload_service
    summary = preload_service.get_preload_summary()
    return PreloadStatusResponse(**summary)
