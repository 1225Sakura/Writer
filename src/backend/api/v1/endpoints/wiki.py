# Auto Novel Writer - Wiki API Endpoints
# Layer 3: LLM Wiki - REST API for wiki page operations

import logging
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database import get_db
from backend.middleware.auth import require_auth
from backend.services.wiki_service import WikiService, WikiPage, WikiVersion, WikiEntityLink
from backend.api.v1.exceptions import NotFoundException, ValidationException
from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/wiki", tags=["wiki"], dependencies=[require_auth])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class WikiPageBase(BaseModel):
    """Base wiki page schema."""
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(default="")
    entity_type: Optional[str] = Field(default=None, max_length=50)
    entity_id: Optional[int] = Field(default=None, ge=1)
    is_draft: bool = Field(default=False)


class WikiPageCreateRequest(WikiPageBase):
    """Request to create a wiki page."""
    project_id: Optional[int] = Field(default=None, ge=1)


class WikiPageUpdateRequest(BaseModel):
    """Request to update a wiki page."""
    title: Optional[str] = Field(default=None, min_length=1, max_length=255)
    content: Optional[str] = Field(default=None)
    entity_type: Optional[str] = Field(default=None, max_length=50)
    entity_id: Optional[int] = Field(default=None, ge=1)
    is_draft: Optional[bool] = Field(default=None)
    change_summary: Optional[str] = Field(default=None, max_length=500)


class WikiPageResponse(BaseModel):
    """Wiki page response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    project_id: Optional[int]
    entity_type: Optional[str]
    entity_id: Optional[int]
    title: str
    content: str
    version: int
    is_draft: bool
    created_at: datetime
    updated_at: datetime


class WikiPageDetailResponse(WikiPageResponse):
    """Wiki page response with versions and links."""
    versions: List["WikiVersionResponse"] = []
    entity_links: List["WikiEntityLinkResponse"] = []


class WikiVersionResponse(BaseModel):
    """Wiki version response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    page_id: int
    version: int
    content: str
    change_summary: Optional[str]
    created_at: datetime


class WikiEntityLinkCreateRequest(BaseModel):
    """Request to create an entity link."""
    linked_entity_type: str = Field(..., max_length=50)
    linked_entity_id: int = Field(..., ge=1)
    link_type: str = Field(default="references", max_length=50)


class WikiEntityLinkResponse(BaseModel):
    """Entity link response."""
    model_config = ConfigDict(from_attributes=True)

    id: int
    wiki_page_id: int
    linked_entity_type: str
    linked_entity_id: int
    link_type: str


class WikiSearchResponse(BaseModel):
    """Wiki search result response."""
    id: int
    project_id: Optional[int]
    entity_type: Optional[str]
    entity_id: Optional[int]
    title: str
    content: str
    version: int
    is_draft: bool
    created_at: datetime
    updated_at: datetime
    rank: float = 0


class EntityLinkAddRequest(WikiEntityLinkCreateRequest):
    """Request to add an entity link to a wiki page."""
    pass


# ============================================================================
# Dependency
# ============================================================================

def get_wiki_service(db: AsyncSession = Depends(get_db)) -> WikiService:
    """Dependency to inject WikiService."""
    return WikiService(db)


# ============================================================================
# Wiki Page Endpoints
# ============================================================================

@router.get(
    "/pages",
    response_model=List[WikiPageResponse],
    summary="列出维基页面",
    description="获取所有维基页面列表，支持分页和过滤。",
)
async def list_wiki_pages(
    project_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=100),
    include_drafts: bool = Query(default=False),
    service: WikiService = Depends(get_wiki_service),
):
    """List all wiki pages with optional filtering."""
    pages = await service.list_pages(
        project_id=project_id,
        entity_type=entity_type,
        skip=skip,
        limit=limit,
        include_drafts=include_drafts,
    )
    return pages


@router.post(
    "/pages",
    response_model=WikiPageResponse,
    status_code=201,
    summary="创建维基页面",
    description="创建新的维基页面。",
)
async def create_wiki_page(
    request: WikiPageCreateRequest,
    service: WikiService = Depends(get_wiki_service),
):
    """Create a new wiki page."""
    page = await service.create_page(
        project_id=request.project_id,
        title=request.title,
        content=request.content,
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        is_draft=request.is_draft,
    )
    return page


@router.get(
    "/pages/{page_id}",
    response_model=WikiPageDetailResponse,
    summary="获取维基页面",
    description="获取指定ID的维基页面详细信息。",
)
async def get_wiki_page(
    page_id: int,
    service: WikiService = Depends(get_wiki_service),
):
    """Get a specific wiki page."""
    page = await service.get_page(page_id)
    if not page:
        raise NotFoundException(code="WIKI_PAGE_NOT_FOUND", message=f"Wiki page not found (id={page_id})")
    return page


@router.put(
    "/pages/{page_id}",
    response_model=WikiPageResponse,
    summary="更新维基页面",
    description="更新指定ID的维基页面内容。",
)
async def update_wiki_page(
    page_id: int,
    request: WikiPageUpdateRequest,
    service: WikiService = Depends(get_wiki_service),
):
    """Update a wiki page."""
    page = await service.update_page(
        page_id=page_id,
        title=request.title,
        content=request.content,
        entity_type=request.entity_type,
        entity_id=request.entity_id,
        is_draft=request.is_draft,
        change_summary=request.change_summary,
    )
    if not page:
        raise NotFoundException(code="WIKI_PAGE_NOT_FOUND", message=f"Wiki page not found (id={page_id})")
    return page


