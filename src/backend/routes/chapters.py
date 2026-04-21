# Auto Novel Writer - Chapters Routes
# Interface 3: Chapter and story structure management

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import get_db
from backend.models.entities import (
    Outline, Chapter, IFLine, DraftVersion, PlotThread, AIInspectionResult
)
from backend.middleware.auth import require_auth
from backend.services.cache_service import cached, cache_service
from backend.services.chapter_service import ChapterService
from backend.services.outline_service import OutlineService
from backend.utils.event_bus import AsyncEventBus
from backend.config import settings

# Import centralized schemas for enhanced validation
from backend.schemas import (
    OutlineCreateRequest, OutlineUpdateRequest, OutlineResponse,
    ChapterCreateRequest, ChapterUpdateRequest, ChapterResponse,
    IFLineCreateRequest, IFLineUpdateRequest, IFLineResponse,
    DraftVersionCreateRequest, DraftVersionResponse,
    PlotThreadCreateRequest, PlotThreadUpdateRequest, PlotThreadResponse,
    AIInspectionResultResponse,
    MessageResponse,
)

# Global event bus instance
event_bus = AsyncEventBus()


def get_chapter_service(db: AsyncSession = Depends(get_db)) -> ChapterService:
    """Dependency to inject ChapterService with event bus."""
    return ChapterService(db, event_bus)


def get_outline_service(db: AsyncSession = Depends(get_db)) -> OutlineService:
    """Dependency to inject OutlineService with event bus."""
    return OutlineService(db, event_bus)


router = APIRouter(prefix="/chapters", tags=["chapters"], dependencies=[require_auth])


# Outline endpoints
@router.get("/outlines", response_model=List[OutlineResponse])
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:outlines:list", invalidate_on=["outlines"])
async def list_outlines(
    skip: int = 0,
    limit: int = 50,
    service: OutlineService = Depends(get_outline_service)
):
    """List all outlines."""
    return await service.list_outlines(skip=skip, limit=limit)


@router.post("/outlines", response_model=OutlineResponse)
async def create_outline(
    outline: OutlineCreateRequest,
    service: OutlineService = Depends(get_outline_service)
):
    """Create a new outline."""
    return await service.create_outline(outline.model_dump())


@router.get("/outlines/{outline_id}", response_model=OutlineResponse)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:outlines:detail", invalidate_on=["outlines"])
async def get_outline(
    outline_id: int,
    service: OutlineService = Depends(get_outline_service)
):
    """Get a specific outline."""
    outline = await service.get_outline(outline_id)
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")
    return outline


@router.patch("/outlines/{outline_id}", response_model=OutlineResponse)
async def update_outline(
    outline_id: int,
    outline: OutlineUpdateRequest,
    service: OutlineService = Depends(get_outline_service)
):
    """Update an outline."""
    db_outline = await service.update_outline(outline_id, outline.model_dump(exclude_unset=True))
    if not db_outline:
        raise HTTPException(status_code=404, detail="Outline not found")
    return db_outline


