/**
 * Cache API - Frontend wrappers for cache management endpoints.
 *
 * Covers:
 * - Cache statistics (/cache/stats)
 * - Flush all cache (/cache/flush)
 * - Invalidate by tag (/cache/invalidate/{tag})
 * - Preload status (/cache/preload-status)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CacheStatsResponse {
  size: number
  directory: string
}

export interface CacheFlushResponse {
  message: string
}

export interface CacheInvalidateResponse {
  tag: string
  deleted_count: number
}

export interface PreloadStatusResponse {
  status: string
  elapsed_ms: number
  total_items: number
  categories: Record<string, number>
  errors: string[]
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Get cache statistics. */
export const getCacheStats = (): Promise<CacheStatsResponse> =>
  api.get<CacheStatsResponse>("/cache/stats")

/** Flush all cache entries. */
export const flushCache = (): Promise<CacheFlushResponse> =>
  api.post<CacheFlushResponse>("/cache/flush")

/** Invalidate cache entries by tag. */
export const invalidateCacheTag = (
  tag: string
): Promise<CacheInvalidateResponse> =>
  api.post<CacheInvalidateResponse>(`/cache/invalidate/${encodeURIComponent(tag)}`)

/** Get startup preload status. */
export const getPreloadStatus = (): Promise<PreloadStatusResponse> =>
  api.get<PreloadStatusResponse>("/cache/preload-status")

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const cacheApi = {
  getCacheStats,
  flushCache,
  invalidateCacheTag,
  getPreloadStatus,
}

export default cacheApi
