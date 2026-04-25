/**
 * Constraints API - Frontend wrappers for the Writing Constraint Engine.
 *
 * Covers:
 * - Check content against constraints (/constraints/check)
 * - Enforce constraints (/constraints/enforce)
 * - List constraint rules (/constraints/rules)
 * - Add constraint rule (/constraints/rules)
 * - Delete constraint rule (/constraints/rules/{rule_id})
 * - Get violation history (/constraints/violations)
 * - Check style constraints (/constraints/style-check)
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConstraintCheckRequest {
  content: string
  chapter_id?: number
  project_id?: number
  outline_id?: number
  mode?: "quick" | "deep"
  include_style?: boolean
}

export interface ConstraintViolationResponse {
  rule_id: string
  law_type: string
  severity: string
  message: string
  evidence?: string
  location?: string
  suggestion?: string
}

export interface ConstraintCheckResponse {
  passed: boolean
  overall_score: number
  violations: ConstraintViolationResponse[]
  rules_checked: string[]
  summary: string
}

export interface ConstraintRuleRequest {
  law_type: string
  name: string
  description: string
  pattern?: string
  severity?: string
  metadata?: Record<string, unknown>
}

export interface ConstraintRuleResponse {
  id: string
  law_type: string
  name: string
  description: string
  pattern?: string
  severity: string
  status: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface ConstraintRulesListResponse {
  rules: ConstraintRuleResponse[]
  total: number
}

export interface ViolationsListResponse {
  violations: ConstraintViolationResponse[]
  total: number
  filters: Record<string, unknown>
}

export interface StyleCheckRequest {
  content: string
  project_id?: number
  target_style?: string
  target_word_count?: number
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Check content against the Three Anti-Hallucination Laws. */
export const checkConstraints = (
  request: ConstraintCheckRequest
): Promise<ConstraintCheckResponse> =>
  api.post<ConstraintCheckResponse>("/constraints/check", request)

/** Enforce constraints on content (alias for check). */
export const enforceConstraints = (
  request: ConstraintCheckRequest
): Promise<ConstraintCheckResponse> =>
  api.post<ConstraintCheckResponse>("/constraints/enforce", request)

/** List all constraint rules. */
export const listConstraintRules = (params?: {
  law_type?: string
  status?: string
}): Promise<ConstraintRulesListResponse> =>
  api.get<ConstraintRulesListResponse>("/constraints/rules", params as Record<string, unknown>)

/** Add a new constraint rule. */
export const addConstraintRule = (
  request: ConstraintRuleRequest
): Promise<ConstraintRuleResponse> =>
  api.post<ConstraintRuleResponse>("/constraints/rules", request)

/** Delete a constraint rule by ID. */
export const deleteConstraintRule = (ruleId: string): Promise<void> =>
  api.delete<void>(`/constraints/rules/${encodeURIComponent(ruleId)}`)

/** Get historical constraint violations. */
export const getViolations = (params?: {
  chapter_id?: number
  law_type?: string
  severity?: string
  limit?: number
}): Promise<ViolationsListResponse> =>
  api.get<ViolationsListResponse>("/constraints/violations", params as Record<string, unknown>)

/** Check only style constraints on content. */
export const checkStyleConstraints = (
  request: StyleCheckRequest
): Promise<ConstraintCheckResponse> =>
  api.post<ConstraintCheckResponse>("/constraints/style-check", request)

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const constraintsApi = {
  checkConstraints,
  enforceConstraints,
  listConstraintRules,
  addConstraintRule,
  deleteConstraintRule,
  getViolations,
  checkStyleConstraints,
}

export default constraintsApi
