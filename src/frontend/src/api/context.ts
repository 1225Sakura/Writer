/**
 * Context API - Frontend wrappers for RAG context retrieval.
 *
 * Covers:
 * - Build context pack for a chapter (/context/build/{chapter_id})
 * - Index chapter content (/context/index/{chapter_id})
 * - Query RAG index (/context/query)
 * - List indexed chunks (/context/chunks/{chapter_id})
 * - Delete chapter index (/context/chunks/{chapter_id})
 * - RAG index statistics (/context/stats)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContextBuildRequest {
  max_chars?: number
}

export interface ContextBuildResponse {
  chapter_id: number
  sections: Record<string, unknown>
  meta: Record<string, unknown>
  weights: Record<string, number>
}

export interface ContextQueryRequest {
  query: string
  strategy?: "auto" | "graph_hybrid" | "bm25_fallback" | "hybrid" | "vector" | "bm25"
  top_k?: number
  chunk_type?: string
  chapter_id?: number
  center_entities?: string[]
}

export interface ContextQueryResult {
  chunk_id: string
  chapter_id: number
  scene_index: number
  content: string
  score: number
  source: string
  chunk_type?: string
  parent_chunk_id?: string
  source_file?: string
}

export interface ContextQueryResponse {
  query: string
  strategy: string
  results: ContextQueryResult[]
  total: number
  degraded: boolean
  degraded_reason?: string
}

export interface ContextChunkResponse {
  chunk_id: string
  chapter_id: number
  scene_index: number
  content: string
  chunk_type: string
  parent_chunk_id?: string
  source_file?: string
  created_at?: string
}

export interface ContextChunksResponse {
  chapter_id: number
  chunks: ContextChunkResponse[]
  total: number
}

export interface ContextIndexRequest {
  content: string
  summary?: string
  max_chunk_size?: number
  overlap?: number
}

export interface ContextIndexResponse {
  chapter_id: number
  stored: number
  total_chunks: number
  degraded: boolean
  degraded_reason?: string
}

export interface ContextStatsResponse {
  vectors: number
  terms: number
  max_chapter: number
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Build a context pack for the specified chapter. */
export const buildContext = (
  chapterId: number,
  request: ContextBuildRequest = {}
): Promise<ContextBuildResponse> =>
  api.post<ContextBuildResponse>(`/context/build/${chapterId}`, request)

/** Index chapter content into the RAG store. */
export const indexChapter = (
  chapterId: number,
  request: ContextIndexRequest
): Promise<ContextIndexResponse> =>
  api.post<ContextIndexResponse>(`/context/index/${chapterId}`, request)

/** Query the RAG index with the specified strategy. */
export const queryContext = (
  request: ContextQueryRequest
): Promise<ContextQueryResponse> =>
  api.post<ContextQueryResponse>("/context/query", request)

/** List indexed chunks for a chapter. */
export const getChunks = (chapterId: number): Promise<ContextChunksResponse> =>
  api.get<ContextChunksResponse>(`/context/chunks/${chapterId}`)

/** Delete all indexed chunks for a chapter. */
export const deleteChunks = (
  chapterId: number
): Promise<{ chapter_id: number; deleted: number }> =>
  api.delete<{ chapter_id: number; deleted: number }>(`/context/chunks/${chapterId}`)

/** Get RAG index statistics. */
export const getContextStats = (): Promise<ContextStatsResponse> =>
  api.get<ContextStatsResponse>("/context/stats")

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const contextApi = {
  buildContext,
  indexChapter,
  queryContext,
  getChunks,
  deleteChunks,
  getContextStats,
}

export default contextApi
