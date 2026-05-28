import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createHybridStorage } from './utils/indexedDBStorage'
import { showOperationError } from '../utils/toastHelper'
import { genresApi, type GenrePresetResponse, type GenreProfileResponse, type BuiltProfileResponse } from '@/api/genres'
import { workflowsApi, type WorkflowInfo, type ExecuteWorkflowResponse, type ExecutionSummary } from '@/api/workflows'
import { observabilityApi, type ObservabilityMetricsResponse, type DebtListResponse, type QualityTrendReport, type ProjectStatusReport, type QuickStatusResponse } from '@/api/observability'
import { constraintsApi, type ConstraintCheckResponse, type ConstraintRuleResponse, type ConstraintViolationResponse } from '@/api/constraints'

// ============================================
// Types
// ============================================

export interface SystemState {
  // Genres
  genres: GenrePresetResponse[]
  genreProfile: GenreProfileResponse | null
  builtProfile: BuiltProfileResponse | null

  // Workflows
  workflows: WorkflowInfo[]
  executions: ExecutionSummary[]
  lastExecution: ExecuteWorkflowResponse | null

  // Observability
  metrics: ObservabilityMetricsResponse | null
  debts: DebtListResponse | null
  trends: QualityTrendReport | null
  projectStatus: ProjectStatusReport | null
  quickStatus: QuickStatusResponse | null

  // Constraints
  constraintRules: ConstraintRuleResponse[]
  lastCheckResult: ConstraintCheckResponse | null
  violations: ConstraintViolationResponse[]

  // Common
  loading: boolean
  error: string | null
}

interface SystemActions {
  // Genres
  fetchGenres: () => Promise<void>
  fetchGenreProfile: (genre: string) => Promise<void>

  // Workflows
  listWorkflows: () => Promise<void>
  executeWorkflow: (name: string, context?: Record<string, unknown>) => Promise<void>
  fetchExecutions: (workflowName?: string) => Promise<void>

  // Observability
  fetchMetrics: (windowSeconds?: number) => Promise<void>
  fetchDebts: (params?: { debt_type?: string; status?: string }) => Promise<void>
  fetchTrends: (limit?: number) => Promise<void>
  fetchQuickStatus: () => Promise<void>

  // Constraints
  fetchConstraintRules: (params?: { law_type?: string; status?: string }) => Promise<void>

  // Utility
  clearError: () => void
}

// ============================================
// Store
// ============================================

