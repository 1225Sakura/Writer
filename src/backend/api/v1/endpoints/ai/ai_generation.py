# Auto Novel Writer - AI Generation Endpoint
# POST /generate

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, field_validator
from typing import Optional, AsyncIterator

from backend.core.services.writing_settings.writing_settings_service import WritingSettingsService
from backend.core.services.ai.ai_service import AIService

from backend.utils.exceptions import AIServiceError

from .dependencies import (
    get_ai_service,
    get_writing_settings_service,
    VALID_OPERATIONS,
    MAX_PROMPT_LENGTH,
)

router = APIRouter()


class GenerateRequest(BaseModel):
    """Request for AI content generation."""
    model_config = {"json_schema_extra": {
        "example": {
            "prompt": "主角在山洞中发现了上古秘籍",
            "operation": "continue",
            "chapter_id": 1,
            "human_ai_ratio": 70,
            "style": "default"
        }
    }}

    prompt: str = Field(..., description="写作提示/上下文内容", max_length=10000)
    operation: str = Field(..., description="操作类型: continue/expand/condense/rewrite/polish/optimize")
    chapter_id: Optional[int] = Field(None, description="关联章节ID")
    human_ai_ratio: Optional[int] = Field(None, description="人机比例 0-100", ge=0, le=100)
    style: Optional[str] = Field(None, description="文笔风格")

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


@router.post(
    "/generate",
    summary="AI内容生成",
    description="""
    使用AI生成内容，支持流式响应。

    操作类型:
    - **continue**: 续写后续内容
    - **expand**: 扩写当前内容
    - **condense**: 缩写当前内容
    - **rewrite**: 改写当前内容
    - **polish**: 润色当前内容
    - **optimize**: 优化当前内容
    """,
)
async def generate_content(
    request: GenerateRequest,
    writing_settings_service: WritingSettingsService = Depends(get_writing_settings_service),
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
    settings_list = await writing_settings_service.list_writing_settings()
    writing_settings = settings_list[0] if settings_list else None

    human_ai_ratio = request.human_ai_ratio
    style = request.style

    if human_ai_ratio is None and writing_settings:
        human_ai_ratio = int(writing_settings.human_ai_ratio * 100)
    if style is None and writing_settings:
        style = writing_settings.writing_style

    human_ai_ratio = human_ai_ratio if human_ai_ratio is not None else 70
    style = style if style is not None else "default"

    async def stream_response() -> AsyncIterator[str]:
        """Stream AI response in SSE format with progress tracking.

        Yields SSE-formatted events:
        - event: progress\ndata: {"percent": N}\n\n
        - event: chunk\ndata: <text>\n\n
        - event: done\ndata: {"total_chars": N}\n\n
        """
        accumulated = ""
        chunk_count = 0
        # Estimate total chunks for progress (rough heuristic: ~50 chars per chunk)
        estimated_total_chunks = max(1, len(request.prompt) // 50)

        yield f"event: progress\ndata: {{\"percent\": 5}}\n\n"

        try:
            async for chunk in ai_service.generate(
                prompt=request.prompt,
                operation=request.operation,
                human_ai_ratio=human_ai_ratio,
                style=style
            ):
                if not chunk:
                    continue
                accumulated += chunk
                chunk_count += 1
                # Calculate progress (cap at 95% until done)
                progress = min(95, int((chunk_count / estimated_total_chunks) * 100))
                yield f"event: progress\ndata: {{\"percent\": {progress}}}\n\n"
                yield f"event: chunk\ndata: {chunk}\n\n"

            yield f"event: done\ndata: {{\"total_chars\": {len(accumulated)}}}\n\n"
        except AIServiceError as exc:
            yield f"event: error\ndata: {{\"message\": \"{str(exc).replace(chr(34), chr(92)+chr(34))}\"}}\n\n"

    return StreamingResponse(
        stream_response(),
        media_type="text/event-stream",
        headers={
            "X-Operation": request.operation,
            "X-Human-AI-Ratio": str(human_ai_ratio),
            "X-Style": style,
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
