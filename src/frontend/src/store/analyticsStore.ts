import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { engagementApi } from '../api/engagement'
import { pacingApi } from '../api/pacing'
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
  analyzeEngagement: (chapterId: number) => Promise<void>
  detectHooks: (chapterId: number) => Promise<void>
  fetchDebts: (params?: { project_id?: number; current_chapter_id?: number }) => Promise<void>
  fetchScore: (chapterId: number) => Promise<void>
  detectDebts: (chapterId: number) => Promise<void>
  resolveDebt: (debtId: number, resolvedChapterId?: number) => Promise<void>

  // Pacing actions
  fetchStrands: () => Promise<void>
  analyzePacing: (outlineId: number, useAi?: boolean) => Promise<void>
  fetchRedLines: (outlineId: number) => Promise<void>
  fetchAdvice: (outlineId: number, useAi?: boolean, chapterPosition?: number) => Promise<void>

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

        analyzeEngagement: async (chapterId) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await engagementApi.analyzeChapterEngagement(chapterId)
            set((s) => {
              s.engagementAnalysis = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '参与度分析失败'
              s.loading = false
            })
          }
        },

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
          }
        },

        detectDebts: async (chapterId) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await engagementApi.detectDebtsFromChapter(chapterId)
            set((s) => {
              if (s.debtReport) {
                s.debtReport.total_debts += data.length
                s.debtReport.active_debts += data.length
              }
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '检测叙事债务失败'
              s.loading = false
            })
          }
        },

        resolveDebt: async (debtId, resolvedChapterId) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            await engagementApi.resolveDebt(debtId, resolvedChapterId)
            set((s) => {
              if (s.debtReport) {
                s.debtReport.active_debts = Math.max(0, s.debtReport.active_debts - 1)
                s.debtReport.fulfilled_debts += 1
              }
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '解决债务失败'
              s.loading = false
            })
          }
        },

        fetchStrands: async () => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await pacingApi.getStrandDefinitions()
            set((s) => {
              s.strandDefinitions = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取叙事线定义失败'
              s.loading = false
            })
          }
        },

        analyzePacing: async (outlineId, useAi) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await pacingApi.analyzePacing(outlineId, useAi)
            set((s) => {
              s.pacingAnalysis = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '节奏分析失败'
              s.loading = false
            })
          }
        },

        fetchRedLines: async (outlineId) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await pacingApi.getRedlines(outlineId)
            set((s) => {
              s.redLines = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取红线状态失败'
              s.loading = false
            })
          }
        },

        fetchAdvice: async (outlineId, useAi, chapterPosition) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await pacingApi.getStrandAdvice({ outline_id: outlineId, use_ai: useAi, chapter_position: chapterPosition })
            set((s) => {
              s.advice = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取叙事线建议失败'
              s.loading = false
            })
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