export const useSystemStore = create<SystemState & SystemActions>()(
  immer(
    subscribeWithSelector(
      persist(
        (set) => ({
          // Initial state
          genres: [],
          genreProfile: null,
          builtProfile: null,
          workflows: [],
          executions: [],
          lastExecution: null,
          metrics: null,
          debts: null,
          trends: null,
          projectStatus: null,
          quickStatus: null,
          constraintRules: [],
          lastCheckResult: null,
          violations: [],
          loading: false,
          error: null,

          // --- Genre actions ---

          fetchGenres: async () => {
            set((s) => { s.loading = true; s.error = null })
            try {
              const genres = await genresApi.listGenres()
              set((s) => { s.genres = genres; s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '获取类型列表失败'
              set((s) => { s.loading = false; s.error = message })
              showOperationError('获取类型列表', err)
            }
          },

          fetchGenreProfile: async (genre) => {
            set((s) => { s.loading = true; s.error = null })
            try {
              const profile = await genresApi.getGenreProfile(genre)
              set((s) => { s.genreProfile = profile; s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '获取类型档案失败'
              set((s) => { s.loading = false; s.error = message })
              showOperationError('获取类型档案', err)
            }
          },

          // --- Workflow actions ---

          listWorkflows: async () => {
            set((s) => { s.loading = true; s.error = null })
            try {
              const result = await workflowsApi.listWorkflows()
              set((s) => { s.workflows = result.workflows; s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '获取工作流列表失败'
              set((s) => { s.loading = false; s.error = message })
              showOperationError('获取工作流列表', err)
            }
          },

          executeWorkflow: async (name, context) => {
            set((s) => { s.loading = true; s.error = null })
            try {
              const result = await workflowsApi.executeWorkflow(name, { context })
              set((s) => { s.lastExecution = result; s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '执行工作流失败'
              set((s) => { s.loading = false; s.error = message })
              showOperationError('执行工作流', err)
            }
          },

          fetchExecutions: async (workflowName) => {
            set((s) => { s.loading = true; s.error = null })
            try {
              const result = await workflowsApi.listExecutions(workflowName)
              set((s) => { s.executions = result.executions; s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '获取执行历史失败'
              set((s) => { s.loading = false; s.error = message })
              showOperationError('获取执行历史', err)
            }
          },

          // --- Observability actions ---

          fetchMetrics: async (windowSeconds) => {
            try {
              const metrics = await observabilityApi.getObservabilityMetrics(windowSeconds)
              set((s) => { s.metrics = metrics })
            } catch (err) {
              const message = err instanceof Error ? err.message : '获取系统指标失败'
              set((s) => { s.error = message })
              showOperationError('获取系统指标', err)
            }
          },

          fetchDebts: async (params) => {
            try {
              const debts = await observabilityApi.getDebtItems(params)
              set((s) => { s.debts = debts })
            } catch (err) {
              const message = err instanceof Error ? err.message : '获取债务列表失败'
              set((s) => { s.error = message })
              showOperationError('获取债务列表', err)
            }
          },

          fetchTrends: async (limit) => {
            try {
              const trends = await observabilityApi.getQualityTrends({ limit })
              set((s) => { s.trends = trends })
            } catch (err) {
              const message = err instanceof Error ? err.message : '获取质量趋势失败'
              set((s) => { s.error = message })
              showOperationError('获取质量趋势', err)
            }
          },

          fetchQuickStatus: async () => {
            try {
              const status = await observabilityApi.getQuickStatus()
              set((s) => { s.quickStatus = status })
            } catch (err) {
              const message = err instanceof Error ? err.message : '获取快速状态失败'
              set((s) => { s.error = message })
              showOperationError('获取快速状态', err)
            }
          },

          // --- Constraint actions ---

          fetchConstraintRules: async (params) => {
            try {
              const result = await constraintsApi.listConstraintRules(params)
              set((s) => { s.constraintRules = result.rules })
            } catch (err) {
              const message = err instanceof Error ? err.message : '获取约束规则失败'
              set((s) => { s.error = message })
              showOperationError('获取约束规则', err)
            }
          },

          // --- Utility ---

          clearError: () => {
            set((s) => { s.error = null })
          },
        }),
        {
          name: 'system-store',
          storage: createHybridStorage(),
          partialize: (state) => ({
            genres: state.genres,
            workflows: state.workflows,
            constraintRules: state.constraintRules,
          }),
        }
      )
    )
  )
)

// Selectors
export const selectGenres = (s: SystemState) => s.genres
export const selectGenreProfile = (s: SystemState) => s.genreProfile
export const selectWorkflows = (s: SystemState) => s.workflows
export const selectExecutions = (s: SystemState) => s.executions
export const selectMetrics = (s: SystemState) => s.metrics
export const selectDebts = (s: SystemState) => s.debts
export const selectTrends = (s: SystemState) => s.trends
export const selectProjectStatus = (s: SystemState) => s.projectStatus
export const selectQuickStatus = (s: SystemState) => s.quickStatus
export const selectConstraintRules = (s: SystemState) => s.constraintRules
export const selectLastCheckResult = (s: SystemState) => s.lastCheckResult
export const selectSystemLoading = (s: SystemState) => s.loading
export const selectSystemError = (s: SystemState) => s.error

export function cleanupSystemStore() {
  useSystemStore.setState({
    genres: [],
    genreProfile: null,
    builtProfile: null,
    workflows: [],
    executions: [],
    lastExecution: null,
    metrics: null,
    debts: null,
    trends: null,
    projectStatus: null,
    quickStatus: null,
    constraintRules: [],
    lastCheckResult: null,
    violations: [],
    loading: false,
    error: null,
  })
}
