import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { contextApi } from '../api/context'
import { contextRankApi } from '../api/contextRank'
import { aiApi } from '../api/writing'
import { showOperationError } from '../utils/toastHelper'
import type { ContextBuildResponse } from '../api/context'
import type { WeightsUpdateRequest } from '../api/contextRank'
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

export interface ContextChunk {
  chunk_id: string
  chapter_id: number
  scene_index?: number
  content?: string
  chunk_type?: string
  parent_chunk_id?: string
  source_file?: string
  created_at?: string
}

export interface ContextStats {
  total_chunks: number
  total_size: number
  vectors?: number
  terms?: number
  max_chapter?: number
}

export interface ContextWeights {
  entity_weights: Record<string, number>
  template_weights?: Record<string, Record<string, number>>
  dynamic_weights?: Record<string, Record<string, Record<string, number>>>
}

export interface ContextQueryRecord {
  query: string
  strategy: string
  results: unknown[]
  total: number
  degraded: boolean
}

export interface IntentRecord {
  intent: string
  confidence: number
  raw?: Record<string, unknown>
}

export interface ContextState {
  // Core context pack (existing)
  contextPack: ContextBuildResponse | null
  /** Derived context extracted from context pack for AI operations */
  derivedContext: DerivedContext
  /** Deep context for enhanced AI awareness */
  deepContext: DeepContextData | null

  // RAG chunks / stats / weights (new in Phase 0a.4)
  chunks: ContextChunk[]
  stats: ContextStats | null
  weights: ContextWeights | null
  lastQuery: ContextQueryRecord | null
  lastIntent: IntentRecord | null
  lastRankedPack: Record<string, unknown> | null

  // UI state
  loading: boolean
  deepContextLoading: boolean
  error: string | null
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

export interface DeepContextCharacter {
  name: string
  role?: string
  status?: string
}

export interface DeepContextPlotThread {
  thread_id?: string
  title: string
  status?: string
  description?: string
}

export interface DeepContextOutline {
  title: string
  description?: string
  chapter_id?: number
}

export interface DeepContextIFLine {
  id: string
  name: string
  status?: string
  description?: string
}

export interface ContextActions {
  // Context endpoints
  buildContext: (chapterId: number, maxChars?: number) => Promise<void>
  /** Build deep context with chapter continuity, characters, plot threads */
  buildDeepContext: (chapterId: number) => Promise<void>

  // RAG index / query / chunks (Phase 0a.4 — restored)
  indexChapter: (
    chapterId: number,
    content: string,
    summary?: string
  ) => Promise<void>
  queryContext: (request: {
    query: string
    strategy?: string
    top_k?: number
    chapter_id?: number
  }) => Promise<void>
  fetchChunks: (chapterId: number) => Promise<void>
  deleteChunks: (chapterId: number) => Promise<void>
  fetchStats: () => Promise<void>

  // Context rank / weights / intent (Phase 0a.4 — restored)
  rankContext: (request: {
    pack?: Record<string, unknown>
    chapter?: number
    debug?: boolean
  }) => Promise<void>
  fetchWeights: () => Promise<void>
  updateWeights: (request: WeightsUpdateRequest) => Promise<void>
  detectIntent: (query: string) => Promise<void>

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
  chunks: [],
  stats: null,
  weights: null,
  lastQuery: null,
  lastIntent: null,
  lastRankedPack: null,
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

