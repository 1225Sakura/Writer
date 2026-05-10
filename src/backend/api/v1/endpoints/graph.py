"""Graph Routes - API endpoints for entity relationship graph and disambiguation.

Provides endpoints for:
- Entity graph visualization data
- Relationship queries (single-hop and multi-hop)
- Entity linking/disambiguation
- Ambiguous entity resolution
"""

from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from backend.infrastructure.database import get_db
from backend.middleware.auth import require_auth
from backend.services.entity_linker import EntityLinker, DisambiguationResult
from backend.services.graph_service import GraphService

router = APIRouter(prefix="/graph", tags=["graph"])


# ------------------------------------------------------------------
# Request/Response Models
# ------------------------------------------------------------------

class EntityNode(BaseModel):
    """Graph node representation."""
    id: int
    type: str
    label: str
    properties: dict[str, Any] = Field(default_factory=dict)
    color: Optional[str] = None
    size: int = 1


class EntityEdge(BaseModel):
    """Graph edge representation."""
    source: int
    target: int
    label: str
    type: str
    properties: dict[str, Any] = Field(default_factory=dict)
    directed: bool = True


class GraphVisualizationResponse(BaseModel):
    """Response for graph visualization data."""
    project_id: Optional[int] = None
    nodes: list[EntityNode]
    edges: list[EntityEdge]
    node_count: int
    edge_count: int


class RelationshipQueryResponse(BaseModel):
    """Response for relationship queries."""
    entity_id: int
    entity_type: str
    relationships: list[dict[str, Any]]
    total: int


class LinkEntitiesRequest(BaseModel):
    """Request to link/register entity aliases."""
    entity_id: int
    entity_type: str = Field(..., description="Entity type: character, item, location, faction")
    aliases: list[str] = Field(..., description="List of aliases to register")


class LinkEntitiesResponse(BaseModel):
    """Response from alias registration."""
    entity_id: int
    entity_type: str
    registered_aliases: list[str]
    failed: list[str]


class ResolveAmbiguousRequest(BaseModel):
    """Request to resolve ambiguous entity mentions."""
    mentions: list[dict[str, Any]] = Field(
        ...,
        description="List of mentions to resolve, each with 'mention' and optional 'context'"
    )
    project_id: Optional[int] = None


class AmbiguityCandidate(BaseModel):
    """Single candidate for an ambiguous mention."""
    id: int
    type: str
    name: str
    confidence: float
    match_type: str


class ResolvedMention(BaseModel):
    """Resolution result for a single mention."""
    mention: str
    entity_id: Optional[int]
    entity_type: str
    confidence: float
    candidates: list[AmbiguityCandidate]
    adopted: bool
    warning: Optional[str] = None


class ResolveAmbiguousResponse(BaseModel):
    """Response from ambiguous entity resolution."""
    results: list[ResolvedMention]
    warnings: list[str]
    auto_resolved: int
    needs_review: int


class MultiHopQueryRequest(BaseModel):
    """Request for multi-hop path query."""
    start_entity_id: int
    start_entity_type: str
    end_entity_id: Optional[int] = None
    end_entity_type: Optional[str] = None
    max_hops: int = Field(3, ge=1, le=5)
    relation_types: Optional[list[str]] = None


class PathEdge(BaseModel):
    source: int
    target: int
    label: str
    type: str


class PathNode(BaseModel):
    id: int
    type: str
    label: str


class PathResult(BaseModel):
    nodes: list[PathNode]
    edges: list[PathEdge]
    hops: int


class MultiHopQueryResponse(BaseModel):
    """Response for multi-hop query."""
    start_entity_id: int
    start_entity_type: str
    paths: list[PathResult]
    total_paths: int


class ShortestPathRequest(BaseModel):
    """Request for shortest path between two entities."""
    start_entity_id: int
    start_entity_type: str
    end_entity_id: int
    end_entity_type: str
    max_hops: int = Field(5, ge=1, le=10)


class ShortestPathResponse(BaseModel):
    """Response for shortest path query."""
    found: bool
    start_entity_id: int
    start_entity_type: str
    end_entity_id: int
    end_entity_type: str
    path: Optional[PathResult] = None


class CentralityResponse(BaseModel):
    """Response for centrality analysis."""
    metric: str
    scores: list[dict[str, Any]]


class ClusterResponse(BaseModel):
    """Response for cluster detection."""
    clusters: list[dict[str, Any]]
    total_clusters: int


class DuplicateDetectionResponse(BaseModel):
    """Response for duplicate entity detection."""
    entity_type: str
    duplicates: list[dict[str, Any]]
    total: int


