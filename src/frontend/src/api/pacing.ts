/**
 * Pacing API - Frontend wrappers for Strand Weave pacing analysis.
 *
 * Covers:
 * - Get strand definitions (/pacing/strands)
 * - Analyze outline pacing (/pacing/analysis/{outline_id})
 * - Get red line status (/pacing/redlines)
 * - Get strand advice (/pacing/advice)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StrandDefinition {
  name: string
  display_name: string
  description: string
  ideal_ratio: number
  color: string
}

export interface RedLineDefinition {
  strand: string
  rule: string
  limit: number
  description: string
  severity: string
}

export interface StrandDefinitionsResponse {
  strands: StrandDefinition[]
  red_lines: RedLineDefinition[]
  ideal_ratios: Record<string, number>
}

export interface ChapterClassification {
  chapter_id: number
  chapter_title?: string
  strand: string
  confidence: number
}

export interface RedLineViolation {
  strand: string
  rule: string
  limit: number
  current: number
  status: string
  severity: string
}

export interface PacingAnalysisResponse {
  outline_id: number
  total_chapters: number
  strand_ratios: Record<string, number>
  chapter_classifications: ChapterClassification[]
  red_line_violations: RedLineViolation[]
  quest_streak: number
  fire_gap: number
  constellation_gap: number
  health_score: number
  summary: string
}

export interface RedLineStatus {
  strand: string
  rule: string
  limit: number
  current: number
  status: string
}

export interface RedLinesResponse {
  red_lines: RedLineStatus[]
  current_status: {
    quest_streak: number
    fire_gap: number
    constellation_gap: number
    health_score: number
  }
  violations_count: number
  warnings_count: number
}

export interface AdviceRequest {
  outline_id: number
  use_ai?: boolean
  chapter_position?: number
}

export interface AdviceResponse {
  recommended_strand: string
  confidence: number
  reasoning: string
  urgency: string
  alternative_strands: string[]
  suggested_elements: string[]
  warnings: string[]
  current_ratios?: Record<string, number>
  health_score?: number
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Get strand definitions and ideal ratios. */
export const getStrandDefinitions = (): Promise<StrandDefinitionsResponse> =>
  api.get<StrandDefinitionsResponse>("/pacing/strands")

/** Analyze pacing for all chapters in an outline. */
export const analyzePacing = (
  outlineId: number,
  useAi = false
): Promise<PacingAnalysisResponse> =>
  api.get<PacingAnalysisResponse>(`/pacing/analysis/${outlineId}`, { use_ai: useAi })

/** Get current red line status for an outline. */
export const getRedlines = (outlineId: number): Promise<RedLinesResponse> =>
  api.get<RedLinesResponse>("/pacing/redlines", { outline_id: outlineId })

/** Get advice for the next chapter's strand. */
export const getStrandAdvice = (request: AdviceRequest): Promise<AdviceResponse> =>
  api.post<AdviceResponse>("/pacing/advice", request)

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const pacingApi = {
  getStrandDefinitions,
  analyzePacing,
  getRedlines,
  getStrandAdvice,
}

export default pacingApi
