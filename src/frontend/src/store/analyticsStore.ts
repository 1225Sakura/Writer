import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { engagementApi } from '../api/engagement'
import { showOperationError } from '../utils/toastHelper'
import type {
  EngagementAnalysisResponse,
  HookAnalysisResponse,
  DebtReportResponse,
  EngagementScoreResponse,
} from '../api/engagement'
import type {
  StrandDefinitionsResponse,
  PacingAnalysisResponse,
  RedLinesResponse,
  AdviceResponse,
} from '../api/pacing'
import { createHybridStorage } from './utils/indexedDBStorage'

// ============================================
// Types
// ============================================

export interface AnalyticsState {
  // Engagement data
  engagementAnalysis: EngagementAnalysisResponse | null
  hookAnalysis: HookAnalysisResponse | null
  debtReport: DebtReportResponse | null
  engagementScore: EngagementScoreResponse | null

  // Pacing data
  strandDefinitions: StrandDefinitionsResponse | null
  pacingAnalysis: PacingAnalysisResponse | null
  redLines: RedLinesResponse | null
  advice: AdviceResponse | null

  // UI state
  loading: boolean
  error: string | null
}

export interface AnalyticsActions {
  // Engagement actions
  detectHooks: (chapterId: number) => Promise<void>
  fetchDebts: (params?: { project_id?: number; current_chapter_id?: number }) => Promise<void>
  fetchScore: (chapterId: number) => Promise<void>

  // Reset
  reset: () => void
}

// ============================================
// Initial state
// ============================================

const initialState: AnalyticsState = {
  engagementAnalysis: null,
  hookAnalysis: null,
  debtReport: null,
  engagementScore: null,
  strandDefinitions: null,
  pacingAnalysis: null,
  redLines: null,
  advice: null,
  loading: false,
  error: null,
}

// ============================================
// Store
// ============================================

export const useAnalyticsStore = create<AnalyticsState & AnalyticsActions>()(
  subscribeWithSelector(
    persist(
      immer((set) => ({
        ...initialState,

        detectHooks: async (chapterId) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await engagementApi.detectChapterHooks(chapterId)
            set((s) => {
              s.hookAnalysis = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '钩子检测失败'
              s.loading = false
            })
            showOperationError('钩子检测', err)
          }
        },

        fetchDebts: async (params) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await engagementApi.getNarrativeDebts(params)
            set((s) => {
              s.debtReport = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取叙事债务失败'
              s.loading = false
            })
            showOperationError('获取叙事债务', err)
          }
        },

        fetchScore: async (chapterId) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await engagementApi.getChapterEngagementScore(chapterId)
            set((s) => {
              s.engagementScore = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取参与度分数失败'
              s.loading = false
            })
            showOperationError('获取参与度分数', err)
          }
        },

        reset: () => {
          set(() => ({ ...initialState }))
        },
      })),
      {
        name: 'analytics-store',
        storage: createHybridStorage(),
        partialize: (state) => ({
          strandDefinitions: state.strandDefinitions,
        }),
      },
    ),
  ),
)

// ============================================
// Selectors
// ============================================

export const selectEngagementAnalysis = (s: AnalyticsState) => s.engagementAnalysis
export const selectHookAnalysis = (s: AnalyticsState) => s.hookAnalysis
export const selectDebtReport = (s: AnalyticsState) => s.debtReport
export const selectEngagementScore = (s: AnalyticsState) => s.engagementScore
export const selectStrandDefinitions = (s: AnalyticsState) => s.strandDefinitions
export const selectPacingAnalysis = (s: AnalyticsState) => s.pacingAnalysis
export const selectRedLines = (s: AnalyticsState) => s.redLines
export const selectAdvice = (s: AnalyticsState) => s.advice
export const selectAnalyticsLoading = (s: AnalyticsState) => s.loading
export const selectAnalyticsError = (s: AnalyticsState) => s.error

export const cleanupAnalyticsStore = () => {
  useAnalyticsStore.setState(initialState)
}
