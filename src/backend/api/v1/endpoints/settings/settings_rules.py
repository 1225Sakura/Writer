# Auto Novel Writer - Rule Settings Routes

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.infrastructure.cache.cache_service import get_cache_service
from backend.api.v1.dependencies import get_event_bus
from backend.core.domain.schemas.request_schemas import (
    RuleCreateRequest,
    RuleUpdateRequest,
)
from backend.core.domain.schemas.response_schemas import RuleResponse
from backend.core.domain.schemas.common_schemas import MessageResponse
from backend.core.services.rule.rule_service import RuleService
from backend.api.v1.endpoints.settings import (
    _prepare_create_data,
    _prepare_update_data,
    _attach_tags_to_response,
)

router = APIRouter()


def get_rule_service(db: AsyncSession = Depends(get_db)) -> RuleService:
    """Dependency to inject RuleService."""
    return RuleService(db, get_event_bus(), get_cache_service())


@router.get(
    "/rules",
    response_model=List[RuleResponse],
    summary="列出所有规则",
    description="获取所有规则的列表，支持按类型过滤。",
)
async def list_rules(
    skip: int = 0,
    limit: int = 100,
    type: Optional[str] = None,
    service: RuleService = Depends(get_rule_service)
):
    """List all rules."""
    if type:
        rules = await service.list_rules(skip=skip, limit=limit, type=type)
    else:
        rules = await service.list_rules(skip=skip, limit=limit)
    for rule in rules:
        _attach_tags_to_response(rule)
    return rules


@router.post(
    "/rules",
    response_model=RuleResponse,
    summary="创建规则",
    description="创建新的规则设定。",
)
async def create_rule(
    rule: RuleCreateRequest,
    service: RuleService = Depends(get_rule_service)
):
    """Create a new rule."""
    data = _prepare_create_data(rule)
    db_rule = await service.create_rule(data)
    _attach_tags_to_response(db_rule)
    get_cache_service().clear_entity_cache("rule")
    return db_rule


@router.get(
    "/rules/{rule_id}",
    response_model=RuleResponse,
    summary="获取规则详情",
    description="获取指定ID的规则详细信息。",
)
async def get_rule(
    rule_id: int,
    service: RuleService = Depends(get_rule_service)
):
    """Get a specific rule by ID."""
    rule = await service.get_rule(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    _attach_tags_to_response(rule)
    return rule


@router.patch(
    "/rules/{rule_id}",
    response_model=RuleResponse,
    summary="更新规则",
    description="更新指定ID的规则信息。",
)
async def update_rule(
    rule_id: int,
    rule: RuleUpdateRequest,
    service: RuleService = Depends(get_rule_service)
):
    """Update a rule."""
    db_rule = await service.update_rule(rule_id, _prepare_update_data(rule))
    if not db_rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    _attach_tags_to_response(db_rule)
    get_cache_service().clear_entity_cache("rule")
    return db_rule


@router.delete(
    "/rules/{rule_id}",
    response_model=MessageResponse,
    summary="删除规则",
    description="删除指定ID的规则。",
)
async def delete_rule(
    rule_id: int,
    service: RuleService = Depends(get_rule_service)
):
    """Delete a rule."""
    deleted = await service.delete_rule(rule_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Rule not found")
    get_cache_service().clear_entity_cache("rule")
    return {"message": "Rule deleted"}
