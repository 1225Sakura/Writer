/**
 * Engagement API - Frontend wrappers for reader engagement analysis.
 *
 * Covers:
 * - Analyze chapter engagement (/engagement/analyze/{chapter_id})
 * - Detect chapter hooks (/engagement/hooks/{chapter_id})
 * - Get narrative debt report (/engagement/debts)
 * - Get chapter engagement score (/engagement/score/{chapter_id})
 * - Detect debts from chapter (/engagement/debts/detect/{chapter_id})
 * - Resolve debt (/engagement/debts/resolve/{debt_id})
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HookItem {
  type: string
  position: string
  text: string
  confidence: number
  keywords: string[]
  context: string
  line_number?: number
}

export interface HookAnalysisResponse {
  chapter_id: number
  total_hooks: number
  hooks_by_type: Record<string, number>
  hooks_by_position: Record<string, number>
  hooks: HookItem[]
  opening_hook_strength: number
  ending_hook_strength: number
  overall_hook_score: number
  suggestions: string[]
}

export interface CoolPointItem {
  type: string
  text: string
  intensity: number
  position: number
  context: string
}

export interface FulfillmentItem {
  size: string
  text: string
  position: number
  context: string
}

export interface EngagementAnalysisResponse {
  chapter_id: number
  word_count: number
  cool_points: CoolPointItem[]
  cool_point_count: number
  cool_point_density: number
  cool_point_score: number
  fulfillments: FulfillmentItem[]
  fulfillment_count: number
  fulfillment_score: number
  predicted_retention: number
  retention_factors: Record<string, unknown>
  overall_engagement_score: number
  pacing_analysis: Record<string, unknown>
  suggestions: string[]
}

export interface DebtItem {
  id?: number
  type: string
  status: string
  priority: string
  title: string
  description: string
  created_chapter_id?: number
  created_chapter_title?: string
  expected_chapter_id?: number
  resolved_chapter_id?: number
  keywords: string[]
  overdue_chapters: number
}

export interface DebtReportResponse {
  total_debts: number
  active_debts: number
  fulfilled_debts: number
  overdue_debts: number
  abandoned_debts: number
  debts_by_type: Record<string, number>
  debts_by_priority: Record<string, number>
  critical_overdue: DebtItem[]
  high_priority_active: DebtItem[]
  debt_health_score: number
  risk_assessment: string
  suggestions: string[]
}

export interface EngagementScoreResponse {
  chapter_id: number
  hook_score: number
  engagement_score: number
  predicted_retention: number
  overall_score: number
  grade: string
  suggestions: string[]
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Perform full engagement analysis on a chapter. */
export const analyzeChapterEngagement = (
  chapterId: number
): Promise<EngagementAnalysisResponse> =>
  api.post<EngagementAnalysisResponse>(`/engagement/analyze/${chapterId}`)

/** Detect narrative hooks in a chapter. */
export const detectChapterHooks = (
  chapterId: number
): Promise<HookAnalysisResponse> =>
  api.get<HookAnalysisResponse>(`/engagement/hooks/${chapterId}`)

/** Get narrative debt report. */
export const getNarrativeDebts = (params?: {
  project_id?: number
  current_chapter_id?: number
}): Promise<DebtReportResponse> =>
  api.get<DebtReportResponse>("/engagement/debts", params as Record<string, unknown>)

/** Get combined engagement score for a chapter. */
export const getChapterEngagementScore = (
  chapterId: number
): Promise<EngagementScoreResponse> =>
  api.get<EngagementScoreResponse>(`/engagement/score/${chapterId}`)

/** Detect new narrative debts from chapter content. */
export const detectDebtsFromChapter = (
  chapterId: number
): Promise<DebtItem[]> =>
  api.post<DebtItem[]>(`/engagement/debts/detect/${chapterId}`)

/** Mark a narrative debt as fulfilled. */
export const resolveDebt = (
  debtId: number,
  resolvedChapterId?: number
): Promise<{ message: string; debt_id: number }> =>
  api.post<{ message: string; debt_id: number }>(
    resolvedChapterId
      ? `/engagement/debts/resolve/${debtId}?resolved_chapter_id=${resolvedChapterId}`
      : `/engagement/debts/resolve/${debtId}`
  )

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const engagementApi = {
  analyzeChapterEngagement,
  detectChapterHooks,
  getNarrativeDebts,
  getChapterEngagementScore,
  detectDebtsFromChapter,
  resolveDebt,
}

export default engagementApi
