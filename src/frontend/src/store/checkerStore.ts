import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { checkerApi } from '../api/writing'
import type {
  ConsistencyCheckResponse,
  ContinuityCheckResponse,
  PacingCheckResponse,
  OOCCheckResponse,
  HighPointCheckResponse,
  ReaderPullCheckResponse,
} from '../api/types'
import { showOperationError } from '../utils/toastHelper'

// ============================================
// Types
// ============================================

interface CheckerState {
  checkerResults: {
    consistency: ConsistencyCheckResponse | null
    continuity: ContinuityCheckResponse | null
    pacing: PacingCheckResponse | null
    ooc: OOCCheckResponse | null
    highPoint: HighPointCheckResponse | null
    readerPull: ReaderPullCheckResponse | null
  }
  oocWarnings: string[]
  powerImbalanceWarnings: string[]
  loading: {
    checkers: boolean
  }
  error: string | null
}

interface CheckerActions {
  runConsistencyCheck: (chapterId: number) => Promise<ConsistencyCheckResponse | null>
  runContinuityCheck: (chapterId: number) => Promise<ContinuityCheckResponse | null>
  runPacingCheck: (chapterId: number) => Promise<PacingCheckResponse | null>
  runOOCCheck: (chapterId: number, characterId: number) => Promise<OOCCheckResponse | null>
  runHighPointCheck: (chapterId: number) => Promise<HighPointCheckResponse | null>
  runReaderPullCheck: (chapterId: number) => Promise<ReaderPullCheckResponse | null>
  runAllChecks: (chapterId: number) => Promise<void>
  clearCheckerResults: () => void
  setOOCWarnings: (warnings: string[]) => void
  setPowerImbalanceWarnings: (warnings: string[]) => void
  clearWarnings: () => void
}

// ============================================
// Store
// ============================================