@router.delete("/outlines/{outline_id}")
async def delete_outline(
    outline_id: int,
    service: OutlineService = Depends(get_outline_service)
):
    """Delete an outline."""
    deleted = await service.delete_outline(outline_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Outline not found")
    return {"message": "Outline deleted"}


# Chapter endpoints
@router.get("/", response_model=List[ChapterResponse])
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


@router.post("/", response_model=ChapterResponse)
async def create_chapter(
    chapter: ChapterCreateRequest,
    service: ChapterService = Depends(get_chapter_service)
):
    """Create a new chapter."""
    return await service.create_chapter(chapter.model_dump())


@router.get("/{chapter_id}", response_model=ChapterResponse)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:detail", invalidate_on=["chapters"])
async def get_chapter(
    chapter_id: int,
    service: ChapterService = Depends(get_chapter_service)
):
    """Get a specific chapter."""
    chapter = await service.get_chapter(chapter_id)
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.patch("/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: int,
    chapter: ChapterUpdateRequest,
    service: ChapterService = Depends(get_chapter_service)
):
    """Update a chapter."""
    db_chapter = await service.update_chapter(chapter_id, chapter.model_dump(exclude_unset=True))
    if not db_chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return db_chapter


@router.delete("/{chapter_id}")
async def delete_chapter(
    chapter_id: int,
    service: ChapterService = Depends(get_chapter_service)
):
    """Delete a chapter."""
    deleted = await service.delete_chapter(chapter_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return {"message": "Chapter deleted"}


# Draft versions
@router.get("/{chapter_id}/drafts", response_model=List[DraftVersionResponse])
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:drafts:list", invalidate_on=["drafts"])
async def list_draft_versions(
    chapter_id: int,
    skip: int = 0,
    limit: int = 20,
    service: ChapterService = Depends(get_chapter_service)
):
    """List all draft versions for a chapter."""
    return await service.list_draft_versions(chapter_id, skip=skip, limit=limit)


@router.post("/{chapter_id}/drafts", response_model=DraftVersionResponse)
async def create_draft_version(
    chapter_id: int,
    draft: DraftVersionCreateRequest,
    service: ChapterService = Depends(get_chapter_service)
):
    """Create a new draft version for a chapter."""
    if draft.chapter_id != chapter_id:
        raise HTTPException(status_code=400, detail="Chapter ID mismatch")
    return await service.create_draft_version(draft.model_dump())


@router.get("/{chapter_id}/drafts/{version_number}", response_model=DraftVersionResponse)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:drafts:detail", invalidate_on=["drafts"])
async def get_draft_version(
    chapter_id: int,
    version_number: int,
    service: ChapterService = Depends(get_chapter_service)
):
    """Get a specific draft version."""
    draft = await service.get_draft_version(chapter_id, version_number)
    if not draft:
        raise HTTPException(status_code=404, detail="Draft version not found")
    return draft


# AI Inspection results
@router.get("/{chapter_id}/inspections", response_model=List[AIInspectionResultResponse])
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:inspections:list", invalidate_on=["inspections"])
async def list_inspections(
    chapter_id: int,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """List all AI inspection results for a chapter."""
    result = await db.execute(
        select(AIInspectionResult)
        .where(AIInspectionResult.chapter_id == chapter_id)
        .order_by(AIInspectionResult.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/{chapter_id}/inspections", response_model=AIInspectionResultResponse)
async def create_inspection_result(
    chapter_id: int,
    inspection_type: str,
    issues_json: Optional[str] = None,
    suggestions_json: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Create a new AI inspection result."""
    db_inspection = AIInspectionResult(
        chapter_id=chapter_id,
        inspection_type=inspection_type,
        issues_json=issues_json,
        suggestions_json=suggestions_json
    )
    db.add(db_inspection)
    await db.flush()
    await db.refresh(db_inspection)
    await cache_service.ainvalidate_tag("inspections")
    return db_inspection


# IF Lines - MUST be registered BEFORE /{chapter_id} to avoid route conflicts
@router.get("/if-lines", response_model=List[IFLineResponse])
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:iflines:list", invalidate_on=["iflines"])
async def list_if_lines(
    skip: int = 0,
    limit: int = 50,
    character_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all IF lines."""
    query = select(IFLine)
    if character_id is not None:
        query = query.where(IFLine.linked_character_id == character_id)

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/if-lines", response_model=IFLineResponse)
async def create_if_line(if_line: IFLineCreateRequest, db: AsyncSession = Depends(get_db)):
    """Create a new IF line."""
    db_if_line = IFLine(**if_line.model_dump())
    db.add(db_if_line)
    await db.flush()
    await db.refresh(db_if_line)
    await cache_service.ainvalidate_tag("iflines")
    return db_if_line


@router.get("/if-lines/{if_line_id}", response_model=IFLineResponse)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:iflines:detail", invalidate_on=["iflines"])
async def get_if_line(if_line_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific IF line."""
    result = await db.execute(select(IFLine).where(IFLine.id == if_line_id))
    if_line = result.scalar_one_or_none()
    if not if_line:
        raise HTTPException(status_code=404, detail="IF line not found")
    return if_line


@router.patch("/if-lines/{if_line_id}", response_model=IFLineResponse)
async def update_if_line(
    if_line_id: int,
    if_line: IFLineUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update an IF line."""
    result = await db.execute(select(IFLine).where(IFLine.id == if_line_id))
    db_if_line = result.scalar_one_or_none()
    if not db_if_line:
        raise HTTPException(status_code=404, detail="IF line not found")

    update_data = if_line.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_if_line, key, value)

    db_if_line.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(db_if_line)
    await cache_service.ainvalidate_tag("iflines")
    return db_if_line


@router.delete("/if-lines/{if_line_id}")
async def delete_if_line(if_line_id: int, db: AsyncSession = Depends(get_db)):
    """Delete an IF line."""
    result = await db.execute(select(IFLine).where(IFLine.id == if_line_id))
    if_line = result.scalar_one_or_none()
    if not if_line:
        raise HTTPException(status_code=404, detail="IF line not found")
    await db.delete(if_line)
    await cache_service.ainvalidate_tag("iflines")
    return {"message": "IF line deleted"}


# Plot Threads - MUST be registered BEFORE /{chapter_id} to avoid route conflicts
@router.get("/plot-threads", response_model=List[PlotThreadResponse])
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:plotthreads:list", invalidate_on=["plotthreads"])
async def list_plot_threads(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all plot threads."""
    query = select(PlotThread)
    if status:
        query = query.where(PlotThread.status == status)

    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/plot-threads", response_model=PlotThreadResponse)
async def create_plot_thread(
    plot_thread: PlotThreadCreateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Create a new plot thread."""
    db_plot_thread = PlotThread(**plot_thread.model_dump())
    db.add(db_plot_thread)
    await db.flush()
    await db.refresh(db_plot_thread)
    await cache_service.ainvalidate_tag("plotthreads")
    return db_plot_thread


@router.get("/plot-threads/{plot_thread_id}", response_model=PlotThreadResponse)
@cached(ttl=settings.cache_default_ttl, key_prefix="chapters:plotthreads:detail", invalidate_on=["plotthreads"])
async def get_plot_thread(plot_thread_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific plot thread."""
    result = await db.execute(select(PlotThread).where(PlotThread.id == plot_thread_id))
    plot_thread = result.scalar_one_or_none()
    if not plot_thread:
        raise HTTPException(status_code=404, detail="Plot thread not found")
    return plot_thread


@router.patch("/plot-threads/{plot_thread_id}", response_model=PlotThreadResponse)
async def update_plot_thread(
    plot_thread_id: int,
    plot_thread: PlotThreadUpdateRequest,
    db: AsyncSession = Depends(get_db)
):
    """Update a plot thread."""
    result = await db.execute(select(PlotThread).where(PlotThread.id == plot_thread_id))
    db_plot_thread = result.scalar_one_or_none()
    if not db_plot_thread:
        raise HTTPException(status_code=404, detail="Plot thread not found")

    update_data = plot_thread.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_plot_thread, key, value)

    await db.flush()
    await db.refresh(db_plot_thread)
    await cache_service.ainvalidate_tag("plotthreads")
    return db_plot_thread


@router.delete("/plot-threads/{plot_thread_id}")
async def delete_plot_thread(plot_thread_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a plot thread."""
    result = await db.execute(select(PlotThread).where(PlotThread.id == plot_thread_id))
    plot_thread = result.scalar_one_or_none()
    if not plot_thread:
        raise HTTPException(status_code=404, detail="Plot thread not found")
    await db.delete(plot_thread)
    await cache_service.ainvalidate_tag("plotthreads")
    return {"message": "Plot thread deleted"}
