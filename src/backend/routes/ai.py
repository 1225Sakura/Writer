# Auto Novel Writer - AI Routes
# AI generation and review endpoints

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator
from typing import Optional, AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import get_db
from backend.models.entities import WritingSettings, Chapter
from backend.services.ai_service import AIService
from backend.config import settings

router = APIRouter(prefix="/ai", tags=["ai"])

VALID_OPERATIONS = {"continue", "expand", "condense", "rewrite", "polish", "optimize"}
MAX_PROMPT_LENGTH = 10000
MAX_CONTENT_LENGTH = 100000


def get_ai_service() -> AIService:
    """Get AI service instance."""
    if not settings.minimax_api_key:
        raise HTTPException(
            status_code=500,
            detail="MiniMax API key not configured. Set MINIMAX_API_KEY in environment."
        )
    return AIService(
        api_key=settings.minimax_api_key,
        base_url=settings.minimax_api_url
    )


# Request/Response models
class GenerateRequest(BaseModel):
    prompt: str
    operation: str
    chapter_id: Optional[int] = None
    human_ai_ratio: Optional[int] = None
    style: Optional[str] = None

    @field_validator('prompt')
    @classmethod
    def validate_prompt(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Prompt cannot be empty')
        if len(v) > MAX_PROMPT_LENGTH:
            raise ValueError(f'Prompt exceeds maximum length of {MAX_PROMPT_LENGTH} characters')
        return v.strip()

    @field_validator('operation')
    @classmethod
    def validate_operation(cls, v: str) -> str:
        if v not in VALID_OPERATIONS:
            raise ValueError(f'Operation must be one of: {", ".join(sorted(VALID_OPERATIONS))}')
        return v

    @field_validator('human_ai_ratio')
    @classmethod
    def validate_human_ai_ratio(cls, v: Optional[int]) -> Optional[int]:
        if v is not None:
            if v < 0 or v > 100:
                raise ValueError('human_ai_ratio must be between 0 and 100')
        return v

    @field_validator('chapter_id')
    @classmethod
    def validate_chapter_id(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError('chapter_id must be a positive integer')
        return v


class ReviewRequest(BaseModel):
    settings_data: dict

    @field_validator('settings_data')
    @classmethod
    def validate_settings_data(cls, v: dict) -> dict:
        if not v:
            raise ValueError('settings_data cannot be empty')
        return v


class ReviewResponse(BaseModel):
    review_content: str
    raw_response: dict


class ExtractEntitiesRequest(BaseModel):
    chat_messages: list

    @field_validator('chat_messages')
    @classmethod
    def validate_chat_messages(cls, v: list) -> list:
        if not v:
            raise ValueError('chat_messages cannot be empty')
        return v


# Endpoints
@router.post("/generate")
async def generate_content(
    request: GenerateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Generate AI content with streaming response.

    Operation types:
    - continue: 续写后续内容
    - expand: 扩写当前内容
    - condense: 缩写当前内容
    - rewrite: 改写当前内容
    - polish: 润色当前内容
    - optimize: 优化当前内容
    """
    ai_service = get_ai_service()

    # Get writing settings for defaults
    result = await db.execute(select(WritingSettings))
    writing_settings = result.scalar_one_or_none()

    human_ai_ratio = request.human_ai_ratio
    style = request.style

    if human_ai_ratio is None and writing_settings:
        human_ai_ratio = int(writing_settings.human_ai_ratio * 100)
    if style is None and writing_settings:
        style = writing_settings.writing_style

    human_ai_ratio = human_ai_ratio if human_ai_ratio is not None else 70
    style = style if style is not None else "default"

    async def stream_response() -> AsyncIterator[str]:
        async for chunk in ai_service.generate(
            prompt=request.prompt,
            operation=request.operation,
            human_ai_ratio=human_ai_ratio,
            style=style
        ):
            yield chunk

    return StreamingResponse(
        stream_response(),
        media_type="text/plain",
        headers={
            "X-Operation": request.operation,
            "X-Human-AI-Ratio": str(human_ai_ratio),
            "X-Style": style
        }
    )


@router.post("/review")
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


@router.post("/extract-entities")
async def extract_entities(request: ExtractEntitiesRequest) -> dict:
    """Extract entities from chat messages.

    Returns extracted characters, locations, items, factions, etc.
    """
    ai_service = get_ai_service()

    entities = await ai_service.extract_entities(request.chat_messages)
    return {"entities": entities}


@router.post("/chapters/{chapter_id}/inspect")
async def inspect_chapter(chapter_id: int, db: AsyncSession = Depends(get_db)) -> dict:
    """Run AI inspection on a chapter.

    Checks for consistency, plot holes, character consistency, etc.
    """
    # Get chapter
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    # Get all drafts for this chapter
    from backend.models.entities import DraftVersion
    result = await db.execute(
        select(DraftVersion)
        .where(DraftVersion.chapter_id == chapter_id)
        .order_by(DraftVersion.version_number.desc())
        .limit(1)
    )
    draft = result.scalar_one_or_none()

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
