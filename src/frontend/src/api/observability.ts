/**
 * Observability API - Frontend wrappers for system metrics, debt tracking,
 * quality trends, and comprehensive project status reporting.
 *
 * Covers:
 * - System metrics (/observability/metrics)
 * - Index debt items (/observability/debt)
 * - Resolve debt item (/observability/debt/resolve)
 * - Ignore debt item (/observability/debt/ignore)
 * - Resolve debts by entity (/observability/debt/resolve-by-entity)
 * - Quality trends (/observability/trends)
 * - Chapter quality score (/observability/trends/chapter/{chapter_id})
 * - Dimension trend (/observability/trends/dimension/{dimension})
 * - Compare chapter quality (/observability/trends/compare)
 * - Project status (/observability/status)
 * - Quick status (/observability/status/quick)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ObservabilityMetricsResponse {
  runtime: Record<string, unknown>
  entity_counts: Record<string, number>
  chapter_stats: Record<string, unknown>
  inspection_stats: Record<string, unknown>
  workflow_stats: Record<string, unknown>
}

export interface DebtItem {
  id: string
  type: string
  status: string
  entity_type?: string
  entity_id?: number
  description?: string
  created_at?: string
}

export interface DebtSummary {
  total: number
  pending: number
  in_progress: number
  resolved: number
  ignored: number
}

export interface DebtListResponse {
  summary: DebtSummary
  items: DebtItem[]
  filtered_count: number
}

export interface ResolveDebtRequest {
  debt_id: string
}

export interface ResolveDebtResponse {
  success: boolean
  message: string
  debt?: Record<string, unknown>
}

export interface IgnoreDebtRequest {
  debt_id: string
  reason?: string
}

export interface QualityTrendReport {
  inspections_count: number
  average_score: number
  severity_counts: Record<string, number>
  dimension_averages: Record<string, number>
  risk_flags: string[]
  trend_direction: string
}

export interface ChapterQualityResponse {
  chapter_id: number
  latest_score?: number
  dimension_scores?: Record<string, number>
  inspection_count: number
  last_inspection_at?: string
}

export interface DimensionTrendPoint {
  chapter_id: number
  score: number
  created_at: string
}

export interface ChapterQualityComparison {
  chapter_ids: number[]
  scores: Record<number, number>
  dimension_matrix: Record<string, Record<number, number>>
}

export interface ProjectStatusReport {
  health_score: number
  statistics: Record<string, unknown>
  character_activity: Record<string, unknown>
  plot_thread_status: Record<string, unknown>
  writing_progress: Record<string, unknown>
  quality_overview: Record<string, unknown>
  recent_activity: Array<Record<string, unknown>>
}

export interface QuickStatusResponse {
  chapter_count: number
  word_count: number
  pending_items: number
  activity_24h: number
  status_line: string
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Get combined system and database metrics. */
export const getObservabilityMetrics = (
  windowSeconds = 300
): Promise<ObservabilityMetricsResponse> =>
  api.get<ObservabilityMetricsResponse>("/observability/metrics", {
    window_seconds: windowSeconds,
  })

/** Get index debt items with optional filtering. */
export const getDebtItems = (params?: {
  debt_type?: string
  status?: string
  entity_type?: string
  entity_id?: number
}): Promise<DebtListResponse> =>
  api.get<DebtListResponse>("/observability/debt", params as Record<string, unknown>)

/** Resolve a specific debt item. */
export const resolveObservabilityDebt = (
  debtId: string
): Promise<ResolveDebtResponse> =>
  api.post<ResolveDebtResponse>("/observability/debt/resolve", { debt_id: debtId })

/** Ignore a specific debt item. */
export const ignoreDebt = (
  debtId: string,
  reason?: string
): Promise<ResolveDebtResponse> =>
  api.post<ResolveDebtResponse>("/observability/debt/ignore", {
    debt_id: debtId,
    reason: reason || "",
  })

/** Resolve all debt items for a specific entity. */
export const resolveDebtsByEntity = (
  entityType: string,
  entityId: number
): Promise<{ resolved_count: number; entity_type: string; entity_id: number }> =>
  api.post<{ resolved_count: number; entity_type: string; entity_id: number }>(
    "/observability/debt/resolve-by-entity",
    { entity_type: entityType, entity_id: entityId }
  )

/** Get writing quality trend report. */
export const getQualityTrends = (params?: {
  limit?: number
  chapter_id?: number
}): Promise<QualityTrendReport> =>
  api.get<QualityTrendReport>("/observability/trends", params as Record<string, unknown>)

/** Get quality score for a specific chapter. */
export const getChapterQuality = (
  chapterId: number
): Promise<ChapterQualityResponse | null> =>
  api.get<ChapterQualityResponse | null>(`/observability/trends/chapter/${chapterId}`)

/** Get trend data for a specific quality dimension. */
export const getDimensionTrend = (
  dimension: string,
  limit = 20
): Promise<DimensionTrendPoint[]> =>
  api.get<DimensionTrendPoint[]>(`/observability/trends/dimension/${encodeURIComponent(dimension)}`, {
    limit,
  })

/** Compare quality scores across multiple chapters. */
export const compareChapterQuality = (
  chapterIds: number[]
): Promise<ChapterQualityComparison> =>
  api.post<ChapterQualityComparison>("/observability/trends/compare", chapterIds)

/** Get comprehensive project status report. */
export const getProjectStatus = (): Promise<ProjectStatusReport> =>
  api.get<ProjectStatusReport>("/observability/status")

/** Get a quick one-line status summary. */
export const getQuickStatus = (): Promise<QuickStatusResponse> =>
  api.get<QuickStatusResponse>("/observability/status/quick")

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const observabilityApi = {
  getObservabilityMetrics,
  getDebtItems,
  resolveObservabilityDebt,
  ignoreDebt,
  resolveDebtsByEntity,
  getQualityTrends,
  getChapterQuality,
  getDimensionTrend,
  compareChapterQuality,
  getProjectStatus,
  getQuickStatus,
}

export default observabilityApi