# ------------------------------------------------------------------
# Dependencies
# ------------------------------------------------------------------

def get_entity_linker(db: AsyncSession = Depends(get_db)) -> EntityLinker:
    """Dependency to get EntityLinker instance."""
    return EntityLinker(db)


def get_graph_service(db: AsyncSession = Depends(get_db)) -> GraphService:
    """Dependency to get GraphService instance."""
    return GraphService(db)


# ------------------------------------------------------------------
# Endpoints
# ------------------------------------------------------------------

@router.get(
    "/entities",
    response_model=list[dict[str, Any]],
    dependencies=[require_auth],
    summary="列出所有实体",
    description="获取项目中的所有实体（角色、物品、地点、势力），支持按类型和项目过滤。",
)
async def list_entities(
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    entity_type: Optional[str] = Query(None, description="Filter by entity type: character, item, location, faction"),
    db: AsyncSession = Depends(get_db),
):
    """List all entities with optional filtering."""
    from backend.core.domain import Character, Item, Location, Faction
    from sqlalchemy import select

    models = {
        "character": Character,
        "item": Item,
        "location": Location,
        "faction": Faction,
    }

    if entity_type and entity_type not in models:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid entity_type. Must be one of: {', '.join(models.keys())}"
        )

    types_to_query = [entity_type] if entity_type else list(models.keys())
    results = []

    for etype in types_to_query:
        model = models[etype]
        stmt = select(model)
        if project_id is not None and hasattr(model, "project_id"):
            stmt = stmt.where(model.project_id == project_id)

        result = await db.execute(stmt)
        for entity in result.scalars().all():
            results.append({
                "id": entity.id,
                "type": etype,
                "name": getattr(entity, "name", ""),
                "description": getattr(entity, "description", None),
                "project_id": getattr(entity, "project_id", None),
            })

    return results


