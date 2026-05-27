import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useContextStore, selectContextPack, selectContextChunks, selectContextStats, selectContextWeights, selectLastQuery, selectContextLoading, selectContextError, cleanupContextStore } from '@/store/contextStore'

// Mock API modules
vi.mock('@/api/context', () => ({
  contextApi: {
    buildContext: vi.fn().mockResolvedValue({ chapter_id: 1, sections: {}, meta: {}, weights: {} }),
    indexChapter: vi.fn().mockResolvedValue({}),
    queryContext: vi.fn().mockResolvedValue({ results: [], strategy: 'auto' }),
    getChunks: vi.fn().mockResolvedValue({ chunks: [] }),
    deleteChunks: vi.fn().mockResolvedValue({}),
    getContextStats: vi.fn().mockResolvedValue({ total_chunks: 0, total_size: 0 }),
  },
}))

vi.mock('@/api/contextRank', () => ({
  contextRankApi: {
    rankContextPack: vi.fn().mockResolvedValue({ ranked_pack: {} }),
    getContextWeights: vi.fn().mockResolvedValue({ entity_weights: {}, template_weights: {} }),
    updateContextWeights: vi.fn().mockResolvedValue({ entity_weights: {}, template_weights: {} }),
    detectIntent: vi.fn().mockResolvedValue({ intent: 'continue', confidence: 0.9 }),
  },
}))

