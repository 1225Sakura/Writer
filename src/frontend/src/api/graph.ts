/**
 * Graph API - Frontend wrappers for entity relationship graph and disambiguation.
 *
 * Covers:
 * - List all entities (/graph/entities)
 * - Get entity relationships (/graph/relationships)
 * - Get graph visualization data (/graph/visualization/{project_id})
 * - Register entity aliases (/graph/link-entities)
 * - Resolve ambiguous mentions (/graph/resolve-ambiguous)
 * - Multi-hop path query (/graph/multi-hop)
 * - Shortest path query (/graph/shortest-path)
 * - Centrality analysis (/graph/centrality)
 * - Cluster detection (/graph/clusters)
 * - Duplicate detection (/graph/duplicates)
 * - Neighborhood subgraph (/graph/neighborhood)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EntityNode {
  id: number
  type: string
  label: string
  properties?: Record<string, unknown>
  color?: string
  size?: number
}

export interface EntityEdge {
  source: number
  target: number
  label: string
  type: string
  properties?: Record<string, unknown>
  directed?: boolean
}

export interface GraphVisualizationResponse {
  project_id?: number
  nodes: EntityNode[]
  edges: EntityEdge[]
  node_count: number
  edge_count: number
}

export interface RelationshipInfo {
  target_id: number
  target_type: string
  relation_label: string
  relation_type: string
  properties?: Record<string, unknown>
}

export interface RelationshipQueryResponse {
  entity_id: number
  entity_type: string
  relationships: RelationshipInfo[]
  total: number
}

export interface LinkEntitiesRequest {
  entity_id: number
  entity_type: string
  aliases: string[]
}

export interface LinkEntitiesResponse {
  entity_id: number
  entity_type: string
  registered_aliases: string[]
  failed: string[]
}

export interface AmbiguityCandidate {
  id: number
  type: string
  name: string
  confidence: number
  match_type: string
}

export interface ResolvedMention {
  mention: string
  entity_id?: number
  entity_type: string
  confidence: number
  candidates: AmbiguityCandidate[]
  adopted: boolean
  warning?: string
}

export interface ResolveAmbiguousRequest {
  mentions: Array<{
    mention: string
    context?: string
    suggested_id?: number
    suggested_type?: string
    confidence?: number
  }>
  project_id?: number
}

export interface ResolveAmbiguousResponse {
  results: ResolvedMention[]
  warnings: string[]
  auto_resolved: number
  needs_review: number
}

export interface PathNode {
  id: number
  type: string
  label: string
}

export interface PathEdge {
  source: number
  target: number
  label: string
  type: string
}

export interface PathResult {
  nodes: PathNode[]
  edges: PathEdge[]
  hops: number
}

export interface MultiHopQueryRequest {
  start_entity_id: number
  start_entity_type: string
  end_entity_id?: number
  end_entity_type?: string
  max_hops?: number
  relation_types?: string[]
}

export interface MultiHopQueryResponse {
  start_entity_id: number
  start_entity_type: string
  paths: PathResult[]
  total_paths: number
}

export interface ShortestPathRequest {
  start_entity_id: number
  start_entity_type: string
  end_entity_id: number
  end_entity_type: string
  max_hops?: number
}

export interface ShortestPathResponse {
  found: boolean
  start_entity_id: number
  start_entity_type: string
  end_entity_id: number
  end_entity_type: string
  path?: PathResult
}

export interface CentralityResponse {
  metric: string
  scores: Array<Record<string, unknown>>
}

export interface ClusterResponse {
  clusters: Array<Record<string, unknown>>
  total_clusters: number
}

export interface DuplicateDetectionResponse {
  entity_type: string
  duplicates: Array<Record<string, unknown>>
  total: number
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** List all entities with optional filtering. */
export const listEntities = (params?: {
  project_id?: number
  entity_type?: string
}): Promise<Array<Record<string, unknown>>> =>
  api.get<Array<Record<string, unknown>>>("/graph/entities", params as Record<string, unknown>)

/** Get all relationships for a specific entity. */
export const getRelationships = (params: {
  entity_id: number
  entity_type: string
  project_id?: number
}): Promise<RelationshipQueryResponse> =>
  api.get<RelationshipQueryResponse>("/graph/relationships", params as Record<string, unknown>)

/** Get graph visualization data for a project. */
export const getGraphVisualization = (
  projectId: number,
  entityTypes?: string[]
): Promise<GraphVisualizationResponse> =>
  api.get<GraphVisualizationResponse>(`/graph/visualization/${projectId}`, {
    entity_types: entityTypes,
  } as Record<string, unknown>)

/** Register aliases for an entity. */
export const linkEntities = (
  request: LinkEntitiesRequest
): Promise<LinkEntitiesResponse> =>
  api.post<LinkEntitiesResponse>("/graph/link-entities", request)

/** Resolve ambiguous entity mentions. */
export const resolveAmbiguous = (
  request: ResolveAmbiguousRequest
): Promise<ResolveAmbiguousResponse> =>
  api.post<ResolveAmbiguousResponse>("/graph/resolve-ambiguous", request)

/** Multi-hop path query between entities. */
export const multiHopQuery = (
  request: MultiHopQueryRequest,
  projectId?: number
): Promise<MultiHopQueryResponse> =>
  api.post<MultiHopQueryResponse>("/graph/multi-hop", request, {
    ...(projectId ? { project_id: projectId } : {}),
  })

/** Find shortest path between two entities using BFS. */
export const shortestPath = (
  request: ShortestPathRequest,
  projectId?: number
): Promise<ShortestPathResponse> =>
  api.post<ShortestPathResponse>("/graph/shortest-path", request, {
    ...(projectId ? { project_id: projectId } : {}),
  })

/** Compute node centrality scores for the project graph. */
export const getCentrality = (params?: {
  project_id?: number
  metric?: "degree" | "betweenness"
}): Promise<CentralityResponse> =>
  api.get<CentralityResponse>("/graph/centrality", params as Record<string, unknown>)

/** Find entity clusters/communities. */
export const getClusters = (params?: {
  project_id?: number
}): Promise<ClusterResponse> =>
  api.get<ClusterResponse>("/graph/clusters", params as Record<string, unknown>)

/** Find potentially duplicate entities of a given type. */
export const findDuplicates = (params: {
  entity_type: string
  project_id?: number
  threshold?: number
}): Promise<DuplicateDetectionResponse> =>
  api.get<DuplicateDetectionResponse>("/graph/duplicates", params as Record<string, unknown>)

/** Get neighborhood subgraph around a specific entity. */
export const getNeighborhood = (params: {
  entity_id: number
  entity_type: string
  depth?: number
  project_id?: number
}): Promise<GraphVisualizationResponse> =>
  api.get<GraphVisualizationResponse>("/graph/neighborhood", params as Record<string, unknown>)

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const graphApi = {
  listEntities,
  getRelationships,
  getGraphVisualization,
  linkEntities,
  resolveAmbiguous,
  multiHopQuery,
  shortestPath,
  getCentrality,
  getClusters,
  findDuplicates,
  getNeighborhood,
}

export default graphApi
