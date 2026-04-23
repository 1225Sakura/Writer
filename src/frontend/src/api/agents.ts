/**
 * Agents API - Frontend wrappers for AI agent execution endpoints.
 *
 * Covers:
 * - Style analysis (/agents/style)
 * - Quality review (/agents/review)
 * - Plot analysis (/agents/plot)
 * - Quality checkers (/agents/checkers, /agents/check, /agents/check-all)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StyleAnalysisRequest {
  content: string
  style_reference?: string
}

export interface StyleAnalysisResponse {
  style_match_score: number
  detected_style: string
  suggestions: string[]
  analysis: string
}

export interface ReviewRequest {
  content: string
  context?: Record<string, unknown>
  settings?: Record<string, unknown>
}

export interface ReviewIssue {
  type?: string
  message?: string
  severity?: string
  location?: string
}

export interface ReviewResponse {
  overall_score: number
  severity: string
  total_issues: number
  issues: ReviewIssue[]
  suggestions: string[]
  checker_scores: Record<string, number>
  phase_results: Record<string, unknown>
  disagreements: Array<{
    checker: string
    issue: string
    severity: string
  }>
  confidence: number
  metadata: Record<string, unknown>
}

export interface PlotRequest {
  task_type?: "foreshadowing" | "climax" | "rhythm" | "full"
  content?: string
  outline?: Record<string, unknown>
  chapters?: Array<{
    id: number
    title?: string
    summary?: string
    status?: string
  }>
  active_threads?: Array<{
    id: number
    title: string
    status: string
  }>
  progress?: number
}

export interface PlotResponse {
  results: Record<string, unknown>
  confidence: number
  metadata: Record<string, unknown>
}

export interface CheckerInfo {
  name: string
  description: string
  supports_quick_scan: boolean
  supports_deep_analyze: boolean
}

export interface CheckerListResponse {
  checkers: CheckerInfo[]
  total: number
}

export interface CheckerRunRequest {
  checker_name: string
  chapter_id: number
  mode?: "quick" | "deep"
}

export interface CheckerRunResponse {
  checker_name: string
  chapter_id: number
  mode: string
  score: number
  issues: Array<{
    type: string
    message: string
    severity?: string
    location?: string
  }>
  suggestions: string[]
}

export interface PipelineRequest {
  chapter_id: number
  mode?: "quick" | "deep"
}

export interface PipelineResponse {
  chapter_id: number
  mode: string
  overall_score: number
  severity: string
  total_issues: number
  issue_breakdown: Record<string, number>
  all_suggestions: string[]
  checker_scores: Record<string, number>
  results: Record<string, CheckerRunResponse>
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Analyze writing style of provided content.
 */
export const analyzeStyle = (
  request: StyleAnalysisRequest
): Promise<StyleAnalysisResponse> =>
  api.post<StyleAnalysisResponse>("/agents/style", request)

/**
 * Execute multi-round quality review on content.
 */
export const runReview = (
  request: ReviewRequest
): Promise<ReviewResponse> =>
  api.post<ReviewResponse>("/agents/review", request)

/**
 * Execute plot analysis and design.
 */
export const runPlot = (
  request: PlotRequest
): Promise<PlotResponse> =>
  api.post<PlotResponse>("/agents/plot", request)

/**
 * List all available quality checkers.
 */
export const listCheckers = (): Promise<CheckerListResponse> =>
  api.get<CheckerListResponse>("/agents/checkers")

/**
 * Run a specific checker on a chapter.
 */
export const runChecker = (
  request: CheckerRunRequest
): Promise<CheckerRunResponse> =>
  api.post<CheckerRunResponse>("/agents/check", request)

/**
 * Run all checkers via pipeline on a chapter.
 */
export const runAllCheckers = (
  request: PipelineRequest
): Promise<PipelineResponse> =>
  api.post<PipelineResponse>("/agents/check-all", request)

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const agentsApi = {
  analyzeStyle,
  runReview,
  runPlot,
  listCheckers,
  runChecker,
  runAllCheckers,
}

export default agentsApi
