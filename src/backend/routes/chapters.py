# Auto Novel Writer - Chapters Routes
# Interface 3: Chapter and story structure management

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.database import get_db
from backend.models.entities import (
    Outline, Chapter, IFLine, DraftVersion, PlotThread, AIInspectionResult
)

router = APIRouter(prefix="/chapters", tags=["chapters"])


# Pydantic models
class OutlineCreate(BaseModel):
    title: str
    description: Optional[str] = None


class OutlineUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None


class OutlineResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]

    class Config:
        from_attributes = True


class ChapterCreate(BaseModel):
    outline_id: Optional[int] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    status: str = "pending"
    word_count: int = 0
    chapter_order: int = 0


class ChapterUpdate(BaseModel):
    outline_id: Optional[int] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    status: Optional[str] = None
    word_count: Optional[int] = None
    chapter_order: Optional[int] = None


class ChapterResponse(BaseModel):
    id: int
    outline_id: Optional[int]
    title: Optional[str]
    summary: Optional[str]
    status: str
    word_count: int
    chapter_order: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IFLineCreate(BaseModel):
    title: str
    linked_character_id: Optional[int] = None
    description: Optional[str] = None
    sync_mode: str = "auto"


class IFLineUpdate(BaseModel):
    title: Optional[str] = None
    linked_character_id: Optional[int] = None
    description: Optional[str] = None
    sync_mode: Optional[str] = None


class IFLineResponse(BaseModel):
    id: int
    title: str
    linked_character_id: Optional[int]
    description: Optional[str]
    sync_mode: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DraftVersionCreate(BaseModel):
    chapter_id: int
    content: str
    version_number: int


class DraftVersionResponse(BaseModel):
    id: int
    chapter_id: int
    content: str
    version_number: int
    created_at: datetime

    class Config:
        from_attributes = True


class PlotThreadCreate(BaseModel):
    title: str
    description: Optional[str] = None
    status: str = "active"
    created_chapter_id: Optional[int] = None
    reveal_chapter_id: Optional[int] = None


class PlotThreadUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    created_chapter_id: Optional[int] = None
    reveal_chapter_id: Optional[int] = None


class PlotThreadResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    status: str
    created_chapter_id: Optional[int]
    reveal_chapter_id: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class AIInspectionResultResponse(BaseModel):
    id: int
    chapter_id: int
    inspection_type: str
    issues_json: Optional[str]
    suggestions_json: Optional[str]
    auto_fixed: bool
    created_at: datetime

    class Config:
        from_attributes = True