vi.mock('@/store/utils/indexedDBStorage', () => ({
  createHybridStorage: () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('contextStore', () => {
  beforeEach(() => {
    useContextStore.setState({
      contextPack: null,
      chunks: [],
      stats: null,
      weights: null,
      lastQuery: null,
      lastIntent: null,
      loading: false,
      error: null,
    })
  })

  it('should have initial state', () => {
    const { result } = renderHook(() => useContextStore())
    expect(result.current.contextPack).toBeNull()
    expect(result.current.chunks).toEqual([])
    expect(result.current.stats).toBeNull()
    expect(result.current.weights).toBeNull()
    expect(result.current.lastQuery).toBeNull()
    expect(result.current.lastIntent).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should expose all actions', () => {
    const { result } = renderHook(() => useContextStore())
    expect(typeof result.current.buildContext).toBe('function')
    expect(typeof result.current.indexChapter).toBe('function')
    expect(typeof result.current.queryContext).toBe('function')
    expect(typeof result.current.fetchChunks).toBe('function')
    expect(typeof result.current.deleteChunks).toBe('function')
    expect(typeof result.current.fetchStats).toBe('function')
    expect(typeof result.current.rankContext).toBe('function')
    expect(typeof result.current.fetchWeights).toBe('function')
    expect(typeof result.current.updateWeights).toBe('function')
    expect(typeof result.current.detectIntent).toBe('function')
    expect(typeof result.current.reset).toBe('function')
  })

  it('should build context pack', async () => {
    const { contextApi } = await import('@/api/context')
    vi.mocked(contextApi.buildContext).mockResolvedValueOnce({
      chapter_id: 1,
      sections: { characters: ['Alice'] },
      meta: { version: '1.0' },
      weights: { character: 0.8 },
    } as any)

    const { result } = renderHook(() => useContextStore())
    await act(async () => {
      await result.current.buildContext(1, 5000)
    })
    expect(result.current.contextPack).toBeDefined()
    expect(result.current.contextPack?.chapter_id).toBe(1)
    expect(result.current.loading).toBe(false)
  })

  it('should handle buildContext error', async () => {
    const { contextApi } = await import('@/api/context')
    vi.mocked(contextApi.buildContext).mockRejectedValueOnce(new Error('Build failed'))

    const { result } = renderHook(() => useContextStore())
    await act(async () => {
      await result.current.buildContext(1)
    })
    expect(result.current.error).toBe('Build failed')
    expect(result.current.loading).toBe(false)
  })

  it('should index a chapter', async () => {
    const { contextApi } = await import('@/api/context')
    vi.mocked(contextApi.indexChapter).mockResolvedValueOnce({} as any)

    const { result } = renderHook(() => useContextStore())
    await act(async () => {
      await result.current.indexChapter(1, 'Chapter content here', 'Summary')
    })
    expect(contextApi.indexChapter).toHaveBeenCalledWith(1, { content: 'Chapter content here', summary: 'Summary' })
    expect(result.current.loading).toBe(false)
  })

  it('should query context', async () => {
    const { contextApi } = await import('@/api/context')
    vi.mocked(contextApi.queryContext).mockResolvedValueOnce({
      results: [{ chunk_id: 'c1', score: 0.95 }],
      strategy: 'auto',
    } as any)

    const { result } = renderHook(() => useContextStore())
    await act(async () => {
      await result.current.queryContext({ query: 'Find the battle scene' })
    })
    expect(result.current.lastQuery).toBeDefined()
    expect(result.current.loading).toBe(false)
  })

  it('should fetch chunks for a chapter', async () => {
    const { contextApi } = await import('@/api/context')
    vi.mocked(contextApi.getChunks).mockResolvedValueOnce({
      chunks: [{ chapter_id: 1, chunk_id: 'c1', content: 'text' }],
    } as any)

    const { result } = renderHook(() => useContextStore())
    await act(async () => {
      await result.current.fetchChunks(1)
    })
    expect(result.current.chunks).toHaveLength(1)
    expect(result.current.loading).toBe(false)
  })

  it('should delete chunks for a chapter', async () => {
    const { contextApi } = await import('@/api/context')
    vi.mocked(contextApi.deleteChunks).mockResolvedValueOnce({} as any)

    useContextStore.setState({
      chunks: [
        { chapter_id: 1, chunk_id: 'c1' },
        { chapter_id: 2, chunk_id: 'c2' },
      ],
    } as any)

    const { result } = renderHook(() => useContextStore())
    await act(async () => {
      await result.current.deleteChunks(1)
    })
    expect(result.current.chunks).toHaveLength(1)
    expect(result.current.chunks[0].chapter_id).toBe(2)
  })

  it('should fetch stats', async () => {
    const { contextApi } = await import('@/api/context')
    vi.mocked(contextApi.getContextStats).mockResolvedValueOnce({
      total_chunks: 42,
      total_size: 102400,
    } as any)

    const { result } = renderHook(() => useContextStore())
    await act(async () => {
      await result.current.fetchStats()
    })
    expect(result.current.stats).toBeDefined()
    expect(result.current.stats?.total_chunks).toBe(42)
  })

  it('should fetch weights', async () => {
    const { contextRankApi } = await import('@/api/contextRank')
    vi.mocked(contextRankApi.getContextWeights).mockResolvedValueOnce({
      entity_weights: { character: 0.8 },
      template_weights: {},
    } as any)

    const { result } = renderHook(() => useContextStore())
    await act(async () => {
      await result.current.fetchWeights()
    })
    expect(result.current.weights).toBeDefined()
    expect(result.current.weights?.entity_weights?.character).toBe(0.8)
  })

  it('should update weights', async () => {
    const { contextRankApi } = await import('@/api/contextRank')
    vi.mocked(contextRankApi.updateContextWeights).mockResolvedValueOnce({
      entity_weights: { character: 0.9 },
    } as any)

    const { result } = renderHook(() => useContextStore())
    await act(async () => {
      await result.current.updateWeights({ entity_weights: { character: 0.9 } })
    })
    expect(result.current.weights).toBeDefined()
  })

  it('should detect intent', async () => {
    const { contextRankApi } = await import('@/api/contextRank')
    vi.mocked(contextRankApi.detectIntent).mockResolvedValueOnce({
      intent: 'battle',
      confidence: 0.85,
    } as any)

    const { result } = renderHook(() => useContextStore())
    await act(async () => {
      await result.current.detectIntent('Write a battle scene')
    })
    expect(result.current.lastIntent).toBeDefined()
    expect(result.current.lastIntent?.intent).toBe('battle')
  })

  it('should reset all state', () => {
    const { result } = renderHook(() => useContextStore())
    act(() => {
      useContextStore.setState({
        contextPack: { chapter_id: 1 } as any,
        chunks: [{ chapter_id: 1 }] as any,
        stats: { total_chunks: 10 } as any,
        loading: true,
        error: 'err',
      })
    })

    act(() => {
      result.current.reset()
    })
    expect(result.current.contextPack).toBeNull()
    expect(result.current.chunks).toEqual([])
    expect(result.current.stats).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})

describe('contextStore selectors', () => {
  it('selectContextPack returns context pack', () => {
    const state = { contextPack: { chapter_id: 1 } } as any
    expect(selectContextPack(state)).toEqual({ chapter_id: 1 })
  })

  it('selectContextChunks returns chunks array', () => {
    const state = { chunks: [{ chapter_id: 1 }] } as any
    expect(selectContextChunks(state)).toHaveLength(1)
  })

  it('selectContextStats returns stats', () => {
    const state = { stats: { total_chunks: 5 } } as any
    expect(selectContextStats(state)?.total_chunks).toBe(5)
  })

  it('selectContextWeights returns weights', () => {
    const state = { weights: { entity_weights: {} } } as any
    expect(selectContextWeights(state)).toBeDefined()
  })

  it('selectLastQuery returns last query', () => {
    const state = { lastQuery: { results: [] } } as any
    expect(selectLastQuery(state)).toBeDefined()
  })

  it('selectContextLoading returns loading flag', () => {
    expect(selectContextLoading({ loading: true } as any)).toBe(true)
    expect(selectContextLoading({ loading: false } as any)).toBe(false)
  })

  it('selectContextError returns error', () => {
    expect(selectContextError({ error: 'fail' } as any)).toBe('fail')
    expect(selectContextError({ error: null } as any)).toBeNull()
  })

  it('cleanupContextStore resets to initial state', () => {
    useContextStore.setState({ loading: true, error: 'err', contextPack: { chapter_id: 1 } as any })
    cleanupContextStore()
    const state = useContextStore.getState()
    expect(state.loading).toBe(false)
    expect(state.error).toBeNull()
    expect(state.contextPack).toBeNull()
  })
})
