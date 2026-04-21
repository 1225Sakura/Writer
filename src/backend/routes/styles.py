# Auto Novel Writer - Styles Routes
# Writing style management

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List

from backend.services.cache_service import cached, cache_service
from backend.config import settings
from backend.middleware.auth import require_auth

router = APIRouter(prefix="/styles", tags=["styles"], dependencies=[require_auth])


class WritingStyle(BaseModel):
    """Available writing style definition."""
    model_config = {"json_schema_extra": {
        "example": {"id": "江南", "name": "江南风格", "description": "东方玄幻风格，文笔细腻柔美"}
    }}

    id: str = Field(..., description="风格唯一标识符")
    name: str = Field(..., description="风格显示名称")
    description: str = Field(..., description="风格详细描述")


# Available writing styles
WRITING_STYLES = [
    WritingStyle(
        id="江南",
        name="江南风格",
        description="东方玄幻风格，文笔细腻柔美，擅长情感描写和意境营造"
    ),
    WritingStyle(
        id="卡夫卡",
        name="卡夫卡风格",
        description="表现主义风格，文风荒诞抽象，善于揭示人性的异化和社会的荒谬"
    ),
    WritingStyle(
        id="加缪",
        name="加缪风格",
        description="存在主义风格，文风冷峻深刻，擅长哲学思辨和对生命意义的探索"
    ),
    WritingStyle(
        id="default",
        name="默认风格",
        description="专业中文网络小说风格，文笔流畅，情节紧凑，可读性强"
    ),
]


@router.get("/", response_model=List[WritingStyle])
@cached(ttl=settings.cache_styles_ttl, key_prefix="styles:list")
async def list_styles():
    """List all available writing styles."""
    return WRITING_STYLES


@router.get("/{style_id}", response_model=WritingStyle)
@cached(ttl=settings.cache_styles_ttl, key_prefix="styles:detail")
async def get_style(style_id: str):
    """Get a specific writing style by ID."""
    for style in WRITING_STYLES:
        if style.id == style_id:
            return style
    raise HTTPException(status_code=404, detail="Style not found")
