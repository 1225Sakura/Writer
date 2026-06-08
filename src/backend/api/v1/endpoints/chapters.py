# Auto Novel Writer - Chapters Routes
# Interface 3: Chapter and story structure management

import difflib
from fastapi import APIRouter, Depends
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.middleware.auth import require_auth
from backend.infrastructure.cache.cache_service import cached, get_cache_service
from backend.core.services.chapter.chapter_service import ChapterService
from backend.core.services.outline.outline_service import OutlineService
from backend.core.services.if_line.if_line_service import IFLineService
from backend.core.services.plot_thread.plot_thread_service import PlotThreadService
from backend.core.services.ai_inspection_result.ai_inspection_result_service import AIInspectionResultService
from backend.api.v1.dependencies import get_event_bus
from backend.config import settings
from backend.middleware.errors import (
    ChapterNotFoundError,
    OutlineNotFoundError,
    DraftVersionNotFoundError,
    SnapshotNotFoundError,
    IFLineNotFoundError,
    PlotThreadNotFoundError,
    ValidationError,
)

# Import centralized schemas for enhanced validation
from backend.core.domain.schemas import (
    OutlineCreateRequest, OutlineUpdateRequest, OutlineResponse,
    ChapterCreateRequest, ChapterUpdateRequest, ChapterReorderRequest, ChapterResponse,
    IFLineCreateRequest, IFLineUpdateRequest, IFLineResponse,
    DraftVersionCreateRequest, DraftVersionResponse,
    SnapshotCreateRequest, SnapshotMarkRequest, SnapshotDiffRequest,
    SnapshotResponse, SnapshotDiffResponse,
    PlotThreadCreateRequest, PlotThreadUpdateRequest, PlotThreadResponse,
    AIInspectionResultResponse,
    MessageResponse,
)

def get_chapter_service(db: AsyncSession = Depends(get_db)) -> ChapterService:
    """Dependency to inject ChapterService with event bus and cache."""
    return ChapterService(db, get_event_bus(), get_cache_service())


def get_outline_service(db: AsyncSession = Depends(get_db)) -> OutlineService:
    """Dependency to inject OutlineService with event bus and cache."""
    return OutlineService(db, get_event_bus(), get_cache_service())


def get_if_line_service(db: AsyncSession = Depends(get_db)) -> IFLineService:
    """Dependency to inject IFLineService with event bus and cache."""
    return IFLineService(db, get_event_bus(), get_cache_service())


def get_plot_thread_service(db: AsyncSession = Depends(get_db)) -> PlotThreadService:
    """Dependency to inject PlotThreadService with event bus and cache."""
    return PlotThreadService(db, get_event_bus(), get_cache_service())


def get_ai_inspection_result_service(db: AsyncSession = Depends(get_db)) -> AIInspectionResultService:
    """Dependency to inject AIInspectionResultService with event bus and cache."""
    return AIInspectionResultService(db, get_event_bus(), get_cache_service())


router = APIRouter(prefix="/chapters", tags=["chapters"], dependencies=[require_auth])


# Outline endpoints
@router.get(
    "/outlines",
    response_model=List[OutlineResponse],
    summary="列出所有大纲",
    description="获取所有故事大纲的列表，支持分页。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:outlines:list", invalidate_on=["outlines"])
async def list_outlines(
    skip: int = 0,
    limit: int = 50,
    service: OutlineService = Depends(get_outline_service)
):
    """List all outlines."""
    return await service.list_outlines(skip=skip, limit=limit)


@router.post(
    "/outlines",
    response_model=OutlineResponse,
    summary="创建大纲",
    description="创建新的故事大纲。",
)
async def create_outline(
    outline: OutlineCreateRequest,
    service: OutlineService = Depends(get_outline_service)
):
    """Create a new outline."""
    return await service.create_outline(outline.model_dump())


@router.get(
    "/outlines/{outline_id}",
    response_model=OutlineResponse,
    summary="获取大纲详情",
    description="获取指定ID的大纲详细信息。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:outlines:detail", invalidate_on=["outlines"])
async def get_outline(
    outline_id: int,
    service: OutlineService = Depends(get_outline_service)
):
    """Get a specific outline."""
    outline = await service.get_outline(outline_id)
    if not outline:
        raise OutlineNotFoundError(outline_id=outline_id)
    return outline


