import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { graphApi } from '../api/graph'
import { showOperationError } from '../utils/toastHelper'
import type {
  EntityNode,
  GraphVisualizationResponse,
  RelationshipQueryResponse,
  MultiHopQueryResponse,
  ShortestPathResponse,
  CentralityResponse,
  ClusterResponse,
  DuplicateDetectionResponse,
} from '../api/graph'
import { createHybridStorage } from './utils/indexedDBStorage'

// ============================================
// Types
// ============================================

export interface GraphState {
  // Data
  entities: EntityNode[]
  relationships: RelationshipQueryResponse | null
  visualization: GraphVisualizationResponse | null
  selectedNode: EntityNode | null
  clusters: ClusterResponse | null
  duplicates: DuplicateDetectionResponse[]
  multiHopResult: MultiHopQueryResponse | null
  shortestPathResult: ShortestPathResponse | null
  centralityResult: CentralityResponse | null

  // UI state
  loading: boolean
  error: string | null
}

export interface GraphActions {
  // Fetch actions
  fetchEntities: (params?: { project_id?: number; entity_type?: string }) => Promise<void>
  fetchRelationships: (params: { entity_id: number; entity_type: string; project_id?: number }) => Promise<void>
  fetchVisualization: (projectId: number, entityTypes?: string[]) => Promise<void>
  fetchMultiHop: (request: {
    start_entity_id: number
    start_entity_type: string
    end_entity_id?: number
    end_entity_type?: string
    max_hops?: number
    relation_types?: string[]
  }, projectId?: number) => Promise<void>
  fetchShortestPath: (request: {
    start_entity_id: number
    start_entity_type: string
    end_entity_id: number
    end_entity_type: string
    max_hops?: number
  }, projectId?: number) => Promise<void>
  fetchCentrality: (params?: { project_id?: number; metric?: 'degree' | 'betweenness' }) => Promise<void>
  fetchClusters: (params?: { project_id?: number }) => Promise<void>
  fetchDuplicates: (params: { entity_type: string; project_id?: number; threshold?: number }) => Promise<void>

  // Selection
  selectNode: (node: EntityNode | null) => void
  clearSelection: () => void

  // Reset
  reset: () => void
}

// ============================================
// Initial state
// ============================================

const initialState: GraphState = {
  entities: [],
  relationships: null,
  visualization: null,
  selectedNode: null,
  clusters: null,
  duplicates: [],
  multiHopResult: null,
  shortestPathResult: null,
  centralityResult: null,
  loading: false,
  error: null,
}

// ============================================
// Store
// ============================================

export const useGraphStore = create<GraphState & GraphActions>()(
  subscribeWithSelector(
    persist(
      immer((set) => ({
        ...initialState,

        fetchEntities: async (params) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await graphApi.listEntities(params)
            set((s) => {
              s.entities = data as unknown as EntityNode[]
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取实体列表失败'
              s.loading = false
            })
            showOperationError('获取实体列表', err)
          }
        },

        fetchRelationships: async (params) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await graphApi.getRelationships(params)
            set((s) => {
              s.relationships = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取关系数据失败'
              s.loading = false
            })
            showOperationError('获取关系数据', err)
          }
        },

        fetchVisualization: async (projectId, entityTypes) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await graphApi.getGraphVisualization(projectId, entityTypes)
            set((s) => {
              s.visualization = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '获取图谱可视化数据失败'
              s.loading = false
            })
            showOperationError('获取图谱可视化', err)
          }
        },

        fetchMultiHop: async (request, projectId) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await graphApi.multiHopQuery(request, projectId)
            set((s) => {
              s.multiHopResult = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '多跳查询失败'
              s.loading = false
            })
            showOperationError('多跳查询', err)
          }
        },

        fetchShortestPath: async (request, projectId) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await graphApi.shortestPath(request, projectId)
            set((s) => {
              s.shortestPathResult = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '最短路径查询失败'
              s.loading = false
            })
            showOperationError('最短路径查询', err)
          }
        },

        fetchCentrality: async (params) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await graphApi.getCentrality(params)
            set((s) => {
              s.centralityResult = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '中心性分析失败'
              s.loading = false
            })
            showOperationError('中心性分析', err)
          }
        },

        fetchClusters: async (params) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await graphApi.getClusters(params)
            set((s) => {
              s.clusters = data
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '聚类检测失败'
              s.loading = false
            })
            showOperationError('聚类检测', err)
          }
        },

        fetchDuplicates: async (params) => {
          set((s) => { s.loading = true; s.error = null })
          try {
            const data = await graphApi.findDuplicates(params)
            set((s) => {
              s.duplicates = [data]
              s.loading = false
            })
          } catch (err) {
            set((s) => {
              s.error = err instanceof Error ? err.message : '重复检测失败'
              s.loading = false
            })
            showOperationError('重复检测', err)
          }
        },

        selectNode: (node) => {
          set((s) => { s.selectedNode = node })
        },

        clearSelection: () => {
          set((s) => { s.selectedNode = null })
        },

        reset: () => {
          set(() => ({ ...initialState }))
        },
      })),
      {
        name: 'graph-store',
        storage: createHybridStorage(),
        partialize: (state) => ({
          entities: state.entities,
          visualization: state.visualization,
          clusters: state.clusters,
          duplicates: state.duplicates,
        }),
      },
    ),
  ),
)

// ============================================
// Selectors
// ============================================

export const selectGraphEntities = (s: GraphState) => s.entities
export const selectGraphVisualization = (s: GraphState) => s.visualization
export const selectGraphSelectedNode = (s: GraphState) => s.selectedNode
export const selectGraphLoading = (s: GraphState) => s.loading
export const selectGraphError = (s: GraphState) => s.error
export const selectGraphClusters = (s: GraphState) => s.clusters
export const selectGraphDuplicates = (s: GraphState) => s.duplicates

export const cleanupGraphStore = () => {
  useGraphStore.setState(initialState)
}
