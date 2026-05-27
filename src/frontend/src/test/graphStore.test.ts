import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useGraphStore, selectGraphEntities, selectGraphVisualization, selectGraphSelectedNode, selectGraphLoading, selectGraphError, selectGraphClusters, selectGraphDuplicates, cleanupGraphStore } from '@/store/graphStore'

// Mock API modules
vi.mock('@/api/graph', () => ({
  graphApi: {
    listEntities: vi.fn().mockResolvedValue([]),
    getRelationships: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
    getGraphVisualization: vi.fn().mockResolvedValue({ nodes: [], edges: [] }),
    multiHopQuery: vi.fn().mockResolvedValue({ paths: [] }),
    shortestPath: vi.fn().mockResolvedValue({ path: [] }),
    getCentrality: vi.fn().mockResolvedValue({ rankings: [] }),
    getClusters: vi.fn().mockResolvedValue({ clusters: [] }),
    findDuplicates: vi.fn().mockResolvedValue({ duplicates: [] }),
  },
}))

vi.mock('@/store/utils/indexedDBStorage', () => ({
  createHybridStorage: () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('graphStore', () => {
  beforeEach(() => {
    useGraphStore.setState({
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
    })
  })

  it('should have initial state', () => {
    const { result } = renderHook(() => useGraphStore())
    expect(result.current.entities).toEqual([])
    expect(result.current.relationships).toBeNull()
    expect(result.current.visualization).toBeNull()
    expect(result.current.selectedNode).toBeNull()
    expect(result.current.clusters).toBeNull()
    expect(result.current.duplicates).toEqual([])
    expect(result.current.multiHopResult).toBeNull()
    expect(result.current.shortestPathResult).toBeNull()
    expect(result.current.centralityResult).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should expose all actions', () => {
    const { result } = renderHook(() => useGraphStore())
    expect(typeof result.current.fetchEntities).toBe('function')
    expect(typeof result.current.fetchRelationships).toBe('function')
    expect(typeof result.current.fetchVisualization).toBe('function')
    expect(typeof result.current.fetchMultiHop).toBe('function')
    expect(typeof result.current.fetchShortestPath).toBe('function')
    expect(typeof result.current.fetchCentrality).toBe('function')
    expect(typeof result.current.fetchClusters).toBe('function')
    expect(typeof result.current.fetchDuplicates).toBe('function')
    expect(typeof result.current.selectNode).toBe('function')
    expect(typeof result.current.clearSelection).toBe('function')
    expect(typeof result.current.reset).toBe('function')
  })

  it('should fetch entities and store result', async () => {
    const { graphApi } = await import('@/api/graph')
    vi.mocked(graphApi.listEntities).mockResolvedValueOnce([
      { id: 1, type: 'character', label: 'Alice' },
      { id: 2, type: 'item', label: 'Sword' },
    ] as any)

    const { result } = renderHook(() => useGraphStore())
    await act(async () => {
      await result.current.fetchEntities()
    })
    expect(result.current.entities).toHaveLength(2)
    expect(result.current.loading).toBe(false)
  })

  it('should handle fetchEntities error', async () => {
    const { graphApi } = await import('@/api/graph')
    vi.mocked(graphApi.listEntities).mockRejectedValueOnce(new Error('Network fail'))

    const { result } = renderHook(() => useGraphStore())
    await act(async () => {
      await result.current.fetchEntities()
    })
    expect(result.current.error).toBe('Network fail')
    expect(result.current.loading).toBe(false)
  })

  it('should fetch relationships', async () => {
    const { graphApi } = await import('@/api/graph')
    vi.mocked(graphApi.getRelationships).mockResolvedValueOnce({
      nodes: [{ id: 1 }],
      edges: [{ source: 1, target: 2 }],
    } as any)

    const { result } = renderHook(() => useGraphStore())
    await act(async () => {
      await result.current.fetchRelationships({ entity_id: 1, entity_type: 'character' })
    })
    expect(result.current.relationships).toBeDefined()
    expect(result.current.loading).toBe(false)
  })

  it('should fetch visualization', async () => {
    const { graphApi } = await import('@/api/graph')
    vi.mocked(graphApi.getGraphVisualization).mockResolvedValueOnce({
      nodes: [{ id: 1 }],
      edges: [],
    } as any)

    const { result } = renderHook(() => useGraphStore())
    await act(async () => {
      await result.current.fetchVisualization(1)
    })
    expect(result.current.visualization).toBeDefined()
  })

  it('should fetch multi-hop query result', async () => {
    const { graphApi } = await import('@/api/graph')
    vi.mocked(graphApi.multiHopQuery).mockResolvedValueOnce({
      paths: [{ nodes: [1, 2, 3] }],
    } as any)

    const { result } = renderHook(() => useGraphStore())
    await act(async () => {
      await result.current.fetchMultiHop({
        start_entity_id: 1,
        start_entity_type: 'character',
      })
    })
    expect(result.current.multiHopResult).toBeDefined()
  })

  it('should fetch shortest path', async () => {
    const { graphApi } = await import('@/api/graph')
    vi.mocked(graphApi.shortestPath).mockResolvedValueOnce({
      path: [1, 2],
      distance: 1,
    } as any)

    const { result } = renderHook(() => useGraphStore())
    await act(async () => {
      await result.current.fetchShortestPath({
        start_entity_id: 1,
        start_entity_type: 'character',
        end_entity_id: 2,
        end_entity_type: 'item',
      })
    })
    expect(result.current.shortestPathResult).toBeDefined()
  })

  it('should fetch centrality', async () => {
    const { graphApi } = await import('@/api/graph')
    vi.mocked(graphApi.getCentrality).mockResolvedValueOnce({
      rankings: [{ entity_id: 1, score: 0.9 }],
    } as any)

    const { result } = renderHook(() => useGraphStore())
    await act(async () => {
      await result.current.fetchCentrality()
    })
    expect(result.current.centralityResult).toBeDefined()
  })

  it('should fetch clusters', async () => {
    const { graphApi } = await import('@/api/graph')
    vi.mocked(graphApi.getClusters).mockResolvedValueOnce({
      clusters: [{ id: 0, members: [1, 2] }],
    } as any)

    const { result } = renderHook(() => useGraphStore())
    await act(async () => {
      await result.current.fetchClusters()
    })
    expect(result.current.clusters).toBeDefined()
  })

  it('should fetch duplicates', async () => {
    const { graphApi } = await import('@/api/graph')
    vi.mocked(graphApi.findDuplicates).mockResolvedValueOnce({
      duplicates: [{ entity1_id: 1, entity2_id: 2, similarity: 0.95 }],
    } as any)

    const { result } = renderHook(() => useGraphStore())
    await act(async () => {
      await result.current.fetchDuplicates({ entity_type: 'character' })
    })
    expect(result.current.duplicates).toHaveLength(1)
  })

  it('should select and deselect a node', () => {
    const { result } = renderHook(() => useGraphStore())
    const node = { id: 1, type: 'character', label: 'Alice' } as any

    act(() => {
      result.current.selectNode(node)
    })
    expect(result.current.selectedNode).toEqual(node)

    act(() => {
      result.current.clearSelection()
    })
    expect(result.current.selectedNode).toBeNull()
  })

  it('should reset all state', () => {
    const { result } = renderHook(() => useGraphStore())
    act(() => {
      result.current.selectNode({ id: 1 } as any)
    })
    expect(result.current.selectedNode).not.toBeNull()

    act(() => {
      result.current.reset()
    })
    expect(result.current.entities).toEqual([])
    expect(result.current.selectedNode).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})

describe('graphStore selectors', () => {
  it('selectGraphEntities returns entities', () => {
    const state = { entities: [{ id: 1 }] } as any
    expect(selectGraphEntities(state)).toHaveLength(1)
  })

  it('selectGraphVisualization returns visualization', () => {
    const state = { visualization: { nodes: [] } } as any
    expect(selectGraphVisualization(state)).toBeDefined()
  })

  it('selectGraphSelectedNode returns selected node', () => {
    const state = { selectedNode: { id: 1 } } as any
    expect(selectGraphSelectedNode(state)).toEqual({ id: 1 })
  })

  it('selectGraphLoading returns loading flag', () => {
    expect(selectGraphLoading({ loading: true } as any)).toBe(true)
    expect(selectGraphLoading({ loading: false } as any)).toBe(false)
  })

  it('selectGraphError returns error string', () => {
    expect(selectGraphError({ error: 'fail' } as any)).toBe('fail')
    expect(selectGraphError({ error: null } as any)).toBeNull()
  })

  it('selectGraphClusters returns clusters', () => {
    const state = { clusters: { clusters: [] } } as any
    expect(selectGraphClusters(state)).toBeDefined()
  })

  it('selectGraphDuplicates returns duplicates array', () => {
    const state = { duplicates: [{ entity1_id: 1 }] } as any
    expect(selectGraphDuplicates(state)).toHaveLength(1)
  })

  it('cleanupGraphStore resets state to initial', () => {
    useGraphStore.setState({ loading: true, error: 'err', entities: [{ id: 1 }] as any } as any)
    cleanupGraphStore()
    const state = useGraphStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.entities).toEqual([])
  })
})