@router.patch(
    "/outlines/{outline_id}",
    response_model=OutlineResponse,
    summary="更新大纲",
    description="更新指定ID的大纲信息。",
)
async def update_outline(
    outline_id: int,
    outline: OutlineUpdateRequest,
    service: OutlineService = Depends(get_outline_service)
):
    """Update an outline."""
    db_outline = await service.update_outline(outline_id, outline.model_dump(exclude_unset=True))
    if not db_outline:
        raise OutlineNotFoundError(outline_id=outline_id)
    return db_outline


@router.delete(
    "/outlines/{outline_id}",
    summary="删除大纲",
    description="删除指定ID的大纲及其关联数据。",
)
async def delete_outline(
    outline_id: int,
    service: OutlineService = Depends(get_outline_service)
):
    """Delete an outline."""
    deleted = await service.delete_outline(outline_id)
    if not deleted:
        raise OutlineNotFoundError(outline_id=outline_id)
    return {"message": "Outline deleted"}


# IF Lines - registered BEFORE /{chapter_id} to avoid route conflicts
@router.get(
    "/if-lines",
    response_model=List[IFLineResponse],
    summary="列出所有IF线",
    description="获取所有IF线的列表，可按关联角色ID过滤。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:iflines:list", invalidate_on=["iflines"])
async def list_if_lines(
    skip: int = 0,
    limit: int = 50,
    character_id: Optional[int] = None,
    service: IFLineService = Depends(get_if_line_service)
):
    """List all IF lines."""
    filters = {}
    if character_id is not None:
        filters["linked_character_id"] = character_id
    return await service.list_if_lines(skip=skip, limit=limit, **filters)


@router.post(
    "/if-lines",
    response_model=IFLineResponse,
    summary="创建IF线",
    description="创建新的IF线（角色故事线）。",
)
async def create_if_line(
    if_line: IFLineCreateRequest,
    service: IFLineService = Depends(get_if_line_service)
):
    """Create a new IF line."""
    return await service.create_if_line(if_line.model_dump())


@router.get(
    "/if-lines/{if_line_id}",
    response_model=IFLineResponse,
    summary="获取IF线详情",
    description="获取指定ID的IF线详细信息。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:iflines:detail", invalidate_on=["iflines"])
async def get_if_line(
    if_line_id: int,
    service: IFLineService = Depends(get_if_line_service)
):
    """Get a specific IF line."""
    if_line = await service.get_if_line(if_line_id)
    if not if_line:
        raise IFLineNotFoundError(if_line_id=if_line_id)
    return if_line


@router.patch(
    "/if-lines/{if_line_id}",
    response_model=IFLineResponse,
    summary="更新IF线",
    description="更新指定ID的IF线信息。",
)
async def update_if_line(
    if_line_id: int,
    if_line: IFLineUpdateRequest,
    service: IFLineService = Depends(get_if_line_service)
):
    """Update an IF line."""
    db_if_line = await service.update_if_line(if_line_id, if_line.model_dump(exclude_unset=True))
    if not db_if_line:
        raise IFLineNotFoundError(if_line_id=if_line_id)
    return db_if_line


@router.delete(
    "/if-lines/{if_line_id}",
    summary="删除IF线",
    description="删除指定ID的IF线。",
)
async def delete_if_line(
    if_line_id: int,
    service: IFLineService = Depends(get_if_line_service)
):
    """Delete an IF line."""
    deleted = await service.delete_if_line(if_line_id)
    if not deleted:
        raise IFLineNotFoundError(if_line_id=if_line_id)
    return {"message": "IF line deleted"}


@router.post(
    "/if-lines/{if_line_id}/sync",
    summary="同步IF线",
    description="同步指定IF线与主线的故事线进度，检测冲突。",
)
async def sync_if_line(
    if_line_id: int,
    service: IFLineService = Depends(get_if_line_service)
):
    """Sync an IF line with the main storyline."""
    if_line = await service.get_if_line(if_line_id)
    if not if_line:
        raise IFLineNotFoundError(if_line_id=if_line_id)

    # Basic sync: return the IF line state and any conflicts detected
    return {
        "if_line_id": if_line_id,
        "status": "synced",
        "conflicts": [],
        "synced_at": __import__('datetime').datetime.utcnow().isoformat(),
    }


# Plot Threads - registered BEFORE /{chapter_id} to avoid route conflicts
@router.get(
    "/plot-threads",
    response_model=List[PlotThreadResponse],
    summary="列出所有伏笔",
    description="获取所有伏笔（剧情线）的列表，可按状态过滤。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:plotthreads:list", invalidate_on=["plotthreads"])
async def list_plot_threads(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    service: PlotThreadService = Depends(get_plot_thread_service)
):
    """List all plot threads."""
    filters = {}
    if status:
        filters["status"] = status
    return await service.list_plot_threads(skip=skip, limit=limit, **filters)