export const useCheckerStore = create<CheckerState & CheckerActions>()(
  immer(
    subscribeWithSelector((set) => ({
      // Initial state
      checkerResults: {
        consistency: null,
        continuity: null,
        pacing: null,
        ooc: null,
        highPoint: null,
        readerPull: null,
      },
      oocWarnings: [],
      powerImbalanceWarnings: [],
      loading: {
        checkers: false,
      },
      error: null,

      // ----------------------------------------
      // AI Checkers
      // ----------------------------------------

      runConsistencyCheck: async (chapterId) => {
        set((state) => {
          state.loading.checkers = true
          state.error = null
        })
        try {
          const result = await checkerApi.consistency(chapterId)
          set((state) => {
            state.checkerResults.consistency = result
            if (result.issues.length > 0) {
              state.powerImbalanceWarnings = result.issues
            }
          })
          return result
        } catch (error) {
          const msg = error instanceof Error ? error.message : '一致性检查失败'
          set((state) => { state.error = msg })
          showOperationError('一致性检查', error)
          return null
        } finally {
          set((state) => { state.loading.checkers = false })
        }
      },

      runContinuityCheck: async (chapterId) => {
        set((state) => {
          state.loading.checkers = true
          state.error = null
        })
        try {
          const result = await checkerApi.continuity(chapterId)
          set((state) => { state.checkerResults.continuity = result })
          return result
        } catch (error) {
          const msg = error instanceof Error ? error.message : '连续性检查失败'
          set((state) => { state.error = msg })
          showOperationError('连续性检查', error)
          return null
        } finally {
          set((state) => { state.loading.checkers = false })
        }
      },

      runPacingCheck: async (chapterId) => {
        set((state) => {
          state.loading.checkers = true
          state.error = null
        })
        try {
          const result = await checkerApi.pacing(chapterId)
          set((state) => { state.checkerResults.pacing = result })
          return result
        } catch (error) {
          const msg = error instanceof Error ? error.message : '节奏检查失败'
          set((state) => { state.error = msg })
          showOperationError('节奏检查', error)
          return null
        } finally {
          set((state) => { state.loading.checkers = false })
        }
      },

      runOOCCheck: async (chapterId, characterId) => {
        set((state) => {
          state.loading.checkers = true
          state.error = null
        })
        try {
          const result = await checkerApi.ooc(chapterId, characterId)
          set((state) => {
            state.checkerResults.ooc = result
            if (result.violations.length > 0) {
              state.oocWarnings = result.violations.map(
                (v) => `${v.location}: ${v.reason} (期望: ${v.expected_behavior}, 实际: ${v.actual_behavior})`
              )
            }
          })
          return result
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'OOC检查失败'
          set((state) => { state.error = msg })
          showOperationError('OOC检查', error)
          return null
        } finally {
          set((state) => { state.loading.checkers = false })
        }
      },

      runHighPointCheck: async (chapterId) => {
        set((state) => {
          state.loading.checkers = true
          state.error = null
        })
        try {
          const result = await checkerApi.highPoint(chapterId)
          set((state) => { state.checkerResults.highPoint = result })
          return result
        } catch (error) {
          const msg = error instanceof Error ? error.message : '高潮检查失败'
          set((state) => { state.error = msg })
          showOperationError('高潮检查', error)
          return null
        } finally {
          set((state) => { state.loading.checkers = false })
        }
      },

      runReaderPullCheck: async (chapterId) => {
        set((state) => {
          state.loading.checkers = true
          state.error = null
        })
        try {
          const result = await checkerApi.readerPull(chapterId)
          set((state) => { state.checkerResults.readerPull = result })
          return result
        } catch (error) {
          const msg = error instanceof Error ? error.message : '读者吸引力检查失败'
          set((state) => { state.error = msg })
          showOperationError('读者吸引力检查', error)
          return null
        } finally {
          set((state) => { state.loading.checkers = false })
        }
      },

      runAllChecks: async (chapterId) => {
        set((state) => {
          state.loading.checkers = true
          state.error = null
        })
        try {
          const [consistency, continuity, pacing, highPoint, readerPull] = await Promise.allSettled([
            checkerApi.consistency(chapterId),
            checkerApi.continuity(chapterId),
            checkerApi.pacing(chapterId),
            checkerApi.highPoint(chapterId),
            checkerApi.readerPull(chapterId),
          ])

          set((state) => {
            if (consistency.status === 'fulfilled') {
              state.checkerResults.consistency = consistency.value
              if (consistency.value.issues.length > 0) {
                state.powerImbalanceWarnings = consistency.value.issues
              }
            }
            if (continuity.status === 'fulfilled') state.checkerResults.continuity = continuity.value
            if (pacing.status === 'fulfilled') state.checkerResults.pacing = pacing.value
            if (highPoint.status === 'fulfilled') state.checkerResults.highPoint = highPoint.value
            if (readerPull.status === 'fulfilled') state.checkerResults.readerPull = readerPull.value
          })
        } catch (error) {
          const msg = error instanceof Error ? error.message : '批量检查失败'
          set((state) => { state.error = msg })
          showOperationError('批量检查', error)
        } finally {
          set((state) => { state.loading.checkers = false })
        }
      },

      clearCheckerResults: () => {
        set((state) => {
          state.checkerResults = {
            consistency: null,
            continuity: null,
            pacing: null,
            ooc: null,
            highPoint: null,
            readerPull: null,
          }
          state.oocWarnings = []
          state.powerImbalanceWarnings = []
        })
      },

      setOOCWarnings: (warnings) => {
        set((state) => { state.oocWarnings = warnings })
      },

      setPowerImbalanceWarnings: (warnings) => {
        set((state) => { state.powerImbalanceWarnings = warnings })
      },

      clearWarnings: () => {
        set((state) => {
          state.oocWarnings = []
          state.powerImbalanceWarnings = []
        })
      },
    }))
  )
)

// ============================================
// Selectors
// ============================================

export const selectCheckerResults = (state: CheckerState) => state.checkerResults
export const selectCheckerLoading = (state: CheckerState) => state.loading.checkers
export const selectCheckerError = (state: CheckerState) => state.error

export function cleanupCheckerStore() {
  useCheckerStore.setState((state) => {
    state.loading.checkers = false
    state.error = null
  })
}
