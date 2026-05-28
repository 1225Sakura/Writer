# Auto Novel Writer - AI Agent Endpoints
# POST /context, POST /extract

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, field_validator
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.core.services.ai.ai_service import ai_service
from backend.agents.context_agent import ContextAgent
from backend.agents.data_agent import DataAgent

from backend.api.v1.dependencies import get_event_bus

from backend.utils.exceptions import AgentError, AIServiceError

from .dependencies import (
    get_ai_provider,
    get_ai_service,
    MAX_CONTENT_LENGTH,
)

router = APIRouter()


# Request/Response models

class ContextRequest(BaseModel):
    """Request for building chapter execution context."""
    model_config = {"json_schema_extra": {"example": {"chapter_id": 1}}}

    chapter_id: int = Field(..., description="Chapter ID", gt=0)


class ExtractRequest(BaseModel):
    """Request for extracting structured entities."""
    model_config = {"json_schema_extra": {
        "example": {"content": "章节正文内容...", "chapter_id": 1}
    }}

    content: str = Field(..., description="Chapter content text", max_length=100000)
    chapter_id: Optional[int] = Field(None, description="Optional chapter ID", gt=0)

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        if len(v) > MAX_CONTENT_LENGTH:
            raise ValueError(f'Content exceeds maximum length of {MAX_CONTENT_LENGTH} characters')
        return v.strip()


class ContextResponse(BaseModel):
    """Response containing chapter execution context."""
    model_config = {"json_schema_extra": {
        "example": {
            "chapter_id": 1,
            "chapter_title": "第一章",
            "core_task": {},
            "承接上文": {},
            "active_characters": [],
            "scene_constraints": {},
            "time_constraints": "",
            "style_guidance": "",
            "continuity": {},
            "engagement_strategy": "",
            "raw_ai_response": None
        }
    }}

    chapter_id: int = Field(..., description="Chapter ID")
    chapter_title: Optional[str] = Field(None, description="Chapter title")
    core_task: dict = Field(..., description="Core writing task")
    承接上文: dict = Field(..., description="Previous chapter hooks")
    active_characters: list = Field(..., description="Active characters with states")
    scene_constraints: dict = Field(..., description="Scene and power constraints")
    time_constraints: str = Field(..., description="Time constraints")
    style_guidance: str = Field(..., description="Style guidance")
    continuity: dict = Field(..., description="Continuity and foreshadowing")
    engagement_strategy: str = Field(..., description="Engagement strategy")
    raw_ai_response: Optional[str] = Field(None, description="Raw AI response")


class ExtractResponse(BaseModel):
    """Response containing extracted structured entities."""
    model_config = {"json_schema_extra": {
        "example": {
            "chapter_id": 1,
            "entities": [],
            "relationships": [],
            "state_changes": [],
            "scenes": [],
            "summary": ""
        }
    }}

    chapter_id: Optional[int] = Field(None, description="Chapter ID")
    entities: list = Field(..., description="Extracted entities")
    relationships: list = Field(..., description="Entity relationships")
    state_changes: list = Field(..., description="State changes")
    scenes: list = Field(..., description="Scene segmentation")
    summary: str = Field(..., description="Content summary")


# Endpoints

@router.post(
    "/context",
    response_model=ContextResponse,
    summary="构建写作执行包",
    description="为指定章节构建完整的写作上下文包，包含核心任务、角色状态、场景约束、风格指导等。",
)
async def build_execution_package(
    request: ContextRequest,
    db: AsyncSession = Depends(get_db)
) -> ContextResponse:
    """Build a writing execution package for a chapter.

    Generates a complete context package containing:
    - Core task (goal/obstacle/cost)
    - Previous chapter hooks
    - Active characters with states
    - Scene and power constraints
    - Time constraints
    - Style guidance
    - Continuity and foreshadowing
    - Engagement strategy
    """
    provider = get_ai_provider()
    event_bus = get_event_bus()
    context_agent = ContextAgent(provider, event_bus, ai_service)

    try:
        context = await context_agent.generate_chapter_context(
            chapter_id=request.chapter_id,
            db=db
        )
        return ContextResponse(**context)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except (AgentError, AIServiceError) as e:
        raise HTTPException(status_code=500, detail=f"Failed to build context: {str(e)}")


@router.post(
    "/extract",
    response_model=ExtractResponse,
    summary="提取结构化实体",
    description="从章节内容中提取角色、地点、物品、关系、状态变化、场景分段和摘要。",
)
async def extract_structured_entities(
    request: ExtractRequest,
    db: AsyncSession = Depends(get_db)
) -> ExtractResponse:
    """Extract structured entities from chapter content.

    Extracts:
    - Characters, locations, items, factions
    - Relationships between entities
    - State changes
    - Scene segmentation
    - Summary
    """
    ai_svc = get_ai_service()
    provider = get_ai_provider()
    event_bus = get_event_bus()
    data_agent = DataAgent(provider, event_bus, ai_svc)

    result = await data_agent.process_chapter(
        chapter_id=request.chapter_id or 0,
        content=request.content,
        db=db
    )

    return ExtractResponse(**result)
