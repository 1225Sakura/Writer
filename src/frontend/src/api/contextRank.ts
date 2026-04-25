/**
 * Context Rank API - Frontend wrappers for context ranking and weight management.
 *
 * Covers:
 * - Rank context pack (/context-rank/rank)
 * - Get all weights (/context-rank/weights)
 * - Update weights (/context-rank/weights)
 * - Set entity weight (/context-rank/weights/entity)
 * - Set template weight (/context-rank/weights/template)
 * - Resolve weights (/context-rank/weights/resolve)
 * - Reset weights (/context-rank/weights/reset)
 * - Route query (/context-rank/route)
 * - Detect intent (/context-rank/route/intent)
 * - Rank generic items (/context-rank/rank/items)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RankRequest {
  pack?: Record<string, unknown>
  chapter?: number
  debug?: boolean
}

export interface RankResponse {
  ranked_pack: Record<string, unknown>
  meta: {
    chapter: number
    debug: boolean
    version: string
  }
}

export interface WeightsUpdateRequest {
  entity_weights?: Record<string, number>
  template_weights?: Record<string, Record<string, number>>
  dynamic_weights?: Record<string, Record<string, Record<string, number>>>
}

export interface WeightsResponse {
  entity_weights: Record<string, number>
  template_weights: Record<string, Record<string, number>>
  dynamic_weights: Record<string, Record<string, Record<string, number>>>
}

export interface EntityWeightRequest {
  entity_type: string
  weight: number
}

export interface TemplateWeightRequest {
  template: string
  weights: Record<string, number>
}

export interface ResolveWeightsRequest {
  template?: string
  stage?: string
  entity_type?: string
}

export interface RouteRequest {
  query: string
}

export interface RouteResponse {
  intent: string
  entities: string[]
  time_scope: Record<string, unknown>
  needs_graph: boolean
  subqueries: Array<Record<string, unknown>>
  raw_query: string
}

export interface RankItemsRequest {
  items: Array<Record<string, unknown>>
  current_chapter?: number
  chapter_key?: string
  text_key?: string
  debug?: boolean
}

export interface RankItemsResponse {
  items: Array<Record<string, unknown>>
  count: number
  chapter: number
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Rank a context pack by relevance to the current chapter. */
export const rankContextPack = (request: RankRequest): Promise<RankResponse> =>
  api.post<RankResponse>("/context-rank/rank", request)

/** Get all current context weights. */
export const getContextWeights = (): Promise<WeightsResponse> =>
  api.get<WeightsResponse>("/context-rank/weights")

/** Update context weights. */
export const updateContextWeights = (
  request: WeightsUpdateRequest
): Promise<WeightsResponse> =>
  api.post<WeightsResponse>("/context-rank/weights", request)

/** Set weight for a single entity type. */
export const setEntityWeight = (
  request: EntityWeightRequest
): Promise<{ entity_type: string; weight: number }> =>
  api.post<{ entity_type: string; weight: number }>("/context-rank/weights/entity", request)

/** Set weights for a named template. */
export const setTemplateWeight = (
  request: TemplateWeightRequest
): Promise<{ template: string; weights: Record<string, number> }> =>
  api.post<{ template: string; weights: Record<string, number> }>(
    "/context-rank/weights/template",
    request
  )

/** Resolve composite weights for a given context. */
export const resolveWeights = (
  request: ResolveWeightsRequest
): Promise<Record<string, unknown>> =>
  api.post<Record<string, unknown>>("/context-rank/weights/resolve", request)

/** Reset all weights to system defaults. */
export const resetWeights = (): Promise<{ reset: boolean } & WeightsResponse> =>
  api.post<{ reset: boolean } & WeightsResponse>("/context-rank/weights/reset")

/** Route a query to appropriate retrieval strategies. */
export const routeQuery = (request: RouteRequest): Promise<RouteResponse> =>
  api.post<RouteResponse>("/context-rank/route", request)

/** Detect intent for a raw query string. */
export const detectIntent = (query: string): Promise<Record<string, unknown>> =>
  api.post<Record<string, unknown>>("/context-rank/route/intent", { query })

/** Rank a generic list of context items. */
export const rankGenericItems = (
  request: RankItemsRequest
): Promise<RankItemsResponse> =>
  api.post<RankItemsResponse>("/context-rank/rank/items", request)

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const contextRankApi = {
  rankContextPack,
  getContextWeights,
  updateContextWeights,
  setEntityWeight,
  setTemplateWeight,
  resolveWeights,
  resetWeights,
  routeQuery,
  detectIntent,
  rankGenericItems,
}

export default contextRankApi
