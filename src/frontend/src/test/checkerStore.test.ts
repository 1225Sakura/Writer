import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCheckerStore, selectCheckerResults, selectCheckerLoading, selectCheckerError, cleanupCheckerStore } from '@/store/checkerStore'

// Mock API modules
vi.mock('@/api/writing', () => ({
  checkerApi: {
    consistency: vi.fn().mockResolvedValue({ issues: [], suggestions: [] }),
    continuity: vi.fn().mockResolvedValue({ issues: [], suggestions: [] }),
    pacing: vi.fn().mockResolvedValue({ score: 80, issues: [] }),
    ooc: vi.fn().mockResolvedValue({ violations: [], warnings: [] }),
    highPoint: vi.fn().mockResolvedValue({ high_points: [], suggestions: [] }),
    readerPull: vi.fn().mockResolvedValue({ score: 85, factors: [] }),
  },
}))

vi.mock('@/utils/toastHelper', () => ({
  showOperationError: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

describe('checkerStore', () => {
  beforeEach(() => {
    useCheckerStore.setState({
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
      loading: { checkers: false },
      error: null,
    })
  })

  it('should have initial state', () => {
    const { result } = renderHook(() => useCheckerStore())
    expect(result.current.checkerResults.consistency).toBeNull()
    expect(result.current.checkerResults.continuity).toBeNull()
    expect(result.current.checkerResults.pacing).toBeNull()
    expect(result.current.checkerResults.ooc).toBeNull()
    expect(result.current.checkerResults.highPoint).toBeNull()
    expect(result.current.checkerResults.readerPull).toBeNull()
    expect(result.current.oocWarnings).toEqual([])
    expect(result.current.powerImbalanceWarnings).toEqual([])
    expect(result.current.loading.checkers).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should expose all checker actions', () => {
    const { result } = renderHook(() => useCheckerStore())
    expect(typeof result.current.runConsistencyCheck).toBe('function')
    expect(typeof result.current.runContinuityCheck).toBe('function')
    expect(typeof result.current.runPacingCheck).toBe('function')
    expect(typeof result.current.runOOCCheck).toBe('function')
    expect(typeof result.current.runHighPointCheck).toBe('function')
    expect(typeof result.current.runReaderPullCheck).toBe('function')
    expect(typeof result.current.runAllChecks).toBe('function')
    expect(typeof result.current.clearCheckerResults).toBe('function')
    expect(typeof result.current.setOOCWarnings).toBe('function')
    expect(typeof result.current.setPowerImbalanceWarnings).toBe('function')
    expect(typeof result.current.clearWarnings).toBe('function')
  })

  it('should run consistency check and store result', async () => {
    const { checkerApi } = await import('@/api/writing')
    vi.mocked(checkerApi.consistency).mockResolvedValueOnce({
      issues: ['Timeline conflict at ch3'],
      suggestions: ['Fix timeline'],
    } as any)

    const { result } = renderHook(() => useCheckerStore())
    let checkResult: any
    await act(async () => {
      checkResult = await result.current.runConsistencyCheck(1)
    })

    expect(checkResult).toBeDefined()
    expect(checkResult.issues).toHaveLength(1)
    expect(result.current.checkerResults.consistency).toBeDefined()
    expect(result.current.loading.checkers).toBe(false)
  })

  it('should run continuity check', async () => {
    const { checkerApi } = await import('@/api/writing')
    vi.mocked(checkerApi.continuity).mockResolvedValueOnce({
      issues: [],
      suggestions: ['Good continuity'],
    } as any)

    const { result } = renderHook(() => useCheckerStore())
    let checkResult: any
    await act(async () => {
      checkResult = await result.current.runContinuityCheck(1)
    })
    expect(checkResult).toBeDefined()
    expect(result.current.checkerResults.continuity).toBeDefined()
  })

  it('should run pacing check', async () => {
    const { checkerApi } = await import('@/api/writing')
    vi.mocked(checkerApi.pacing).mockResolvedValueOnce({
      score: 75,
      issues: ['Too slow in middle'],
    } as any)

    const { result } = renderHook(() => useCheckerStore())
    let checkResult: any
    await act(async () => {
      checkResult = await result.current.runPacingCheck(1)
    })
    expect(checkResult?.score).toBe(75)
    expect(result.current.checkerResults.pacing).toBeDefined()
  })

  it('should run OOC check and populate warnings', async () => {
    const { checkerApi } = await import('@/api/writing')
    vi.mocked(checkerApi.ooc).mockResolvedValueOnce({
      violations: [
        { location: 'ch3:p5', reason: 'Wrong speech', expected_behavior: 'Calm', actual_behavior: 'Aggressive' },
      ],
      warnings: [],
    } as any)

    const { result } = renderHook(() => useCheckerStore())
    let checkResult: any
    await act(async () => {
      checkResult = await result.current.runOOCCheck(1, 5)
    })
    expect(checkResult?.violations).toHaveLength(1)
    expect(result.current.oocWarnings.length).toBeGreaterThan(0)
    expect(result.current.oocWarnings[0]).toContain('ch3:p5')
  })

  it('should run high point check', async () => {
    const { checkerApi } = await import('@/api/writing')
    vi.mocked(checkerApi.highPoint).mockResolvedValueOnce({
      high_points: ['Battle scene'],
      suggestions: [],
    } as any)

    const { result } = renderHook(() => useCheckerStore())
    await act(async () => {
      await result.current.runHighPointCheck(1)
    })
    expect(result.current.checkerResults.highPoint).toBeDefined()
  })

  it('should run reader pull check', async () => {
    const { checkerApi } = await import('@/api/writing')
    vi.mocked(checkerApi.readerPull).mockResolvedValueOnce({
      score: 90,
      factors: ['Strong opening'],
    } as any)

    const { result } = renderHook(() => useCheckerStore())
    let checkResult: any
    await act(async () => {
      checkResult = await result.current.runReaderPullCheck(1)
    })
    expect(checkResult?.score).toBe(90)
  })

  it('should handle checker API errors', async () => {
    const { checkerApi } = await import('@/api/writing')
    vi.mocked(checkerApi.consistency).mockRejectedValueOnce(new Error('API timeout'))

    const { result } = renderHook(() => useCheckerStore())
    let checkResult: any
    await act(async () => {
      checkResult = await result.current.runConsistencyCheck(1)
    })
    expect(checkResult).toBeNull()
    expect(result.current.error).toBe('API timeout')
    expect(result.current.loading.checkers).toBe(false)
  })

  it('should run all checks via runAllChecks', async () => {
    const { checkerApi } = await import('@/api/writing')
    vi.mocked(checkerApi.consistency).mockResolvedValueOnce({ issues: [], suggestions: [] } as any)
    vi.mocked(checkerApi.continuity).mockResolvedValueOnce({ issues: [], suggestions: [] } as any)
    vi.mocked(checkerApi.pacing).mockResolvedValueOnce({ score: 80, issues: [] } as any)
    vi.mocked(checkerApi.highPoint).mockResolvedValueOnce({ high_points: [], suggestions: [] } as any)
    vi.mocked(checkerApi.readerPull).mockResolvedValueOnce({ score: 85, factors: [] } as any)

    const { result } = renderHook(() => useCheckerStore())
    await act(async () => {
      await result.current.runAllChecks(1)
    })
    expect(result.current.checkerResults.consistency).toBeDefined()
    expect(result.current.checkerResults.continuity).toBeDefined()
    expect(result.current.checkerResults.pacing).toBeDefined()
    expect(result.current.checkerResults.highPoint).toBeDefined()
    expect(result.current.checkerResults.readerPull).toBeDefined()
    expect(result.current.loading.checkers).toBe(false)
  })

  it('should clear checker results', () => {
    const { result } = renderHook(() => useCheckerStore())
    act(() => {
      result.current.setOOCWarnings(['warn1'])
      result.current.setPowerImbalanceWarnings(['warn2'])
    })
    expect(result.current.oocWarnings).toEqual(['warn1'])
    expect(result.current.powerImbalanceWarnings).toEqual(['warn2'])

    act(() => {
      result.current.clearCheckerResults()
    })
    expect(result.current.checkerResults.consistency).toBeNull()
    expect(result.current.oocWarnings).toEqual([])
    expect(result.current.powerImbalanceWarnings).toEqual([])
  })

  it('should set and clear warnings independently', () => {
    const { result } = renderHook(() => useCheckerStore())
    act(() => {
      result.current.setOOCWarnings(['ooc1', 'ooc2'])
      result.current.setPowerImbalanceWarnings(['power1'])
    })
    expect(result.current.oocWarnings).toEqual(['ooc1', 'ooc2'])
    expect(result.current.powerImbalanceWarnings).toEqual(['power1'])

    act(() => {
      result.current.clearWarnings()
    })
    expect(result.current.oocWarnings).toEqual([])
    expect(result.current.powerImbalanceWarnings).toEqual([])
  })
})

describe('checkerStore selectors and cleanup', () => {
  it('selectCheckerResults returns results object', () => {
    const state = {
      checkerResults: { consistency: { issues: [] }, continuity: null, pacing: null, ooc: null, highPoint: null, readerPull: null },
    } as any
    expect(selectCheckerResults(state).consistency).toBeDefined()
  })

  it('selectCheckerLoading returns boolean', () => {
    const state = { loading: { checkers: true } } as any
    expect(selectCheckerLoading(state)).toBe(true)
  })

  it('selectCheckerError returns error string', () => {
    const state = { error: 'fail' } as any
    expect(selectCheckerError(state)).toBe('fail')
  })

  it('cleanupCheckerStore resets loading and error', () => {
    useCheckerStore.setState({ loading: { checkers: true }, error: 'some error' } as any)
    cleanupCheckerStore()
    const state = useCheckerStore.getState()
    expect(state.loading.checkers).toBe(false)
    expect(state.error).toBeNull()
  })
})