@router.delete(
    "/pages/{page_id}",
    status_code=204,
    summary="删除维基页面",
    description="删除指定ID的维基页面及其版本历史。",
)
async def delete_wiki_page(
    page_id: int,
    service: WikiService = Depends(get_wiki_service),
):
    """Delete a wiki page."""
    deleted = await service.delete_page(page_id)
    if not deleted:
        raise NotFoundException(code="WIKI_PAGE_NOT_FOUND", message=f"Wiki page not found (id={page_id})")


# ============================================================================
# Version History Endpoints
# ============================================================================

@router.get(
    "/pages/{page_id}/versions",
    response_model=List[WikiVersionResponse],
    summary="获取版本历史",
    description="获取指定维基页面的所有版本历史。",
)
async def get_wiki_page_versions(
    page_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=50),
    service: WikiService = Depends(get_wiki_service),
):
    """Get version history for a wiki page."""
    # Verify page exists
    page = await service.get_page(page_id)
    if not page:
        raise NotFoundException(code="WIKI_PAGE_NOT_FOUND", message=f"Wiki page not found (id={page_id})")

    versions = await service.get_versions(page_id, skip=skip, limit=limit)
    return versions


@router.post(
    "/pages/{page_id}/revert/{version}",
    response_model=WikiPageResponse,
    summary="恢复到指定版本",
    description="将维基页面恢复到指定的历史版本。",
)
async def revert_wiki_page(
    page_id: int,
    version: int,
    service: WikiService = Depends(get_wiki_service),
):
    """Revert wiki page to a specific version."""
    page = await service.revert_to_version(page_id, version)
    if not page:
        raise NotFoundException(
            code="VERSION_NOT_FOUND",
            message=f"Version {version} not found for wiki page (id={page_id})"
        )
    return page


# ============================================================================
# Entity Link Endpoints
# ============================================================================

@router.get(
    "/pages/{page_id}/links",
    response_model=List[WikiEntityLinkResponse],
    summary="获取页面关联",
    description="获取指定维基页面的所有实体关联。",
)
async def get_wiki_page_links(
    page_id: int,
    service: WikiService = Depends(get_wiki_service),
):
    """Get entity links for a wiki page."""
    page = await service.get_page(page_id)
    if not page:
        raise NotFoundException(code="WIKI_PAGE_NOT_FOUND", message=f"Wiki page not found (id={page_id})")
    return page.entity_links


@router.post(
    "/pages/{page_id}/links",
    response_model=WikiEntityLinkResponse,
    status_code=201,
    summary="添加实体关联",
    description="为维基页面添加新的实体关联。",
)
async def add_wiki_page_link(
    page_id: int,
    request: EntityLinkAddRequest,
    service: WikiService = Depends(get_wiki_service),
):
    """Add an entity link to a wiki page."""
    valid_link_types = {"documents", "references", "extends"}
    if request.link_type not in valid_link_types:
        raise ValidationException(
            code="INVALID_LINK_TYPE",
            message=f"link_type must be one of: {', '.join(sorted(valid_link_types))}"
        )

    link = await service.add_entity_link(
        wiki_page_id=page_id,
        linked_entity_type=request.linked_entity_type,
        linked_entity_id=request.linked_entity_id,
        link_type=request.link_type,
    )
    if not link:
        raise NotFoundException(code="WIKI_PAGE_NOT_FOUND", message=f"Wiki page not found (id={page_id})")
    return link


@router.delete(
    "/links/{link_id}",
    status_code=204,
    summary="删除实体关联",
    description="删除指定的实体关联。",
)
async def remove_wiki_page_link(
    link_id: int,
    service: WikiService = Depends(get_wiki_service),
):
    """Remove an entity link."""
    removed = await service.remove_entity_link(link_id)
    if not removed:
        raise NotFoundException(code="ENTITY_LINK_NOT_FOUND", message=f"Entity link not found (id={link_id})")


@router.get(
    "/entities/{entity_type}/{entity_id}/pages",
    response_model=List[WikiPageResponse],
    summary="获取实体关联页面",
    description="获取关联到指定实体的所有维基页面。",
)
async def get_pages_by_entity(
    entity_type: str,
    entity_id: int,
    service: WikiService = Depends(get_wiki_service),
):
    """Get all wiki pages linked to a specific entity."""
    pages = await service.get_pages_by_entity(entity_type, entity_id)
    return pages


# ============================================================================
# Search Endpoint
# ============================================================================

@router.get(
    "/search",
    response_model=List[WikiSearchResponse],
    summary="搜索维基页面",
    description="使用全文搜索查找维基页面。",
)
async def search_wiki_pages(
    q: str = Query(..., min_length=1, max_length=200),
    project_id: Optional[int] = None,
    entity_type: Optional[str] = None,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=20, ge=1, le=50),
    service: WikiService = Depends(get_wiki_service),
):
    """Search wiki pages using full-text search."""
    results = await service.search_pages(
        query=q,
        project_id=project_id,
        entity_type=entity_type,
        skip=skip,
        limit=limit,
    )
    return results


# ============================================================================
# FTS Index Management
# ============================================================================

@router.post(
    "/fts/rebuild",
    summary="重建全文索引",
    description="重建FTS5全文搜索索引。",
)
async def rebuild_fts_index(
    service: WikiService = Depends(get_wiki_service),
):
    """Rebuild the FTS index."""
    count = await service.rebuild_fts_index()
    return {"message": f"FTS index rebuilt with {count} pages", "pages_indexed": count}
