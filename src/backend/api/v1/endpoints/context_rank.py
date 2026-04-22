"""Context Ranking API Routes.

Provides endpoints for:
- Ranking retrieved context chunks by relevance
- Managing dynamic weights for context types
- Routing queries to appropriate retrieval strategies
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Query
from pydantic import BaseModel, Field

from backend.middleware.auth import require_auth
from backend.services.context_ranker import ContextRanker, ContextRankerConfig, context_ranker
from backend.services.context_weights import ContextWeights, context_weights
from backend.services.query_router import QueryRouter, query_router

router = APIRouter(prefix="/context-rank", tags=["context-rank"])


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class RankRequest(BaseModel):
    pack: Dict[str, Any] = Field(default_factory=dict, description="Context pack to rank")
    chapter: int = Field(default=1, ge=1, description="Current chapter number")
    debug: bool = Field(default=False, description="Include debug scores in output")


class RankResponse(BaseModel):
    ranked_pack: Dict[str, Any]
    meta: Dict[str, Any]


class WeightsUpdateRequest(BaseModel):
    entity_weights: Optional[Dict[str, float]] = Field(default=None)
    template_weights: Optional[Dict[str, Dict[str, float]]] = Field(default=None)
    dynamic_weights: Optional[Dict[str, Dict[str, Dict[str, float]]]] = Field(default=None)


class WeightsResponse(BaseModel):
    entity_weights: Dict[str, float]
    template_weights: Dict[str, Dict[str, float]]
    dynamic_weights: Dict[str, Dict[str, Dict[str, float]]]


class RouteRequest(BaseModel):
    query: str = Field(..., min_length=1, description="User query to route")


class RouteResponse(BaseModel):
    intent: str
    entities: List[str]
    time_scope: Dict[str, Any]
    needs_graph: bool
    subqueries: List[Dict[str, Any]]
    raw_query: str


class EntityWeightRequest(BaseModel):
    entity_type: str
    weight: float = Field(..., ge=0.0, le=2.0)


class TemplateWeightRequest(BaseModel):
    template: str
    weights: Dict[str, float]


class ResolveWeightsRequest(BaseModel):
    template: Optional[str] = Field(default=None)
    stage: Optional[str] = Field(default=None)
    entity_type: Optional[str] = Field(default=None)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/rank", response_model=RankResponse, dependencies=[require_auth])
async def rank_context_pack(
    request: RankRequest = Body(...),
) -> Dict[str, Any]:
    """Rank a context pack by relevance to the current chapter.

    Re-orders sections within the pack using recency, frequency,
    and hook-bonus heuristics.
    """
    config = ContextRankerConfig(debug=request.debug)
    ranker = ContextRanker(config=config)
    ranked = ranker.rank_pack(request.pack, request.chapter)
    return {
        "ranked_pack": ranked,
        "meta": {
            "chapter": request.chapter,
            "debug": request.debug,
            "version": "v2",
        },
    }


@router.get("/weights", response_model=WeightsResponse, dependencies=[require_auth])
async def get_all_weights() -> Dict[str, Any]:
    """Get all current context weights (entity, template, dynamic)."""
    return context_weights.to_dict()


@router.post("/weights", response_model=WeightsResponse, dependencies=[require_auth])
async def update_weights(
    request: WeightsUpdateRequest = Body(...),
) -> Dict[str, Any]:
    """Update context weights.

    Only provided weight categories are updated; omitted ones remain unchanged.
    """
    if request.entity_weights is not None:
        for etype, w in request.entity_weights.items():
            context_weights.set_entity_weight(etype, w)

    if request.template_weights is not None:
        for tpl, w in request.template_weights.items():
            context_weights.set_template_weight(tpl, w)

    if request.dynamic_weights is not None:
        for stage, templates in request.dynamic_weights.items():
            for tpl, w in templates.items():
                context_weights.set_dynamic_weights(stage, tpl, w)

    return context_weights.to_dict()


@router.post("/weights/entity", dependencies=[require_auth])
async def set_entity_weight(
    request: EntityWeightRequest = Body(...),
) -> Dict[str, Any]:
    """Set weight for a single entity type."""
    context_weights.set_entity_weight(request.entity_type, request.weight)
    return {
        "entity_type": request.entity_type,
        "weight": context_weights.get_entity_weight(request.entity_type),
    }


@router.post("/weights/template", dependencies=[require_auth])
async def set_template_weight(
    request: TemplateWeightRequest = Body(...),
) -> Dict[str, Any]:
    """Set weights for a named template (core/scene/global)."""
    context_weights.set_template_weight(request.template, request.weights)
    return {
        "template": request.template,
        "weights": context_weights.get_template_weight(request.template),
    }


@router.post("/weights/resolve", dependencies=[require_auth])
async def resolve_weights(
    request: ResolveWeightsRequest = Body(...),
) -> Dict[str, Any]:
    """Resolve composite weights for a given context."""
    return context_weights.resolve_weights(
        template=request.template,
        stage=request.stage,
        entity_type=request.entity_type,
    )


@router.post("/weights/reset", dependencies=[require_auth])
async def reset_all_weights() -> Dict[str, Any]:
    """Reset all weights to system defaults."""
    context_weights.reset_entity_weights()
    context_weights.reset_template_weights()
    context_weights.reset_dynamic_weights()
    return {"reset": True, **context_weights.to_dict()}


@router.post("/route", response_model=RouteResponse, dependencies=[require_auth])
async def route_query(
    request: RouteRequest = Body(...),
) -> Dict[str, Any]:
    """Route a query to appropriate retrieval strategies.

    Detects intent, extracts entities/time scope, and returns a subquery plan.
    """
    intent_payload = query_router.route_intent(request.query)
    subqueries = query_router.plan_subqueries(intent_payload)
    return {
        "intent": intent_payload["intent"],
        "entities": intent_payload["entities"],
        "time_scope": intent_payload["time_scope"],
        "needs_graph": intent_payload["needs_graph"],
        "subqueries": subqueries,
        "raw_query": intent_payload["raw_query"],
    }


@router.post("/route/intent", dependencies=[require_auth])
async def detect_intent(
    query: str = Body(..., embed=True),
) -> Dict[str, Any]:
    """Detect intent for a raw query string."""
    return query_router.route_intent(query)


@router.post("/rank/items", dependencies=[require_auth])
async def rank_generic_items(
    items: List[Dict[str, Any]] = Body(...),
    current_chapter: int = Query(default=1, ge=1),
    chapter_key: str = Query(default="chapter"),
    text_key: str = Query(default="content"),
    debug: bool = Query(default=False),
) -> Dict[str, Any]:
    """Rank a generic list of context items.

    Useful for ranking arbitrary retrieved chunks before assembly.
    """
    config = ContextRankerConfig(debug=debug)
    ranker = ContextRanker(config=config)
    ranked = ranker.rank_generic_items(
        items, current_chapter, chapter_key=chapter_key, text_key=text_key
    )
    return {
        "items": ranked,
        "count": len(ranked),
        "chapter": current_chapter,
    }
