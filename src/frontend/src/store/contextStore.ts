import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { contextApi } from '../api/context'
import { aiApi } from '../api/writing'
import { showOperationError } from '../utils/toastHelper'
import type { ContextBuildResponse } from '../api/context'
import type {
  DeepContextCharacter,
  DeepContextPlotThread,
  DeepContextOutline,
  DeepContextIFLine,
} from '../api/types'
import { createHybridStorage } from './utils/indexedDBStorage'

// ============================================
// Types
// ============================================

export interface DerivedContext {
  /** Extracted character names from context pack */
  characterNames: string[]
  /** Open plot threads mentioned in context */
  openPlotThreads: string[]
  /** Recent chapter summaries */
  recentSummaries: string[]
  /** Last updated timestamp */
  updatedAt: number | null
}

export interface DeepContextData {
  /** Previous chapter summary for narrative continuity */
  previousChapterSummary: string | null
  /** Characters associated with the current chapter */
  chapterCharacters: DeepContextCharacter[]
  /** Plot threads with status labels (埋设/发展/揭示) */
  plotThreadStatuses: DeepContextPlotThread[]
  /** Current outline title and description */
  outlineInfo: DeepContextOutline | null
  /** Active IF lines */
  activeIFLines: DeepContextIFLine[]
  /** Last updated timestamp */
  updatedAt: number | null
}

export interface ContextState {
  // Data
  contextPack: ContextBuildResponse | null
  /** Derived context extracted from context pack for AI operations */
  derivedContext: DerivedContext
  /** Deep context for enhanced AI awareness */
  deepContext: DeepContextData | null

  // UI state
  loading: boolean
  deepContextLoading: boolean
  error: string | null
}

export interface ContextActions {
  // Context endpoints
  buildContext: (chapterId: number, maxChars?: number) => Promise<void>
  /** Build deep context with chapter continuity, characters, plot threads */
  buildDeepContext: (chapterId: number) => Promise<void>

  // Derived context
  extractDerivedContext: () => void

  // Reset
  reset: () => void
}

// ============================================
// Initial state
// ============================================

const initialDerivedContext: DerivedContext = {
  characterNames: [],
  openPlotThreads: [],
  recentSummaries: [],
  updatedAt: null,
}

const initialState: ContextState = {
  contextPack: null,
  derivedContext: initialDerivedContext,
  deepContext: null,
  loading: false,
  deepContextLoading: false,
  error: null,
}

// ============================================
// Store
// ============================================

export const useContextStore = create<ContextState & ContextActions>()(
  subscribeWithSelector(
    persist(
      immer((set, get) => ({
        ...initialState,

        buildContext: async (chapterId, maxChars) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextApi.buildContext(chapterId, { max_chars: maxChars })
            set((s) => {
              s.contextPack = data
              s.loading = false
            })
            // Auto-extract derived context after building
            get().extractDerivedContext()
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '构建上下文包失败'
              s.loading = false
            })
            showOperationError('构建上下文包', err)
          }
        },

        buildDeepContext: async (chapterId) => {
          set((s) => { s.deepContextLoading = true; s.error = null })
          try {
            const data = await aiApi.buildDeepContext(chapterId)
            set((s) => {
              s.deepContext = {
                previousChapterSummary: data.previous_chapter?.summary ?? null,
                chapterCharacters: data.characters ?? [],
                plotThreadStatuses: data.plot_threads ?? [],
                outlineInfo: data.outline ?? null,
                activeIFLines: data.if_lines ?? [],
                updatedAt: Date.now(),
              }
              s.deepContextLoading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '构建深度上下文失败'
              s.deepContextLoading = false
            })
            showOperationError('构建深度上下文', err)
          }
        },

        extractDerivedContext: () => {
          const { contextPack } = get()
          if (!contextPack) {
            set((s) => { s.derivedContext = initialDerivedContext })
            return
          }

          const sections = contextPack.sections || {}
          const meta = contextPack.meta || {}

          // Extract character names from sections
          const characterNames: string[] = []
          if (sections.characters && Array.isArray(sections.characters)) {
            for (const char of sections.characters) {
              if (typeof char === 'object' && char !== null && 'name' in char) {
                characterNames.push((char as { name: string }).name)
              } else if (typeof char === 'string') {
                characterNames.push(char)
              }
            }
          }

          // Extract open plot threads from sections
          const openPlotThreads: string[] = []
          if (sections.plot_threads && Array.isArray(sections.plot_threads)) {
            for (const thread of sections.plot_threads) {
              if (typeof thread === 'string') {
                openPlotThreads.push(thread)
              } else if (typeof thread === 'object' && thread !== null && 'description' in thread) {
                openPlotThreads.push((thread as { description: string }).description)
              }
            }
          }

          // Extract recent chapter summaries from meta
          const recentSummaries: string[] = []
          if (meta.chapter_summaries && Array.isArray(meta.chapter_summaries)) {
            for (const summary of meta.chapter_summaries) {
              if (typeof summary === 'string') {
                recentSummaries.push(summary)
              } else if (typeof summary === 'object' && summary !== null && 'text' in summary) {
                recentSummaries.push((summary as { text: string }).text)
              }
            }
          }

          set((s) => {
            s.derivedContext = {
              characterNames,
              openPlotThreads,
              recentSummaries,
              updatedAt: Date.now(),
            }
          })
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
          derivedContext: state.derivedContext,
          deepContext: state.deepContext,
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
export const selectDerivedContext = (s: ContextState) => s.derivedContext
export const selectCharacterNames = (s: ContextState) => s.derivedContext.characterNames
export const selectOpenPlotThreads = (s: ContextState) => s.derivedContext.openPlotThreads
export const selectRecentSummaries = (s: ContextState) => s.derivedContext.recentSummaries

// Deep context selectors
export const selectDeepContext = (s: ContextState) => s.deepContext
export const selectDeepContextLoading = (s: ContextState) => s.deepContextLoading
export const selectPreviousChapterSummary = (s: ContextState) => s.deepContext?.previousChapterSummary ?? null
export const selectChapterCharacters = (s: ContextState) => s.deepContext?.chapterCharacters ?? []
export const selectPlotThreadStatuses = (s: ContextState) => s.deepContext?.plotThreadStatuses ?? []
export const selectOutlineInfo = (s: ContextState) => s.deepContext?.outlineInfo ?? null
export const selectDeepContextActiveIFLines = (s: ContextState) => s.deepContext?.activeIFLines ?? []

export const cleanupContextStore = () => {
  useContextStore.setState(initialState)
}
