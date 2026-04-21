# Auto Novel Writer - Cache Management Routes
# Admin endpoints for cache warmup, flush, and stats

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from backend.services.cache_service import cache_service
from backend.middleware.auth import require_auth

router = APIRouter(prefix="/cache", tags=["cache"], dependencies=[require_auth])


class CacheStatsResponse(BaseModel):
    size: int
    directory: str


class CacheFlushResponse(BaseModel):
    message: str


class CacheInvalidateResponse(BaseModel):
    tag: str
    deleted_count: int


@router.get("/stats", response_model=CacheStatsResponse)
async def get_cache_stats():
    """Get cache statistics."""
    stats = cache_service.stats()
    return CacheStatsResponse(**stats)


@router.post("/flush", response_model=CacheFlushResponse)
async def flush_cache():
    """Clear all cache entries."""
    cache_service.clear_all()
    return CacheFlushResponse(message="Cache flushed successfully")


@router.post("/invalidate/{tag}", response_model=CacheInvalidateResponse)
async def invalidate_tag(tag: str):
    """Invalidate all cache entries associated with a tag."""
    count = await cache_service.ainvalidate_tag(tag)
    return CacheInvalidateResponse(tag=tag, deleted_count=count)
