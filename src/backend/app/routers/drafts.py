"""Draft routes — append-only versioning of chapter content.

All endpoints sit under `/chapters/{chapter_id}/drafts`. The router is
mounted at `/chapters` and includes `chapter_id` in every path because
FastAPI does not allow path parameters in `APIRouter(prefix=...)`.

Routes are registered in the order: list, create, latest, version —
`/latest` MUST come before `/{version}` so the literal segment wins.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends

from app.core.exceptions import NotFoundException
from app.core.security import verify_api_key
from app.dependencies import get_chapter_service, get_draft_service
from app.schemas import ApiResponse
from app.services.chapter import ChapterService
from app.services.draft import DraftService


drafts_router = APIRouter(prefix="/chapters", tags=["Chapters"], dependencies=[Depends(verify_api_key)])


def _serialize(d) -> dict:
    return {
        "id": d.id,
        "chapter_id": d.chapter_id,
        "version_number": d.version_number,
        "content": d.content,
        "created_at": d.created_at.isoformat() if d.created_at else "",
        "updated_at": d.updated_at.isoformat() if d.updated_at else "",
    }


@drafts_router.get("/{chapter_id}/drafts")
def list_drafts(
    chapter_id: int,
    skip: int = 0,
    limit: int = 100,
    chapter_svc: ChapterService = Depends(get_chapter_service),
    draft_svc: DraftService = Depends(get_draft_service),
) -> ApiResponse[list]:
    if not chapter_svc.get(chapter_id):
        raise NotFoundException("Chapter", chapter_id)
    rows = draft_svc.list(chapter_id=chapter_id, skip=skip, limit=limit)
    return ApiResponse(data=[_serialize(r) for r in rows])


@drafts_router.post("/{chapter_id}/drafts")
def create_draft(
    chapter_id: int,
    data: dict,
    chapter_svc: ChapterService = Depends(get_chapter_service),
    draft_svc: DraftService = Depends(get_draft_service),
) -> ApiResponse[dict]:
    if not chapter_svc.get(chapter_id):
        raise NotFoundException("Chapter", chapter_id)
    content = (data or {}).get("content", "")
    obj = draft_svc.create_next_version(chapter_id=chapter_id, content=content)
    return ApiResponse(data=_serialize(obj))


@drafts_router.get("/{chapter_id}/drafts/latest")
def get_latest_draft(
    chapter_id: int,
    chapter_svc: ChapterService = Depends(get_chapter_service),
    draft_svc: DraftService = Depends(get_draft_service),
) -> ApiResponse[dict]:
    if not chapter_svc.get(chapter_id):
        raise NotFoundException("Chapter", chapter_id)
    latest = draft_svc.get_latest(chapter_id)
    if not latest:
        raise NotFoundException("Draft", f"{chapter_id}/latest")
    return ApiResponse(data=_serialize(latest))


@drafts_router.get("/{chapter_id}/drafts/{version}")
def get_draft(
    chapter_id: int,
    version: int,
    draft_svc: DraftService = Depends(get_draft_service),
) -> ApiResponse[dict]:
    obj = draft_svc.get(chapter_id, version)
    if not obj:
        raise NotFoundException("Draft", f"{chapter_id}/{version}")
    return ApiResponse(data=_serialize(obj))
