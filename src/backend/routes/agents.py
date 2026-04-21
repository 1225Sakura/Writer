# Auto Novel Writer - Agent Routes
# Context Agent and Data Agent endpoints

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, field_validator
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.services.ai_service import AIService
from backend.agents.context_agent import ContextAgent
from backend.agents.data_agent import DataAgent
from backend.config import settings

router = APIRouter(prefix="/ai", tags=["ai"])

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
class ContextRequest(BaseModel):
    chapter_id: int

    @field_validator('chapter_id')
    @classmethod
    def validate_chapter_id(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('chapter_id must be a positive integer')
        return v


class ExtractRequest(BaseModel):
    content: str
    chapter_id: Optional[int] = None

    @field_validator('content')
    @classmethod
    def validate_content(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError('Content cannot be empty')
        if len(v) > MAX_CONTENT_LENGTH:
            raise ValueError(f'Content exceeds maximum length of {MAX_CONTENT_LENGTH} characters')
        return v.strip()

    @field_validator('chapter_id')
    @classmethod
    def validate_chapter_id(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v <= 0:
            raise ValueError('chapter_id must be a positive integer')
        return v


class ContextResponse(BaseModel):
    chapter_id: int
    chapter_title: Optional[str] = None
    core_task: dict
    承接上文: dict
    active_characters: list
    scene_constraints: dict
    time_constraints: str
    style_guidance: str
    continuity: dict
    engagement_strategy: str
    raw_ai_response: Optional[str] = None


class ExtractResponse(BaseModel):
    chapter_id: Optional[int] = None
    entities: list
    relationships: list
    state_changes: list
    scenes: list
    summary: str


# Endpoints
@router.post("/context", response_model=ContextResponse)
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
    ai_service = get_ai_service()
    context_agent = ContextAgent(ai_service)

    # Use sync_session for sync SQLAlchemy queries in agents
    sync_db = db.sync_session

    try:
        context = await context_agent.generate_chapter_context(
            chapter_id=request.chapter_id,
            db=sync_db
        )
        return ContextResponse(**context)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to build context: {str(e)}")


@router.post("/extract", response_model=ExtractResponse)
async def extract_entities(
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
    ai_service = get_ai_service()
    data_agent = DataAgent(ai_service)

    # Use sync_session for sync SQLAlchemy queries in agents
    sync_db = db.sync_session

    result = await data_agent.process_chapter(
        chapter_id=request.chapter_id or 0,
        content=request.content,
        db=sync_db
    )

    return ExtractResponse(**result)
