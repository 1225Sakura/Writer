# Auto Novel Writer - Genre Routes
# Genre template and profile management API

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field, ConfigDict

from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.services.genre_service import GenreService
from backend.services.guidance_builder import GuidanceBuilder
from backend.middleware.auth import require_auth

router = APIRouter(prefix="/genres", tags=["genres"], dependencies=[require_auth])


# ============================================
# Request Schemas
# ============================================

class GenreApplyRequest(BaseModel):
    """Request to apply a genre to a project."""
    model_config = ConfigDict(str_strip_whitespace=True)

    project_id: int = Field(..., gt=0, description="目标项目ID")
    genre: str = Field(..., min_length=1, max_length=100, description="题材名称")


class BuildProfileRequest(BaseModel):
    """Request to build a genre profile from chapter contents."""
    model_config = ConfigDict(str_strip_whitespace=True)

    project_id: int = Field(..., gt=0, description="目标项目ID")
    chapter_contents: List[str] = Field(default_factory=list, description="章节内容列表")


class GuidanceRequest(BaseModel):
    """Request to build writing guidance."""
    model_config = ConfigDict(str_strip_whitespace=True)

    chapter: int = Field(..., gt=0, description="章节号")
    reader_signal: Dict[str, Any] = Field(default_factory=dict, description="读者信号数据")
    low_score_threshold: float = Field(default=75.0, ge=0.0, le=100.0)
    hook_diversify_enabled: bool = Field(default=True)


# ============================================
# Response Schemas
# ============================================

class GenrePresetResponse(BaseModel):
    """Genre preset summary response."""
    model_config = ConfigDict(populate_by_name=True)

    name: str
    profile_key: str
    description: str
    core_tropes: List[str]


class GenreProfileResponse(BaseModel):
    """Complete genre profile response."""
    model_config = ConfigDict(populate_by_name=True)

    genre: str
    profile_key: str
    description: str
    core_tropes: List[str]
    narrative_rhythm: Dict[str, Any]
    terminology_hints: Dict[str, Any]
    character_archetypes: List[str]
    world_building_focus: List[str]
    pressure_source: str
    release_target: str
    guidance_text: str
    reference_hints: List[str]
    composite_hints: Optional[List[str]] = None
    secondary_genres: Optional[List[str]] = None


class GenreApplyResponse(BaseModel):
    """Genre application result response."""
    model_config = ConfigDict(populate_by_name=True)

    project_id: int
    genre: str
    profile: Dict[str, Any]
    applied_at: Optional[str] = None


class AliasesResponse(BaseModel):
    """Genre aliases response."""
    model_config = ConfigDict(populate_by_name=True)

    input_aliases: Dict[str, List[str]]
    profile_key_aliases: Dict[str, List[str]]
    all_mappings: Dict[str, Dict[str, str]]


class BuiltProfileResponse(BaseModel):
    """Built profile from chapters response."""
    model_config = ConfigDict(populate_by_name=True)

    detected_genre: str
    genre_scores: Dict[str, int]
    vocabulary: Dict[str, Any]
    syntax: Dict[str, Any]
    statistics: Dict[str, Any]
    preset_profile: Dict[str, Any]


class GuidanceResponse(BaseModel):
    """Complete writing guidance response."""
    model_config = ConfigDict(populate_by_name=True)

    chapter: int
    genre: str
    profile_key: str
    strategy_card: Dict[str, Any]
    guidance: List[str]
    methodology: List[str]
    checklist: List[Dict[str, Any]]
    checklist_completion: Dict[str, Any]
    risk_flags: List[str]


# ============================================
# Dependencies
# ============================================

def get_genre_service(db: AsyncSession = Depends(get_db)) -> GenreService:
    """Dependency to inject GenreService."""
    return GenreService(db)


# ============================================
# Endpoints
# ============================================

@router.get(
    "/",
    response_model=List[GenrePresetResponse],
    summary="列出所有题材预设",
    description="获取所有可用的网文题材预设列表。",
)
async def list_genres(
    service: GenreService = Depends(get_genre_service)
):
    """List all available genre presets."""
    presets = service.list_genre_presets()
    return presets


@router.get(
    "/aliases",
    response_model=AliasesResponse,
    summary="获取题材别名映射",
    description="获取所有题材别名和profile key的映射关系。",
)
async def get_genre_aliases(
    service: GenreService = Depends(get_genre_service)
):
    """Get all genre alias mappings."""
    return service.get_all_aliases()


@router.get(
    "/{genre}/profile",
    response_model=GenreProfileResponse,
    summary="获取题材Profile",
    description="获取指定题材的完整profile配置。支持别名查询。",
)
async def get_genre_profile(
    genre: str,
    service: GenreService = Depends(get_genre_service)
):
    """Get a complete genre profile by name or profile key."""
    profile = service.get_genre_profile(genre)
    if not profile or not profile.get("genre"):
        raise HTTPException(status_code=404, detail=f"Genre '{genre}' not found")
    return profile


@router.post(
    "/{genre}/apply",
    response_model=GenreApplyResponse,
    summary="应用题材到项目",
    description="将指定题材应用到项目，并存储genre配置。",
)
async def apply_genre(
    genre: str,
    request: GenreApplyRequest,
    service: GenreService = Depends(get_genre_service)
):
    """Apply a genre to a project."""
    try:
        result = await service.apply_genre_to_project(request.project_id, request.genre)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post(
    "/build-profile",
    response_model=BuiltProfileResponse,
    summary="从章节构建题材Profile",
    description="根据已有章节内容自动分析并构建题材profile。",
)
async def build_profile(
    request: BuildProfileRequest,
    service: GenreService = Depends(get_genre_service)
):
    """Build a genre profile from chapter contents."""
    profile = await service.build_profile_from_chapters(
        request.project_id, request.chapter_contents
    )
    return profile


@router.post(
    "/{genre}/guidance",
    response_model=GuidanceResponse,
    summary="生成写作指导",
    description="基于题材profile和读者信号生成完整的写作指导。",
)
async def build_guidance(
    genre: str,
    request: GuidanceRequest,
    service: GenreService = Depends(get_genre_service)
):
    """Build writing guidance for a genre and chapter."""
    profile = service.get_genre_profile(genre)
    if not profile or not profile.get("genre"):
        raise HTTPException(status_code=404, detail=f"Genre '{genre}' not found")

    builder = GuidanceBuilder(
        genre_profile=profile,
        reader_signal=request.reader_signal,
    )

    guidance = builder.build_full_guidance(
        chapter=request.chapter,
        low_score_threshold=request.low_score_threshold,
        hook_diversify_enabled=request.hook_diversify_enabled,
    )

    return guidance