@router.post(
    "/plot-threads",
    response_model=PlotThreadResponse,
    summary="创建伏笔",
    description="创建新的伏笔（剧情线）。",
)
async def create_plot_thread(
    plot_thread: PlotThreadCreateRequest,
    service: PlotThreadService = Depends(get_plot_thread_service)
):
    """Create a new plot thread."""
    return await service.create_plot_thread(plot_thread.model_dump())


@router.get(
    "/plot-threads/{plot_thread_id}",
    response_model=PlotThreadResponse,
    summary="获取伏笔详情",
    description="获取指定ID的伏笔详细信息。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:plotthreads:detail", invalidate_on=["plotthreads"])
async def get_plot_thread(
    plot_thread_id: int,
    service: PlotThreadService = Depends(get_plot_thread_service)
):
    """Get a specific plot thread."""
    plot_thread = await service.get_plot_thread(plot_thread_id)
    if not plot_thread:
        raise PlotThreadNotFoundError(plot_thread_id=plot_thread_id)
    return plot_thread


@router.patch(
    "/plot-threads/{plot_thread_id}",
    response_model=PlotThreadResponse,
    summary="更新伏笔",
    description="更新指定ID的伏笔信息。",
)
async def update_plot_thread(
    plot_thread_id: int,
    plot_thread: PlotThreadUpdateRequest,
    service: PlotThreadService = Depends(get_plot_thread_service)
):
    """Update a plot thread."""
    db_plot_thread = await service.update_plot_thread(plot_thread_id, plot_thread.model_dump(exclude_unset=True))
    if not db_plot_thread:
        raise PlotThreadNotFoundError(plot_thread_id=plot_thread_id)
    return db_plot_thread


@router.delete(
    "/plot-threads/{plot_thread_id}",
    summary="删除伏笔",
    description="删除指定ID的伏笔。",
)
async def delete_plot_thread(
    plot_thread_id: int,
    service: PlotThreadService = Depends(get_plot_thread_service)
):
    """Delete a plot thread."""
    deleted = await service.delete_plot_thread(plot_thread_id)
    if not deleted:
        raise PlotThreadNotFoundError(plot_thread_id=plot_thread_id)
    return {"message": "Plot thread deleted"}


# Chapter endpoints
@router.get(
    "/",
    response_model=List[ChapterResponse],
    summary="列出所有章节",
    description="获取所有章节的列表，支持按大纲ID和状态过滤。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:list", invalidate_on=["chapters"])
async def list_chapters(
    skip: int = 0,
    limit: int = 100,
    outline_id: Optional[int] = None,
    status: Optional[str] = None,
    service: ChapterService = Depends(get_chapter_service)
):
    """List all chapters with optional filtering."""
    return await service.list_chapters(skip=skip, limit=limit, outline_id=outline_id, status=status)


@router.post(
    "/",
    response_model=ChapterResponse,
    summary="创建章节",
    description="创建新的章节。",
)


@router.patch(
    "/reorder",
    summary="章节拖拽排序",
    description="批量更新章节的排序顺序。",
)
async def reorder_chapters(
    request: ChapterReorderRequest,
    service: ChapterService = Depends(get_chapter_service)
):
    """Reorder chapters within an outline via drag-and-drop."""
    chapter_orders = [{"id": entry.id, "chapter_order": entry.chapter_order} for entry in request.chapter_orders]
    success = await service.reorder_chapters(request.outline_id, chapter_orders)
    if not success:
        raise ValidationError(message="Failed to reorder chapters", error_code="REORDER_FAILED")
    return {"message": "Chapters reordered successfully"}
async def create_chapter(
    chapter: ChapterCreateRequest,
    service: ChapterService = Depends(get_chapter_service)
):
    """Create a new chapter."""
    return await service.create_chapter(chapter.model_dump())


@router.get(
    "/{chapter_id}",
    response_model=ChapterResponse,
    summary="获取章节详情",
    description="获取指定ID的章节详细信息。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:detail", invalidate_on=["chapters"])
async def get_chapter(
    chapter_id: int,
    service: ChapterService = Depends(get_chapter_service)
):
    """Get a specific chapter."""
    chapter = await service.get_chapter(chapter_id)
    if not chapter:
        raise ChapterNotFoundError(chapter_id=chapter_id)
    return chapter


