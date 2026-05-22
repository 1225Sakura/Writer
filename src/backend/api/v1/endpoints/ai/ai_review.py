# Auto Novel Writer - AI Review & Extract Endpoints
# POST /review, POST /extract-entities, POST /chapters/{chapter_id}/inspect

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator

from backend.core.services.chapter.chapter_service import ChapterService

from .dependencies import (
    get_ai_service,
    get_chapter_service,
)

router = APIRouter()


# Request/Response models

class ReviewRequest(BaseModel):
    """Request for AI setting review."""
    model_config = {"json_schema_extra": {
        "example": {
            "settings_data": {"characters": [{"name": "主角", "personality": "冷静"}]}
        }
    }}

    settings_data: dict = Field(..., description="设定数据字典")

    @field_validator('settings_data')
    @classmethod
    def validate_settings_data(cls, v: dict) -> dict:
        if not v:
            raise ValueError('settings_data cannot be empty')
        return v


class ReviewResponse(BaseModel):
    """Response for AI review."""
    model_config = {"json_schema_extra": {
        "example": {
            "review_content": "设定审查结果...",
            "raw_response": {}
        }
    }}

    review_content: str = Field(..., description="审查结果文本")
    raw_response: dict = Field(..., description="原始AI响应")


class ExtractEntitiesRequest(BaseModel):
    """Request to extract entities from chat messages."""
    model_config = {"json_schema_extra": {
        "example": {
            "chat_messages": [{"role": "user", "content": "主角叫张三"}]
        }
    }}

    chat_messages: list = Field(..., description="聊天消息列表")

    @field_validator('chat_messages')
    @classmethod
    def validate_chat_messages(cls, v: list) -> list:
        if not v:
            raise ValueError('chat_messages cannot be empty')
        return v


# Endpoints

@router.post(
    "/review",
    summary="AI审查设定",
    description="使用AI审查世界设定的一致性，分析角色、地点、物品、势力、规则之间的逻辑一致性。",
)
async def review_settings(request: ReviewRequest) -> ReviewResponse:
    """Review world settings for consistency using AI.

    Analyzes characters, locations, items, factions, and rules
    for logical consistency and potential issues.
    """
    ai_service = get_ai_service()

    result = await ai_service.review_settings(request.settings_data)
    return ReviewResponse(
        review_content=result["review_content"],
        raw_response=result["raw_response"]
    )


@router.post(
    "/extract-entities",
    summary="从聊天中提取实体",
    description="从聊天消息中提取角色、地点、物品、势力等实体信息。",
)
async def extract_entities(request: ExtractEntitiesRequest) -> dict:
    """Extract entities from chat messages.

    Returns extracted characters, locations, items, factions, etc.
    """
    ai_service = get_ai_service()

    entities = await ai_service.extract_entities(request.chat_messages)
    return {"entities": entities}


@router.post(
    "/chapters/{chapter_id}/inspect",
    summary="AI审查章节",
    description="对指定章节进行AI审查，检查角色一致性、情节逻辑、世界观一致性、伏笔运用等。",
)
async def inspect_chapter(
    chapter_id: int,
    chapter_service: ChapterService = Depends(get_chapter_service),
) -> dict:
    """Run AI inspection on a chapter.

    Checks for consistency, plot holes, character consistency, etc.
    """
    # Get chapter
    chapter = await chapter_service.get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Get latest draft for this chapter
    drafts = await chapter_service.list_draft_versions(chapter_id)
    draft = max(drafts, key=lambda d: d.version_number, default=None) if drafts else None

    if not draft:
        raise HTTPException(status_code=404, detail="No draft found for chapter")

    ai_service = get_ai_service()

    # Build inspection prompt
    inspection_prompt = f"""请审查以下章节内容：

标题：{chapter.title or '无标题'}
大纲摘要：{chapter.summary or '无'}
章节内容：
{draft.content}

请检查以下方面：
1. 角色一致性（性格、行为是否矛盾）
2. 情节逻辑（是否有漏洞）
3. 世界观一致性（设定是否冲突）
4. 伏笔运用（伏笔是否有照应）
5. 建议优化

请以JSON格式返回，包含issues和suggestions字段。"""

    review_result = await ai_service.review_settings({"content": inspection_prompt})

    return {
        "chapter_id": chapter_id,
        "review_content": review_result["review_content"],
        "raw_response": review_result["raw_response"]
    }
