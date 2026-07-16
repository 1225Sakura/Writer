"""Outline routes — extracted to its own module to avoid broken imports
in chapters.py (DraftVersion/IFLine/PlotThread models removed in earlier
cleanup). Mirrors Project/Character/Location router pattern using OutlineService.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.schemas import (
    ApiResponse,
    ForkOutlineRequest,
    ForkOutlineResponse,
    GenerateOutlineRequest,
    GenerateOutlineResponse,
    OutlineCreate,
    OutlineOut,
    OutlineUpdate,
)
from app.core.exceptions import NotFoundException
from app.dependencies import (
    get_outline_fork_service,
    get_outline_generator_service,
    get_outline_service,
)
from app.services.outline import OutlineService
from app.services.outline_fork import OutlineForkService
from app.services.outline_generator import OutlineGeneratorService

outlines_router = APIRouter(prefix="/chapters/outlines", tags=["Chapters"])


@outlines_router.get("")
def list_outlines(
    project_id: int | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    svc: OutlineService = Depends(get_outline_service),
) -> ApiResponse[list]:
    rows = svc.list(project_id=project_id, skip=skip, limit=limit)
    return ApiResponse(data=[OutlineOut.model_validate(r).model_dump() for r in rows])


@outlines_router.post("")
def create_outline(
    data: OutlineCreate,
    svc: OutlineService = Depends(get_outline_service),
) -> ApiResponse[dict]:
    obj = svc.create(data, project_id=data.project_id)
    return ApiResponse(data=OutlineOut.model_validate(obj).model_dump())


@outlines_router.post("/generate")
def generate_outline(
    data: GenerateOutlineRequest,
    svc: OutlineGeneratorService = Depends(get_outline_generator_service),
) -> ApiResponse[dict]:
    result = svc.generate(
        project_id=data.project_id,
        chapter_count=data.chapter_count,
        settings_snapshot=data.settings_snapshot,
    )
    validated = GenerateOutlineResponse.model_validate(result)
    return ApiResponse(data=validated.model_dump(by_alias=True))


@outlines_router.get("/{outline_id}")
def get_outline(outline_id: int, svc: OutlineService = Depends(get_outline_service)) -> ApiResponse[dict]:
    obj = svc.get(outline_id)
    if not obj:
        raise NotFoundException("Outline", outline_id)
    return ApiResponse(data=OutlineOut.model_validate(obj).model_dump())


@outlines_router.patch("/{outline_id}")
def update_outline(outline_id: int, data: OutlineUpdate, svc: OutlineService = Depends(get_outline_service)) -> ApiResponse[dict]:
    obj = svc.update(outline_id, data)
    if not obj:
        raise NotFoundException("Outline", outline_id)
    return ApiResponse(data=OutlineOut.model_validate(obj).model_dump())


@outlines_router.delete("/{outline_id}")
def delete_outline(outline_id: int, svc: OutlineService = Depends(get_outline_service)) -> ApiResponse[dict]:
    if not svc.delete(outline_id):
        raise NotFoundException("Outline", outline_id)
    return ApiResponse(message="Outline deleted")


@outlines_router.post("/{outline_id}/fork", status_code=201)
def fork_outline(
    outline_id: int,
    body: ForkOutlineRequest,
    svc: OutlineForkService = Depends(get_outline_fork_service),
) -> ForkOutlineResponse:
    result = svc.fork(
        outline_id,
        name=body.name,
        project_id=body.project_id,
        fork_chapter_id=body.fork_chapter_id,
    )
    return ForkOutlineResponse(**result)
