import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { contextApi } from '../api/context'
import { showOperationError } from '../utils/toastHelper'
import type { ContextBuildResponse } from '../api/context'
import { createHybridStorage } from './utils/indexedDBStorage'

// ============================================
// Types
// ============================================

export interface ContextState {
  // Data
  contextPack: ContextBuildResponse | null

  // UI state
  loading: boolean
  error: string | null
}

export interface ContextActions {
  // Context endpoints
  buildContext: (chapterId: number, maxChars?: number) => Promise<void>

  // Reset
  reset: () => void
}

// ============================================
// Initial state
// ============================================

const initialState: ContextState = {
  contextPack: null,
  loading: false,
  error: null,
}

// ============================================
// Store
// ============================================

export const useContextStore = create<ContextState & ContextActions>()(
  subscribeWithSelector(
    persist(
      immer((set) => ({
        ...initialState,

        buildContext: async (chapterId, maxChars) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextApi.buildContext(chapterId, { max_chars: maxChars })
            set((s) => {
              s.contextPack = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '构建上下文包失败'
              s.loading = false
            })
            showOperationError('构建上下文包', err)
          }
        },

        reset: () => {
          set(() => ({ ...initialState }))
        },
      })),
      {
        name: 'context-store',
        storage: createHybridStorage(),
        partialize: (state) => ({
          contextPack: state.contextPack,
        }),
      },
    ),
  ),
)

// ============================================
// Selectors
// ============================================

export const selectContextPack = (s: ContextState) => s.contextPack
export const selectContextLoading = (s: ContextState) => s.loading
export const selectContextError = (s: ContextState) => s.error

export const cleanupContextStore = () => {
  useContextStore.setState(initialState)
}