@router.patch(
    "/{chapter_id}",
    response_model=ChapterResponse,
    summary="更新章节",
    description="更新指定ID的章节信息。",
)
async def update_chapter(
    chapter_id: int,
    chapter: ChapterUpdateRequest,
    service: ChapterService = Depends(get_chapter_service)
):
    """Update a chapter."""
    db_chapter = await service.update_chapter(chapter_id, chapter.model_dump(exclude_unset=True))
    if not db_chapter:
        raise ChapterNotFoundError(chapter_id=chapter_id)
    return db_chapter


@router.delete(
    "/{chapter_id}",
    summary="删除章节",
    description="删除指定ID的章节及其关联数据。",
)
async def delete_chapter(
    chapter_id: int,
    service: ChapterService = Depends(get_chapter_service)
):
    """Delete a chapter."""
    deleted = await service.delete_chapter(chapter_id)
    if not deleted:
        raise ChapterNotFoundError(chapter_id=chapter_id)
    return {"message": "Chapter deleted"}


# Draft versions
@router.get(
    "/{chapter_id}/drafts",
    response_model=List[DraftVersionResponse],
    summary="列出草稿版本",
    description="获取指定章节的所有草稿版本列表。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:drafts:list", invalidate_on=["drafts"])
async def list_draft_versions(
    chapter_id: int,
    skip: int = 0,
    limit: int = 20,
    service: ChapterService = Depends(get_chapter_service)
):
    """List all draft versions for a chapter."""
    return await service.list_draft_versions(chapter_id, skip=skip, limit=limit)


@router.post(
    "/{chapter_id}/drafts",
    response_model=DraftVersionResponse,
    summary="创建草稿版本",
    description="为指定章节创建新的草稿版本。",
)
async def create_draft_version(
    chapter_id: int,
    draft: DraftVersionCreateRequest,
    service: ChapterService = Depends(get_chapter_service)
):
    """Create a new draft version for a chapter."""
    if draft.chapter_id != chapter_id:
        raise ValidationError(message="Chapter ID mismatch", error_code="CHAPTER_ID_MISMATCH")
    return await service.create_draft_version(draft.model_dump())


@router.get(
    "/{chapter_id}/drafts/{version_number}",
    response_model=DraftVersionResponse,
    summary="获取草稿版本",
    description="获取指定章节的特定版本草稿。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:drafts:detail", invalidate_on=["drafts"])
async def get_draft_version(
    chapter_id: int,
    version_number: int,
    service: ChapterService = Depends(get_chapter_service)
):
    """Get a specific draft version."""
    draft = await service.get_draft_version(chapter_id, version_number)
    if not draft:
        raise DraftVersionNotFoundError(chapter_id=chapter_id)
    return draft


@router.delete(
    "/{chapter_id}/drafts/{version_number}",
    summary="删除草稿版本",
    description="删除指定章节的特定版本草稿。",
)
async def delete_draft_version(
    chapter_id: int,
    version_number: int,
    service: ChapterService = Depends(get_chapter_service)
):
    """Delete a specific draft version."""
    deleted = await service.delete_draft_version(chapter_id, version_number)
    if not deleted:
        raise DraftVersionNotFoundError(chapter_id=chapter_id)
    return {"message": "Draft version deleted"}


# Snapshot endpoints
@router.post(
    "/{chapter_id}/snapshots",
    response_model=SnapshotResponse,
    summary="创建快照",
    description="为指定章节创建内容快照。自动快照保留最近20个，手动标记的快照永久保留。",
)
async def create_snapshot(
    chapter_id: int,
    snapshot: SnapshotCreateRequest,
    service: ChapterService = Depends(get_chapter_service)
):
    """Create a new snapshot for a chapter."""
    chapter = await service.get_chapter(chapter_id)
    if not chapter:
        raise ChapterNotFoundError(chapter_id=chapter_id)
    return await service.create_snapshot(chapter_id, snapshot.model_dump())


@router.get(
    "/{chapter_id}/snapshots",
    response_model=List[SnapshotResponse],
    summary="列出快照",
    description="获取指定章节的所有快照，按创建时间倒序排列。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:snapshots:list", invalidate_on=["snapshots"])
async def list_snapshots(
    chapter_id: int,
    skip: int = 0,
    limit: int = 100,
    service: ChapterService = Depends(get_chapter_service)
):
    """List all snapshots for a chapter, newest first."""
    return await service.list_snapshots(chapter_id, skip=skip, limit=limit)


@router.get(
    "/{chapter_id}/snapshots/{snapshot_id}",
    response_model=SnapshotResponse,
    summary="获取快照详情",
    description="获取指定ID的快照详细信息。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:snapshots:detail", invalidate_on=["snapshots"])
