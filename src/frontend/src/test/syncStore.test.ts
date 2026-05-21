import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { enableMapSet } from 'immer'
import { useSyncStore } from '@/store/syncStore'

// Enable Immer MapSet plugin (required by syncStore)
enableMapSet()

// Mock dependencies
vi.mock('@/api/request', () => ({
  api: {
    post: vi.fn().mockResolvedValue({}),
    get: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/store/utils/indexedDBStorage', () => ({
  createHybridStorage: () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
}))

vi.mock('@/utils/toastHelper', () => ({
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showOperationError: vi.fn(),
}))

describe('syncStore', () => {
  beforeEach(() => {
    // Reset store via setState (avoids Immer frozen-object mutation)
    useSyncStore.setState({
      ifLineSyncStates: new Map(),
      globalSyncMode: 'auto',
      characterProgress: [],
      conflicts: [],
      generationTasks: [],
      isSyncing: false,
      lastGlobalSync: null,
      totalSyncedWords: 0,
      totalGeneratedWords: 0,
    })
  })

  it('should have initial state', () => {
    const { result } = renderHook(() => useSyncStore())
    expect(result.current.ifLineSyncStates).toBeInstanceOf(Map)
    expect(result.current.ifLineSyncStates.size).toBe(0)
    expect(result.current.globalSyncMode).toBe('auto')
    expect(result.current.characterProgress).toEqual([])
    expect(result.current.conflicts).toEqual([])
    expect(result.current.generationTasks).toEqual([])
    expect(result.current.isSyncing).toBe(false)
    expect(result.current.lastGlobalSync).toBeNull()
  })

  it('should expose key actions', () => {
    const { result } = renderHook(() => useSyncStore())
    expect(typeof result.current.registerIFLine).toBe('function')
    expect(typeof result.current.unregisterIFLine).toBe('function')
    expect(typeof result.current.setIFLineSyncStatus).toBe('function')
    expect(typeof result.current.setGlobalSyncMode).toBe('function')
    expect(typeof result.current.triggerGlobalSync).toBe('function')
    expect(typeof result.current.addConflict).toBe('function')
    expect(typeof result.current.resolveConflict).toBe('function')
    expect(typeof result.current.addGenerationTask).toBe('function')
    expect(typeof result.current.syncAllIFLines).toBe('function')
    expect(typeof result.current.pauseAllSync).toBe('function')
    expect(typeof result.current.resumeAllSync).toBe('function')
  })

  it('should register and unregister IF lines', () => {
    const { result } = renderHook(() => useSyncStore())
    act(() => {
      result.current.registerIFLine(1)
    })
    expect(result.current.ifLineSyncStates.has(1)).toBe(true)
    const state = result.current.getIFLineSyncState(1)
    expect(state?.status).toBe('idle')
    expect(state?.autoSync).toBe(true)

    act(() => {
      result.current.unregisterIFLine(1)
    })
    expect(result.current.ifLineSyncStates.has(1)).toBe(false)
  })

  it('should set IF line sync status', () => {
    const { result } = renderHook(() => useSyncStore())
    act(() => {
      result.current.registerIFLine(2)
      result.current.setIFLineSyncStatus(2, 'synced')
    })
    const state = result.current.getIFLineSyncState(2)
    expect(state?.status).toBe('synced')
    expect(state?.lastSyncedAt).toBeGreaterThan(0)
  })

  it('should change global sync mode', () => {
    const { result } = renderHook(() => useSyncStore())
    act(() => {
      result.current.setGlobalSyncMode('paused')
    })
    expect(result.current.globalSyncMode).toBe('paused')
  })

  it('should manage character progress', () => {
    const { result } = renderHook(() => useSyncStore())
    act(() => {
      result.current.updateCharacterProgress({
        characterId: 10,
        characterName: 'Hero',
        currentChapter: 5,
        totalChapters: 20,
        wordCount: 5000,
        lastUpdated: Date.now(),
      })
    })
    const progress = result.current.getCharacterProgress(10)
    expect(progress?.characterName).toBe('Hero')
    expect(progress?.currentChapter).toBe(5)
  })

  it('should manage conflicts', () => {
    const { result } = renderHook(() => useSyncStore())
    let conflictId: string
    act(() => {
      conflictId = result.current.addConflict({
        ifLineId: 3,
        ifLineTitle: 'Test IF',
        mainContent: 'main',
        ifLineContent: 'branch',
      })
    })
    expect(conflictId!).toBeDefined()
    expect(result.current.getUnresolvedConflicts().length).toBe(1)

    act(() => {
      result.current.resolveConflict(conflictId!, 'main')
    })
    expect(result.current.getUnresolvedConflicts().length).toBe(0)
  })

  it('should manage generation tasks', () => {
    const { result } = renderHook(() => useSyncStore())
    let taskId: string
    act(() => {
      taskId = result.current.addGenerationTask({
        ifLineId: 4,
        type: 'continue',
        prompt: 'Continue the story',
      })
    })
    expect(taskId!).toBeDefined()
    expect(result.current.getPendingTasks().length).toBe(1)

    act(() => {
      result.current.cancelTask(taskId!)
    })
    // After cancel, it should no longer be pending
    expect(result.current.getPendingTasks().length).toBe(0)
  })

  it('should pause and resume all sync', () => {
    const { result } = renderHook(() => useSyncStore())
    act(() => {
      result.current.registerIFLine(5)
      result.current.pauseAllSync()
    })
    expect(result.current.globalSyncMode).toBe('paused')
    const state = result.current.getIFLineSyncState(5)
    expect(state?.autoSync).toBe(false)

    act(() => {
      result.current.resumeAllSync()
    })
    expect(result.current.globalSyncMode).toBe('auto')
    const resumedState = result.current.getIFLineSyncState(5)
    expect(resumedState?.autoSync).toBe(true)
  })

  it('should not throw on triggerGlobalSync when paused', async () => {
    const { result } = renderHook(() => useSyncStore())
    act(() => {
      result.current.setGlobalSyncMode('paused')
    })
    await act(async () => {
      await result.current.triggerGlobalSync()
    })
    expect(result.current.isSyncing).toBe(false)
  })

  it('should provide stats', () => {
    const { result } = renderHook(() => useSyncStore())
    act(() => {
      result.current.incrementSyncedWords(100)
      result.current.incrementGeneratedWords(200)
    })
    const stats = result.current.getStats()
    expect(stats.totalSyncedWords).toBeGreaterThanOrEqual(100)
    expect(stats.totalGeneratedWords).toBeGreaterThanOrEqual(200)
  })
})
