# Auto Novel Writer - Character Settings Routes

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.core.services.character.character_service import CharacterService
from backend.api.v1.dependencies import get_event_bus
from backend.core.domain.schemas.request_schemas import (
    CharacterCreateRequest,
    CharacterUpdateRequest,
    CharacterRelationshipCreateRequest,
    CharacterStorylineCreateRequest,
)
from backend.core.domain.schemas.response_schemas import (
    CharacterResponse,
    CharacterRelationshipResponse,
    CharacterStorylineResponse,
)
from backend.core.domain.schemas.common_schemas import MessageResponse

router = APIRouter()


def get_character_service(db: AsyncSession = Depends(get_db)) -> CharacterService:
    """Dependency to inject CharacterService with event bus and cache."""
    return CharacterService(db, get_event_bus(), get_cache_service())


# ---------------------------------------------------------------------------
# Character CRUD
# ---------------------------------------------------------------------------

@router.get(
    "/characters",
    response_model=List[CharacterResponse],
    summary="列出所有角色",
    description="获取所有角色的列表，支持按等级过滤。",
)
async def list_characters(
    skip: int = 0,
    limit: int = 100,
    tier: Optional[str] = None,
    service: CharacterService = Depends(get_character_service)
):
    """List all characters with optional filtering."""
    return await service.list_characters(skip=skip, limit=limit, tier=tier)


@router.post(
    "/characters",
    response_model=CharacterResponse,
    summary="创建角色",
    description="创建新的角色设定。",
)
async def create_character(
    character: CharacterCreateRequest,
    service: CharacterService = Depends(get_character_service)
):
    """Create a new character."""
    return await service.create_character(character.model_dump())


@router.get(
    "/characters/{character_id}",
    response_model=CharacterResponse,
    summary="获取角色详情",
    description="获取指定ID的角色详细信息。",
)
async def get_character(
    character_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """Get a specific character."""
    character = await service.get_character(character_id)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


@router.patch(
    "/characters/{character_id}",
    response_model=CharacterResponse,
    summary="更新角色",
    description="更新指定ID的角色信息。",
)
async def update_character(
    character_id: int,
    character: CharacterUpdateRequest,
    service: CharacterService = Depends(get_character_service)
):
    """Update a character."""
    db_character = await service.update_character(
        character_id, character.model_dump(exclude_unset=True)
    )
    if not db_character:
        raise HTTPException(status_code=404, detail="Character not found")
    return db_character


@router.delete(
    "/characters/{character_id}",
    response_model=MessageResponse,
    summary="删除角色",
    description="删除指定ID的角色。",
)
async def delete_character(
    character_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """Delete a character."""
    deleted = await service.delete_character(character_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Character not found")
    return {"message": "Character deleted"}


# ---------------------------------------------------------------------------
# Character Relationships
# ---------------------------------------------------------------------------

@router.get(
    "/characters/{character_id}/relationships",
    response_model=List[CharacterRelationshipResponse],
    summary="列出角色关系",
    description="获取指定角色的所有关系列表。",
)
async def list_character_relationships(
    character_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """List all relationships for a character."""
    return await service.get_relationships(character_id)


@router.post(
    "/characters/{character_id}/relationships",
    response_model=CharacterRelationshipResponse,
    summary="创建角色关系",
    description="为指定角色创建新的关系。",
)
async def create_character_relationship(
    character_id: int,
    relationship: CharacterRelationshipCreateRequest,
    service: CharacterService = Depends(get_character_service)
):
    """Create a relationship for a character."""
    return await service.create_relationship(relationship.model_dump())


@router.delete(
    "/characters/{character_id}/relationships/{relationship_id}",
    response_model=MessageResponse,
    summary="删除角色关系",
    description="删除指定角色关系。",
)
async def delete_character_relationship(
    character_id: int,
    relationship_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """Delete a character relationship."""
    deleted = await service.delete_relationship(character_id, relationship_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Relationship not found")
    return {"message": "Relationship deleted"}


# ---------------------------------------------------------------------------
# Character Storylines
# ---------------------------------------------------------------------------

@router.get(
    "/characters/{character_id}/storylines",
    response_model=List[CharacterStorylineResponse],
    summary="列出角色故事线",
    description="获取指定角色的所有故事线列表。",
)
async def list_character_storylines(
    character_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """List all storylines for a character."""
    return await service.get_storylines(character_id)


@router.post(
    "/characters/{character_id}/storylines",
    response_model=CharacterStorylineResponse,
    summary="创建角色故事线",
    description="为指定角色创建新的故事线。",
)
async def create_character_storyline(
    character_id: int,
    storyline: CharacterStorylineCreateRequest,
    service: CharacterService = Depends(get_character_service)
):
    """Create a storyline for a character."""
    return await service.create_storyline(storyline.model_dump())


@router.patch(
    "/characters/{character_id}/storylines/{storyline_id}",
    response_model=CharacterStorylineResponse,
    summary="更新角色故事线",
    description="更新指定角色故事线。",
)
async def update_character_storyline(
    character_id: int,
    storyline_id: int,
    storyline: CharacterStorylineCreateRequest,
    service: CharacterService = Depends(get_character_service)
):
    """Update a character storyline."""
    updated = await service.update_storyline(character_id, storyline_id, storyline.model_dump(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="Storyline not found")
    return updated


@router.delete(
    "/characters/{character_id}/storylines/{storyline_id}",
    response_model=MessageResponse,
    summary="删除角色故事线",
    description="删除指定角色故事线。",
)
async def delete_character_storyline(
    character_id: int,
    storyline_id: int,
    service: CharacterService = Depends(get_character_service)
):
    """Delete a character storyline."""
    deleted = await service.delete_storyline(character_id, storyline_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Storyline not found")
    return {"message": "Storyline deleted"}