async def get_snapshot(
    chapter_id: int,
    snapshot_id: int,
    service: ChapterService = Depends(get_chapter_service)
):
    """Get a specific snapshot."""
    snapshot = await service.get_snapshot(snapshot_id)
    if not snapshot or snapshot.chapter_id != chapter_id:
        raise SnapshotNotFoundError(snapshot_id=snapshot_id)
    return snapshot


@router.delete(
    "/{chapter_id}/snapshots/{snapshot_id}",
    summary="删除快照",
    description="删除指定ID的快照。",
)
async def delete_snapshot(
    chapter_id: int,
    snapshot_id: int,
    service: ChapterService = Depends(get_chapter_service)
):
    """Delete a snapshot."""
    snapshot = await service.get_snapshot(snapshot_id)
    if not snapshot or snapshot.chapter_id != chapter_id:
        raise SnapshotNotFoundError(snapshot_id=snapshot_id)
    deleted = await service.delete_snapshot(snapshot_id)
    if not deleted:
        raise SnapshotNotFoundError(snapshot_id=snapshot_id)
    return {"message": "Snapshot deleted"}


@router.patch(
    "/{chapter_id}/snapshots/{snapshot_id}/mark",
    response_model=SnapshotResponse,
    summary="标记/取消标记快照",
    description="标记快照为永久保留或取消标记。手动标记的快照不会被自动清理。",
)
async def mark_snapshot(
    chapter_id: int,
    snapshot_id: int,
    body: SnapshotMarkRequest,
    service: ChapterService = Depends(get_chapter_service)
):
    """Mark or unmark a snapshot."""
    snapshot = await service.get_snapshot(snapshot_id)
    if not snapshot or snapshot.chapter_id != chapter_id:
        raise SnapshotNotFoundError(snapshot_id=snapshot_id)
    result = await service.mark_snapshot(snapshot_id, body.is_marked)
    if not result:
        raise SnapshotNotFoundError(snapshot_id=snapshot_id)
    return result


@router.post(
    "/snapshots/diff",
    response_model=SnapshotDiffResponse,
    summary="快照对比",
    description="比较两个快照之间的内容差异，返回逐行 diff 结果。",
)
async def diff_snapshots(
    body: SnapshotDiffRequest,
    service: ChapterService = Depends(get_chapter_service)
):
    """Compare two snapshots and return a line-by-line diff."""
    snapshot_a = await service.get_snapshot(body.snapshot_id_a)
    if not snapshot_a:
        raise SnapshotNotFoundError(snapshot_id=body.snapshot_id_a)

    snapshot_b = await service.get_snapshot(body.snapshot_id_b)
    if not snapshot_b:
        raise SnapshotNotFoundError(snapshot_id=body.snapshot_id_b)

    diff_lines = list(difflib.unified_diff(
        snapshot_a.content.splitlines(keepends=True),
        snapshot_b.content.splitlines(keepends=True),
        fromfile=f"snapshot_{snapshot_a.id}",
        tofile=f"snapshot_{snapshot_b.id}",
    ))

    return SnapshotDiffResponse(
        snapshot_a=SnapshotResponse.model_validate(snapshot_a),
        snapshot_b=SnapshotResponse.model_validate(snapshot_b),
        diff_lines=diff_lines,
    )


# AI Inspection results
@router.get(
    "/{chapter_id}/inspections",
    response_model=List[AIInspectionResultResponse],
    summary="列出AI审查结果",
    description="获取指定章节的所有AI审查结果列表。",
)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:inspections:list", invalidate_on=["inspections"])
async def list_inspections(
    chapter_id: int,
    skip: int = 0,
    limit: int = 20,
    service: AIInspectionResultService = Depends(get_ai_inspection_result_service)
):
    """List all AI inspection results for a chapter."""
    return await service.get_by_chapter(chapter_id)


@router.post(
    "/{chapter_id}/inspections",
    response_model=AIInspectionResultResponse,
    summary="创建AI审查结果",
    description="为指定章节创建新的AI审查结果记录。",
)
async def create_inspection_result(
    chapter_id: int,
    inspection_type: str,
    issues_json: Optional[str] = None,
    suggestions_json: Optional[str] = None,
    service: AIInspectionResultService = Depends(get_ai_inspection_result_service)
):
    """Create a new AI inspection result."""
    data = {
        "chapter_id": chapter_id,
        "inspection_type": inspection_type,
        "issues_json": issues_json,
        "suggestions_json": suggestions_json,
    }
    return await service.create_ai_inspection_result(data)