@router.get(
    "/relationships",
    response_model=RelationshipQueryResponse,
    dependencies=[require_auth],
    summary="获取实体关系",
    description="获取指定实体的所有关系（角色关系、隐式关联）。",
)
async def get_relationships(
    entity_id: int = Query(..., description="Entity ID"),
    entity_type: str = Query(..., description="Entity type: character, item, location, faction"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get all relationships for a specific entity."""
    graph_service = GraphService(db)
    neighbors = await graph_service._get_neighbors(entity_id, entity_type, project_id)

    relationships = []
    for neighbor_id, neighbor_type, edge_info in neighbors:
        relationships.append({
            "target_id": neighbor_id,
            "target_type": neighbor_type,
            "relation_label": edge_info.get("label", "关联"),
            "relation_type": edge_info.get("type", "implicit"),
            "properties": edge_info.get("properties", {}),
        })

    return RelationshipQueryResponse(
        entity_id=entity_id,
        entity_type=entity_type,
        relationships=relationships,
        total=len(relationships),
    )


@router.get(
    "/visualization/{project_id}",
    response_model=GraphVisualizationResponse,
    dependencies=[require_auth],
    summary="获取图谱可视化数据",
    description="获取指定项目的完整实体关系图谱数据（节点+边），可直接用于前端可视化库（如 react-force-graph）。",
)
async def get_visualization(
    project_id: int,
    entity_types: Optional[list[str]] = Query(None, description="Filter by entity types"),
    db: AsyncSession = Depends(get_db),
):
    """Get graph visualization data for a project.

    Returns nodes and edges formatted for visualization libraries
    like react-force-graph or D3.js.
    """
    graph_service = GraphService(db)
    graph = await graph_service.build_project_graph(
        project_id=project_id,
        entity_types=entity_types,
    )

    nodes = [
        EntityNode(
            id=n.id,
            type=n.type,
            label=n.label,
            properties=n.properties,
            color=n.color,
            size=n.size,
        )
        for n in graph.nodes
    ]

    edges = [
        EntityEdge(
            source=e.source,
            target=e.target,
            label=e.label,
            type=e.type,
            properties=e.properties,
            directed=e.directed,
        )
        for e in graph.edges
    ]

    return GraphVisualizationResponse(
        project_id=project_id,
        nodes=nodes,
        edges=edges,
        node_count=len(nodes),
        edge_count=len(edges),
    )


@router.post(
    "/link-entities",
    response_model=LinkEntitiesResponse,
    dependencies=[require_auth],
    summary="注册实体别名",
    description="为指定实体注册一个或多个别名，用于消歧和关联。",
)
async def link_entities(
    request: LinkEntitiesRequest,
    linker: EntityLinker = Depends(get_entity_linker),
):
    """Register aliases for an entity.

    Aliases help with disambiguation when the same name refers to
    different entities or when the same entity has multiple names.
    """
    registered = []
    failed = []

    for alias in request.aliases:
        success = await linker.register_alias(
            entity_id=request.entity_id,
            entity_type=request.entity_type,
            alias=alias,
        )
        if success:
            registered.append(alias)
        else:
            failed.append(alias)

    return LinkEntitiesResponse(
        entity_id=request.entity_id,
        entity_type=request.entity_type,
        registered_aliases=registered,
        failed=failed,
    )


@router.post(
    "/resolve-ambiguous",
    response_model=ResolveAmbiguousResponse,
    dependencies=[require_auth],
    summary="消歧模糊实体提及",
    description="对一组模糊的实体提及进行消歧，返回最佳匹配候选及置信度。",
)
async def resolve_ambiguous(
    request: ResolveAmbiguousRequest,
    linker: EntityLinker = Depends(get_entity_linker),
):
    """Resolve ambiguous entity mentions.

    Takes a list of mentions and returns disambiguation results
    with confidence scores and candidate lists.
    """
    uncertain_items = []
    for m in request.mentions:
        uncertain_items.append({
            "mention": m.get("mention", ""),
            "context": m.get("context", ""),
            "suggested_id": m.get("suggested_id"),
            "suggested_type": m.get("suggested_type", "character"),
            "confidence": m.get("confidence", 0.0),
        })

    results, warnings = await linker.process_extraction_result(
        uncertain_items,
        project_id=request.project_id,
    )

    resolved_items = []
    auto_resolved = 0
    needs_review = 0

    for r in results:
        candidates = []
        for c in r.candidates:
            candidates.append(AmbiguityCandidate(
                id=c["id"],
                type=c["type"],
                name=c["name"],
                confidence=c.get("confidence", 0.0),
                match_type=c.get("match_type", "unknown"),
            ))

        resolved_items.append(ResolvedMention(
            mention=r.mention,
            entity_id=r.entity_id,
            entity_type=r.entity_type,
            confidence=r.confidence,
            candidates=candidates,
            adopted=r.adopted,
            warning=r.warning,
        ))

        if r.adopted and r.confidence >= linker._confidence_high:
            auto_resolved += 1
        else:
            needs_review += 1

    return ResolveAmbiguousResponse(
        results=resolved_items,
        warnings=warnings,
        auto_resolved=auto_resolved,
        needs_review=needs_review,
    )


@router.post(
    "/multi-hop",
    response_model=MultiHopQueryResponse,
    dependencies=[require_auth],
    summary="多跳路径查询",
    description="查找从起点实体出发的所有多跳路径，支持指定终点和关系类型过滤。",
)
async def multi_hop_query(
    request: MultiHopQueryRequest,
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    db: AsyncSession = Depends(get_db),
):
    """Multi-hop path query between entities.

    Finds all paths from start entity within max_hops.
    If end entity is specified, only returns paths reaching it.
    """
    graph_service = GraphService(db)
    paths = await graph_service.multi_hop_query(
        start_entity_id=request.start_entity_id,
        start_entity_type=request.start_entity_type,
        end_entity_id=request.end_entity_id,
        end_entity_type=request.end_entity_type,
        max_hops=request.max_hops,
        relation_types=request.relation_types,
        project_id=project_id,
    )

    path_results = []
    for p in paths:
        nodes = [PathNode(id=n["id"], type=n["type"], label=n.get("label", "")) for n in p["nodes"]]
        edges = [PathEdge(source=e["source"], target=e["target"], label=e["label"], type=e["type"]) for e in p["edges"]]
        path_results.append(PathResult(nodes=nodes, edges=edges, hops=p["hops"]))

    return MultiHopQueryResponse(
        start_entity_id=request.start_entity_id,
        start_entity_type=request.start_entity_type,
        paths=path_results,
        total_paths=len(path_results),
    )


@router.post(
    "/shortest-path",
    response_model=ShortestPathResponse,
    dependencies=[require_auth],
    summary="最短路径查询",
    description="使用 BFS 查找两个实体之间的最短路径。",
)
async def shortest_path(
    request: ShortestPathRequest,
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    db: AsyncSession = Depends(get_db),
):
    """Find shortest path between two entities using BFS."""
    graph_service = GraphService(db)
    path = await graph_service.find_shortest_path(
        start_entity_id=request.start_entity_id,
        start_entity_type=request.start_entity_type,
        end_entity_id=request.end_entity_id,
        end_entity_type=request.end_entity_type,
        max_hops=request.max_hops,
        project_id=project_id,
    )

    if path:
        nodes = [PathNode(id=n["id"], type=n["type"], label=n.get("label", "")) for n in path["nodes"]]
        edges = [PathEdge(source=e["source"], target=e["target"], label=e["label"], type=e["type"]) for e in path["edges"]]
        return ShortestPathResponse(
            found=True,
            start_entity_id=request.start_entity_id,
            start_entity_type=request.start_entity_type,
            end_entity_id=request.end_entity_id,
            end_entity_type=request.end_entity_type,
            path=PathResult(nodes=nodes, edges=edges, hops=path["hops"]),
        )

    return ShortestPathResponse(
        found=False,
        start_entity_id=request.start_entity_id,
        start_entity_type=request.start_entity_type,
        end_entity_id=request.end_entity_id,
        end_entity_type=request.end_entity_type,
        path=None,
    )


@router.get(
    "/centrality",
    response_model=CentralityResponse,
    dependencies=[require_auth],
    summary="节点中心性分析",
    description="计算图谱中各节点的中心性分数（degree/betweenness）。",
)
async def get_centrality(
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    metric: str = Query("degree", description="Centrality metric: degree, betweenness"),
    db: AsyncSession = Depends(get_db),
):
    """Compute node centrality scores for the project graph."""
    if metric not in ("degree", "betweenness"):
        raise HTTPException(
            status_code=400,
            detail="metric must be 'degree' or 'betweenness'"
        )

    graph_service = GraphService(db)
    scores = await graph_service.compute_centrality(
        project_id=project_id,
        metric=metric,
    )

    return CentralityResponse(metric=metric, scores=scores)


@router.get(
    "/clusters",
    response_model=ClusterResponse,
    dependencies=[require_auth],
    summary="实体社群发现",
    description="基于连通分量发现实体簇/社群结构。",
)
async def get_clusters(
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    db: AsyncSession = Depends(get_db),
):
    """Find entity clusters/communities based on connected components."""
    graph_service = GraphService(db)
    clusters = await graph_service.find_clusters(project_id=project_id)

    return ClusterResponse(
        clusters=clusters,
        total_clusters=len(clusters),
    )


@router.get(
    "/duplicates",
    response_model=DuplicateDetectionResponse,
    dependencies=[require_auth],
    summary="检测潜在重复实体",
    description="检测指定类型中可能重复的实体（同名或高相似度）。",
)
async def find_duplicates(
    entity_type: str = Query(..., description="Entity type: character, item, location, faction"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    threshold: float = Query(0.75, ge=0.0, le=1.0, description="Similarity threshold"),
    db: AsyncSession = Depends(get_db),
):
    """Find potentially duplicate entities of a given type."""
    linker = EntityLinker(db)
    duplicates = await linker.find_potential_duplicates(
        entity_type=entity_type,
        project_id=project_id,
        threshold=threshold,
    )

    return DuplicateDetectionResponse(
        entity_type=entity_type,
        duplicates=duplicates,
        total=len(duplicates),
    )


@router.get(
    "/neighborhood",
    response_model=GraphVisualizationResponse,
    dependencies=[require_auth],
    summary="获取实体邻域子图",
    description="获取指定实体周围指定深度内的邻域子图。",
)
async def get_neighborhood(
    entity_id: int = Query(..., description="Center entity ID"),
    entity_type: str = Query(..., description="Center entity type"),
    depth: int = Query(1, ge=1, le=3, description="Neighborhood depth (hops)"),
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    db: AsyncSession = Depends(get_db),
):
    """Get neighborhood subgraph around a specific entity."""
    graph_service = GraphService(db)
    graph = await graph_service.build_entity_neighborhood(
        entity_id=entity_id,
        entity_type=entity_type,
        depth=depth,
        project_id=project_id,
    )

    nodes = [
        EntityNode(
            id=n.id,
            type=n.type,
            label=n.label,
            properties=n.properties,
            color=n.color,
            size=n.size,
        )
        for n in graph.nodes
    ]

    edges = [
        EntityEdge(
            source=e.source,
            target=e.target,
            label=e.label,
            type=e.type,
            properties=e.properties,
            directed=e.directed,
        )
        for e in graph.edges
    ]

    return GraphVisualizationResponse(
        project_id=project_id,
        nodes=nodes,
        edges=edges,
        node_count=len(nodes),
        edge_count=len(edges),
    )