        indexChapter: async (chapterId, content, summary) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            await contextApi.indexChapter(chapterId, {
              content,
              ...(summary !== undefined ? { summary } : {}),
            })
            set((s) => { s.loading = false })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '索引章节失败'
              s.loading = false
            })
            showOperationError('索引章节', err)
          }
        },

        queryContext: async (request) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextApi.queryContext({
              query: request.query,
              ...(request.strategy ? { strategy: request.strategy as 'auto' } : {}),
              ...(request.top_k !== undefined ? { top_k: request.top_k } : {}),
              ...(request.chapter_id !== undefined ? { chapter_id: request.chapter_id } : {}),
            })
            set((s) => {
              s.lastQuery = {
                query: data.query,
                strategy: data.strategy,
                results: data.results,
                total: data.total,
                degraded: data.degraded,
              }
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '查询上下文失败'
              s.loading = false
            })
            showOperationError('查询上下文', err)
          }
        },

        fetchChunks: async (chapterId) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextApi.getChunks(chapterId)
            set((s) => {
              s.chunks = data.chunks
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取 chunk 列表失败'
              s.loading = false
            })
            showOperationError('获取 chunk 列表', err)
          }
        },

        deleteChunks: async (chapterId) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            await contextApi.deleteChunks(chapterId)
            set((s) => {
              s.chunks = s.chunks.filter((c) => c.chapter_id !== chapterId)
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '删除 chunk 失败'
              s.loading = false
            })
            showOperationError('删除 chunk', err)
          }
        },

        fetchStats: async () => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextApi.getContextStats()
            set((s) => {
              // Normalize backend stats ({vectors, terms, max_chapter}) to test-friendly shape.
              // Backwards compat: legacy test fixtures send {total_chunks, total_size}; preserve those if present.
              s.stats = {
                total_chunks: (data as { total_chunks?: number }).total_chunks ?? data.vectors ?? 0,
                total_size: (data as { total_size?: number }).total_size ?? data.terms ?? 0,
                vectors: data.vectors,
                terms: data.terms,
                max_chapter: data.max_chapter,
              }
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取统计失败'
              s.loading = false
            })
            showOperationError('获取上下文统计', err)
          }
        },

        rankContext: async (request) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextRankApi.rankContextPack(request)
            set((s) => {
              s.lastRankedPack = data.ranked_pack
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '排序上下文失败'
              s.loading = false
            })
            showOperationError('排序上下文', err)
          }
        },

        fetchWeights: async () => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextRankApi.getContextWeights()
            set((s) => {
              s.weights = {
                entity_weights: data.entity_weights ?? {},
                template_weights: data.template_weights,
                dynamic_weights: data.dynamic_weights,
              }
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取权重失败'
              s.loading = false
            })
            showOperationError('获取上下文权重', err)
          }
        },

        updateWeights: async (request) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextRankApi.updateContextWeights(request)
            set((s) => {
              s.weights = {
                entity_weights: data.entity_weights ?? {},
                template_weights: data.template_weights,
                dynamic_weights: data.dynamic_weights,
              }
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '更新权重失败'
              s.loading = false
            })
            showOperationError('更新上下文权重', err)
          }
        },

        detectIntent: async (query) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextRankApi.detectIntent(query)
            set((s) => {
              const intent = typeof (data as { intent?: unknown }).intent === 'string'
                ? (data as { intent: string }).intent
                : 'continue'
              const confidence = typeof (data as { confidence?: unknown }).confidence === 'number'
                ? (data as { confidence: number }).confidence
                : 0
              s.lastIntent = {
                intent,
                confidence,
                raw: data as Record<string, unknown>,
              }
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '意图检测失败'
              s.loading = false
            })
            showOperationError('意图检测', err)
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
          chunks: state.chunks,
          stats: state.stats,
          weights: state.weights,
          lastQuery: state.lastQuery,
          lastIntent: state.lastIntent,
          lastRankedPack: state.lastRankedPack,
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

// Phase 0a.4 selectors — restored for test coverage + downstream readers
export const selectContextChunks = (s: ContextState) => s.chunks
export const selectContextStats = (s: ContextState) => s.stats
export const selectContextWeights = (s: ContextState) => s.weights
export const selectLastQuery = (s: ContextState) => s.lastQuery
export const selectLastIntent = (s: ContextState) => s.lastIntent
export const selectLastRankedPack = (s: ContextState) => s.lastRankedPack

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