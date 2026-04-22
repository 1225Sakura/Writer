/**
 * System API - Frontend wrappers for health, stats, cache, and AI provider status.
 *
 * Covers:
 * - Health check (/health)
 * - Readiness probe (/health/ready)
 * - Liveness probe (/health/live)
 * - Project stats (/stats/overview)
 * - Cache preload status (/cache/preload-status)
 * - AI provider health (/ai/health)
 * - AI provider failover (/ai/failover)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthCheckResult {
  status: string
  latency_ms?: number
  detail?: string
  message?: string
}

export interface DiskSpaceCheck {
  status: string
  total_gb: number
  free_gb: number
  used_percent: number
  path: string
}

export interface DependencyCheck {
  status: string
  version?: string
}

export interface HealthResponse {
  status: string
  timestamp: string
  app: {
    name: string
    version: string
  }
  system: {
    python_version: string
    platform: string
  }
  checks: {
    database: HealthCheckResult
    ai_service: HealthCheckResult
    disk_space: DiskSpaceCheck | HealthCheckResult
    dependencies: Record<string, DependencyCheck>
  }
}

export interface ReadinessResponse {
  status: string
}

export interface LivenessResponse {
  status: string
}

export interface ProjectStatsResponse {
  total_chapters: number
  total_characters: number
  total_outlines: number
  total_if_lines: number
  total_draft_versions: number
  total_plot_threads: number
  total_word_count: number
  total_chat_sessions: number
  chapters_by_status: Record<string, number>
}

export interface PreloadStatusResponse {
  status: string
  elapsed_ms: number
  total_items: number
  categories: Record<string, number>
  errors: string[]
}

export interface ProviderHealth {
  status: string
  degraded: boolean
  consecutive_errors: number
  total_calls: number
  failed_calls: number
  success_rate: number
  avg_latency_ms: number
}

export interface AIHealthResponse {
  providers: Record<string, ProviderHealth>
  recommended: string
}

export interface FailoverRequest {
  target_provider?: string
}

export interface FailoverResponse {
  success: boolean
  new_primary: string
  message: string
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Comprehensive health check. */
export const getHealth = (): Promise<HealthResponse> =>
  api.get<HealthResponse>("/health")

/** Kubernetes-style readiness probe. */
export const getReadiness = (): Promise<ReadinessResponse> =>
  api.get<ReadinessResponse>("/health/ready")

/** Kubernetes-style liveness probe. */
export const getLiveness = (): Promise<LivenessResponse> =>
  api.get<LivenessResponse>("/health/live")

/** Get project overview statistics. */
export const getProjectStats = (): Promise<ProjectStatsResponse> =>
  api.get<ProjectStatsResponse>("/stats/overview")

/** Get cache preload status. */
export const getPreloadStatus = (): Promise<PreloadStatusResponse> =>
  api.get<PreloadStatusResponse>("/cache/preload-status")

/** Get AI provider health status. */
export const getAIProviderHealth = (): Promise<AIHealthResponse> =>
  api.get<AIHealthResponse>("/ai/health")

/** Manually trigger AI provider failover. */
export const triggerFailover = (
  request: FailoverRequest = {}
): Promise<FailoverResponse> =>
  api.post<FailoverResponse>("/ai/failover", request)

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const systemApi = {
  getHealth,
  getReadiness,
  getLiveness,
  getProjectStats,
  getPreloadStatus,
  getAIProviderHealth,
  triggerFailover,
}

export default systemApi
