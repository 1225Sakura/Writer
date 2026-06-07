# Auto Novel Writer - Entity Relation Settings Routes
# CRUD endpoints for cross-entity graph relationships (graph_relationships table)

from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional

from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.core.domain.extensions import GraphRelationship
from backend.core.domain.schemas.request_schemas import (
    EntityRelationCreateRequest,
    EntityRelationUpdateRequest,
)
from backend.core.domain.schemas.response_schemas import EntityRelationResponse
from backend.core.domain.schemas.common_schemas import MessageResponse

router = APIRouter()


# ---------------------------------------------------------------------------
# Entity Relation CRUD
# ---------------------------------------------------------------------------

@router.get(
    "/relations",
    response_model=List[EntityRelationResponse],
    summary="列出所有关系",
    description="获取所有跨实体关系，支持按源/目标实体过滤。",
)
async def list_relations(
    source_type: Optional[str] = Query(None, description="Filter by source entity type"),
    source_id: Optional[int] = Query(None, description="Filter by source entity ID"),
    target_type: Optional[str] = Query(None, description="Filter by target entity type"),
    target_id: Optional[int] = Query(None, description="Filter by target entity ID"),
    skip: int = 0,
    limit: int = 500,
    db: AsyncSession = Depends(get_db),
):
    """List all entity relations with optional filtering."""
    stmt = select(GraphRelationship)
    filters = []
    if source_type is not None:
        filters.append(GraphRelationship.source_type == source_type)
    if source_id is not None:
        filters.append(GraphRelationship.source_id == source_id)
    if target_type is not None:
        filters.append(GraphRelationship.target_type == target_type)
    if target_id is not None:
        filters.append(GraphRelationship.target_id == target_id)
    if filters:
        stmt = stmt.where(and_(*filters))
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get(
    "/relations/{relation_id}",
    response_model=EntityRelationResponse,
    summary="获取关系详情",
    description="获取指定ID的关系详细信息。",
)
async def get_relation(
    relation_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Get a specific relation by ID."""
    stmt = select(GraphRelationship).where(GraphRelationship.id == relation_id)
    result = await db.execute(stmt)
    relation = result.scalar_one_or_none()
    if not relation:
        raise HTTPException(status_code=404, detail="Relation not found")
    return relation


@router.post(
    "/relations",
    response_model=EntityRelationResponse,
    summary="创建关系",
    description="创建新的跨实体关系。",
)
async def create_relation(
    request: EntityRelationCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create a new entity relation."""
    relation = GraphRelationship(
        source_type=request.source_type,
        source_id=request.source_id,
        target_type=request.target_type,
        target_id=request.target_id,
        relation_type=request.relation_type,
        label=request.label,
        description=request.description,
        properties_json=request.properties_json,
        directed=request.directed,
        weight=request.weight,
    )
    db.add(relation)
    await db.commit()
    await db.refresh(relation)
    return relation


@router.patch(
    "/relations/{relation_id}",
    response_model=EntityRelationResponse,
    summary="更新关系",
    description="更新指定ID的关系信息。",
)
async def update_relation(
    relation_id: int,
    request: EntityRelationUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update an entity relation."""
    stmt = select(GraphRelationship).where(GraphRelationship.id == relation_id)
    result = await db.execute(stmt)
    relation = result.scalar_one_or_none()
    if not relation:
        raise HTTPException(status_code=404, detail="Relation not found")

    update_data = request.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(relation, field, value)

    await db.commit()
    await db.refresh(relation)
    return relation


@router.delete(
    "/relations/{relation_id}",
    response_model=MessageResponse,
    summary="删除关系",
    description="删除指定ID的关系。",
)
async def delete_relation(
    relation_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete an entity relation."""
    stmt = select(GraphRelationship).where(GraphRelationship.id == relation_id)
    result = await db.execute(stmt)
    relation = result.scalar_one_or_none()
    if not relation:
        raise HTTPException(status_code=404, detail="Relation not found")

    await db.delete(relation)
    await db.commit()
    return {"message": "Relation deleted"}
