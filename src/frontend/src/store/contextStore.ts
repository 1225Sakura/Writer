import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { contextApi } from '../api/context'
import { contextRankApi } from '../api/contextRank'
import type {
  ContextBuildResponse,
  ContextChunkResponse,
  ContextStatsResponse,
  ContextQueryResponse,
  ContextQueryRequest,
} from '../api/context'
import type { WeightsResponse } from '../api/contextRank'
import { createHybridStorage } from './utils/indexedDBStorage'

// ============================================
// Types
// ============================================

export interface ContextState {
  // Data
  contextPack: ContextBuildResponse | null
  chunks: ContextChunkResponse[]
  stats: ContextStatsResponse | null
  weights: WeightsResponse | null
  lastQuery: ContextQueryResponse | null
  lastIntent: Record<string, unknown> | null

  // UI state
  loading: boolean
  error: string | null
}

export interface ContextActions {
  // Context endpoints
  buildContext: (chapterId: number, maxChars?: number) => Promise<void>
  indexChapter: (chapterId: number, content: string, summary?: string) => Promise<void>
  queryContext: (request: ContextQueryRequest) => Promise<void>
  fetchChunks: (chapterId: number) => Promise<void>
  deleteChunks: (chapterId: number) => Promise<void>
  fetchStats: () => Promise<void>

  // Context rank endpoints
  rankContext: (pack?: Record<string, unknown>, chapter?: number) => Promise<void>
  fetchWeights: () => Promise<void>
  updateWeights: (request: {
    entity_weights?: Record<string, number>
    template_weights?: Record<string, Record<string, number>>
    dynamic_weights?: Record<string, Record<string, Record<string, number>>>
  }) => Promise<void>
  detectIntent: (query: string) => Promise<void>

  // Reset
  reset: () => void
}

// ============================================
// Initial state
// ============================================

const initialState: ContextState = {
  contextPack: null,
  chunks: [],
  stats: null,
  weights: null,
  lastQuery: null,
  lastIntent: null,
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
          }
        },

        indexChapter: async (chapterId, content, summary) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            await contextApi.indexChapter(chapterId, { content, summary })
            set((s) => { s.loading = false })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '索引章节失败'
              s.loading = false
            })
          }
        },

        queryContext: async (request) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextApi.queryContext(request)
            set((s) => {
              s.lastQuery = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '查询上下文失败'
              s.loading = false
            })
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
              s.error = err instanceof Error ? err.message : '获取索引块失败'
              s.loading = false
            })
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
              s.error = err instanceof Error ? err.message : '删除索引块失败'
              s.loading = false
            })
          }
        },

        fetchStats: async () => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextApi.getContextStats()
            set((s) => {
              s.stats = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取索引统计失败'
              s.loading = false
            })
          }
        },

        rankContext: async (pack, chapter) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextRankApi.rankContextPack({ pack, chapter })
            set((s) => {
              if (s.contextPack) {
                s.contextPack = { ...s.contextPack, ...data.ranked_pack } as ContextBuildResponse
              }
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '排名上下文失败'
              s.loading = false
            })
          }
        },

        fetchWeights: async () => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextRankApi.getContextWeights()
            set((s) => {
              s.weights = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取权重失败'
              s.loading = false
            })
          }
        },

        updateWeights: async (request) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextRankApi.updateContextWeights(request)
            set((s) => {
              s.weights = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '更新权重失败'
              s.loading = false
            })
          }
        },

        detectIntent: async (query) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await contextRankApi.detectIntent(query)
            set((s) => {
              s.lastIntent = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '意图检测失败'
              s.loading = false
            })
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
          weights: state.weights,
        }),
      },
    ),
  ),
)

// ============================================
// Selectors
// ============================================

export const selectContextPack = (s: ContextState) => s.contextPack
export const selectContextChunks = (s: ContextState) => s.chunks
export const selectContextStats = (s: ContextState) => s.stats
export const selectContextWeights = (s: ContextState) => s.weights
export const selectLastQuery = (s: ContextState) => s.lastQuery
export const selectContextLoading = (s: ContextState) => s.loading
export const selectContextError = (s: ContextState) => s.error

export const cleanupContextStore = () => {
  useContextStore.setState(initialState)
}