# Outline endpoints
@router.get("/outlines", response_model=List[OutlineResponse])
async def list_outlines(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """List all outlines."""
    result = await db.execute(select(Outline).offset(skip).limit(limit))
    return result.scalars().all()


@router.post("/outlines", response_model=OutlineResponse)
async def create_outline(outline: OutlineCreate, db: AsyncSession = Depends(get_db)):
    """Create a new outline."""
    db_outline = Outline(**outline.model_dump())
    db.add(db_outline)
    await db.flush()
    await db.refresh(db_outline)
    return db_outline


@router.get("/outlines/{outline_id}", response_model=OutlineResponse)
async def get_outline(outline_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific outline."""
    result = await db.execute(select(Outline).where(Outline.id == outline_id))
    outline = result.scalar_one_or_none()
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")
    return outline


@router.patch("/outlines/{outline_id}", response_model=OutlineResponse)
async def update_outline(
    outline_id: int,
    outline: OutlineUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an outline."""
    result = await db.execute(select(Outline).where(Outline.id == outline_id))
    db_outline = result.scalar_one_or_none()
    if not db_outline:
        raise HTTPException(status_code=404, detail="Outline not found")

    update_data = outline.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_outline, key, value)

    await db.flush()
    await db.refresh(db_outline)
    return db_outline


@router.delete("/outlines/{outline_id}")
async def delete_outline(outline_id: int, db: AsyncSession = Depends(get_db)):
    """Delete an outline."""
    result = await db.execute(select(Outline).where(Outline.id == outline_id))
    outline = result.scalar_one_or_none()
    if not outline:
        raise HTTPException(status_code=404, detail="Outline not found")
    await db.delete(outline)
    return {"message": "Outline deleted"}


# Chapter endpoints
@router.get("/", response_model=List[ChapterResponse])
async def list_chapters(
    skip: int = 0,
    limit: int = 100,
    outline_id: Optional[int] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all chapters with optional filtering."""
    query = select(Chapter)
    if outline_id is not None:
        query = query.where(Chapter.outline_id == outline_id)
    if status:
        query = query.where(Chapter.status == status)

    result = await db.execute(
        query.order_by(Chapter.chapter_order.asc()).offset(skip).limit(limit)
    )
    return result.scalars().all()


@router.post("/", response_model=ChapterResponse)
async def create_chapter(chapter: ChapterCreate, db: AsyncSession = Depends(get_db)):
    """Create a new chapter."""
    db_chapter = Chapter(**chapter.model_dump())
    db.add(db_chapter)
    await db.flush()
    await db.refresh(db_chapter)
    return db_chapter


@router.get("/{chapter_id}", response_model=ChapterResponse)
async def get_chapter(chapter_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific chapter."""
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    return chapter


@router.patch("/{chapter_id}", response_model=ChapterResponse)
async def update_chapter(
    chapter_id: int,
    chapter: ChapterUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a chapter."""
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    db_chapter = result.scalar_one_or_none()
    if not db_chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")

    update_data = chapter.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_chapter, key, value)

    db_chapter.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(db_chapter)
    return db_chapter


@router.delete("/{chapter_id}")
async def delete_chapter(chapter_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a chapter."""
    result = await db.execute(select(Chapter).where(Chapter.id == chapter_id))
    chapter = result.scalar_one_or_none()
    if not chapter:
        raise HTTPException(status_code=404, detail="Chapter not found")
    await db.delete(chapter)
    return {"message": "Chapter deleted"}


# Draft versions
@router.get("/{chapter_id}/drafts", response_model=List[DraftVersionResponse])
async def list_draft_versions(
    chapter_id: int,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """List all draft versions for a chapter."""
    result = await db.execute(
        select(DraftVersion)
        .where(DraftVersion.chapter_id == chapter_id)
        .order_by(DraftVersion.version_number.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


@router.post("/{chapter_id}/drafts", response_model=DraftVersionResponse)
async def create_draft_version(
    chapter_id: int,
    draft: DraftVersionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new draft version for a chapter."""
    if draft.chapter_id != chapter_id:
        raise HTTPException(status_code=400, detail="Chapter ID mismatch")

    db_draft = DraftVersion(**draft.model_dump())
    db.add(db_draft)
    await db.flush()
    await db.refresh(db_draft)
    return db_draft


@router.get("/{chapter_id}/drafts/{version_number}", response_model=DraftVersionResponse)
async def get_draft_version(
    chapter_id: int,
    version_number: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a specific draft version."""
    result = await db.execute(
        select(DraftVersion)
        .where(DraftVersion.chapter_id == chapter_id)
        .where(DraftVersion.version_number == version_number)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft version not found")
    return draft


# AI Inspection results
@router.get("/{chapter_id}/inspections", response_model=List[AIInspectionResultResponse])
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
    return db_inspection


# IF Lines
@router.get("/if-lines", response_model=List[IFLineResponse])
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
async def create_if_line(if_line: IFLineCreate, db: AsyncSession = Depends(get_db)):
    """Create a new IF line."""
    db_if_line = IFLine(**if_line.model_dump())
    db.add(db_if_line)
    await db.flush()
    await db.refresh(db_if_line)
    return db_if_line


@router.get("/if-lines/{if_line_id}", response_model=IFLineResponse)
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
    if_line: IFLineUpdate,
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
    return db_if_line


@router.delete("/if-lines/{if_line_id}")
async def delete_if_line(if_line_id: int, db: AsyncSession = Depends(get_db)):
    """Delete an IF line."""
    result = await db.execute(select(IFLine).where(IFLine.id == if_line_id))
    if_line = result.scalar_one_or_none()
    if not if_line:
        raise HTTPException(status_code=404, detail="IF line not found")
    await db.delete(if_line)
    return {"message": "IF line deleted"}


# Plot Threads
@router.get("/plot-threads", response_model=List[PlotThreadResponse])
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
    plot_thread: PlotThreadCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new plot thread."""
    db_plot_thread = PlotThread(**plot_thread.model_dump())
    db.add(db_plot_thread)
    await db.flush()
    await db.refresh(db_plot_thread)
    return db_plot_thread


@router.get("/plot-threads/{plot_thread_id}", response_model=PlotThreadResponse)
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
    plot_thread: PlotThreadUpdate,
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
    return db_plot_thread


@router.delete("/plot-threads/{plot_thread_id}")
async def delete_plot_thread(plot_thread_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a plot thread."""
    result = await db.execute(select(PlotThread).where(PlotThread.id == plot_thread_id))
    plot_thread = result.scalar_one_or_none()
    if not plot_thread:
        raise HTTPException(status_code=404, detail="Plot thread not found")
    await db.delete(plot_thread)
    return {"message": "Plot thread deleted"}
