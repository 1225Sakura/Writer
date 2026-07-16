"""Chapter routes — CRUD under a project. Draft endpoints live in
`app/routers/drafts.py` (extracted in US-008). Mirrors
Project/Character/Location router pattern using ChapterService.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Query

from app.core.exceptions import NotFoundException
from app.dependencies import (
    get_chapter_fork_service,
    get_chapter_service,
    get_draft_service,
    get_if_line_sync_service,
)
from app.schemas import ApiResponse, ChapterCreate, ChapterUpdate, ChapterOut
from app.schemas.chapter_fork import ForkChapterRequest, ForkChapterResponse
from app.schemas.if_line_sync import SyncRequest, SyncResponse
from app.services.chapter import ChapterService
from app.services.chapter_fork import ChapterForkService
from app.services.draft import DraftService
from app.services.if_line_sync import IFLineSyncService


chapters_router = APIRouter(prefix="/chapters", tags=["Chapters"])


@chapters_router.get("")
def list_chapters(
    project_id: int | None = Query(None),
    outline_id: int | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    svc: ChapterService = Depends(get_chapter_service),
) -> ApiResponse[list]:
    rows = svc.list(project_id=project_id, outline_id=outline_id, skip=skip, limit=limit)
    return ApiResponse(data=[ChapterOut.model_validate(r).model_dump() for r in rows])


@chapters_router.post("")
def create_chapter(
    data: ChapterCreate,
    svc: ChapterService = Depends(get_chapter_service),
) -> ApiResponse[dict]:
    obj = svc.create(data, project_id=data.project_id)
    return ApiResponse(data=ChapterOut.model_validate(obj).model_dump())


@chapters_router.get("/{chapter_id}")
def get_chapter(
    chapter_id: int,
    svc: ChapterService = Depends(get_chapter_service),
    draft_svc: DraftService = Depends(get_draft_service),
) -> ApiResponse[dict]:
    obj = svc.get(chapter_id)
    if not obj:
        raise NotFoundException("Chapter", chapter_id)
    payload = ChapterOut.model_validate(obj).model_dump()
    # Expose latest draft's content as the chapter's current text so the
    # single GET endpoint serves both metadata and body (US-013 smoke).
    latest = draft_svc.get_latest(chapter_id)
    if latest is not None:
        payload["content"] = latest.content
    return ApiResponse(data=payload)


@chapters_router.patch("/{chapter_id}")
def update_chapter(
    chapter_id: int,
    data: ChapterUpdate,
    svc: ChapterService = Depends(get_chapter_service),
) -> ApiResponse[dict]:
    obj = svc.update(chapter_id, data)
    if not obj:
        raise NotFoundException("Chapter", chapter_id)
    return ApiResponse(data=ChapterOut.model_validate(obj).model_dump())


@chapters_router.delete("/{chapter_id}")
def delete_chapter(
    chapter_id: int,
    svc: ChapterService = Depends(get_chapter_service),
) -> ApiResponse[dict]:
    if not svc.delete(chapter_id):
        raise NotFoundException("Chapter", chapter_id)
    return ApiResponse(message="Chapter deleted")


@chapters_router.post("/{chapter_id}/fork", status_code=201)
def fork_chapter(
    chapter_id: int,
    body: ForkChapterRequest,
    svc: ChapterForkService = Depends(get_chapter_fork_service),
) -> ForkChapterResponse:
    result = svc.fork(chapter_id, body.ifLineId, body.name)
    return ForkChapterResponse(**result)


@chapters_router.post("/if-lines/{if_line_id}/sync")
def sync_if_line(
    if_line_id: int,
    body: SyncRequest,
    svc: IFLineSyncService = Depends(get_if_line_sync_service),
) -> SyncResponse:
    """Sync a base chapter into one or more target IF lines (US-017).

    Returns synced chapters (when content was copied) and any conflicts
    detected (when content diverged in the target line).
    """
    result = svc.sync(if_line_id, body.baseChapterId, body.targetLineIds)
    return SyncResponse(**result)
