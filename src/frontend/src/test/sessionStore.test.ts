import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSessionStore, selectCurrentSession, selectSessionCount, selectSessionStatus, cleanupSessionStore } from '@/store/sessionStore'

// Mock API modules
vi.mock('@/api/chat', () => ({
  sessionApi: {
    create: vi.fn().mockResolvedValue({ id: 1, created_at: new Date().toISOString() }),
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue({ id: 1 }),
    delete: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/store/utils/indexedDBStorage', () => ({
  createHybridStorage: () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('sessionStore', () => {
  beforeEach(() => {
    useSessionStore.setState({
      sessionId: null,
      sessions: [],
      lastActiveSessionId: null,
      isLoading: false,
      error: null,
    })
  })

  it('should have initial state', () => {
    const { result } = renderHook(() => useSessionStore())
    expect(result.current.sessionId).toBeNull()
    expect(result.current.sessions).toEqual([])
    expect(result.current.lastActiveSessionId).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should expose key actions', () => {
    const { result } = renderHook(() => useSessionStore())
    expect(typeof result.current.createSession).toBe('function')
    expect(typeof result.current.loadSessions).toBe('function')
    expect(typeof result.current.switchSession).toBe('function')
    expect(typeof result.current.clearSession).toBe('function')
    expect(typeof result.current.deleteSession).toBe('function')
    expect(typeof result.current.setSessionId).toBe('function')
  })

  it('should create a session', async () => {
    const { sessionApi } = await import('@/api/chat')
    vi.mocked(sessionApi.create).mockResolvedValueOnce({
      id: 42,
      created_at: '2026-01-01T00:00:00Z',
    } as any)

    const { result } = renderHook(() => useSessionStore())
    await act(async () => {
      await result.current.createSession()
    })
    expect(result.current.sessionId).toBe(42)
    expect(result.current.lastActiveSessionId).toBe(42)
    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].id).toBe(42)
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle createSession error', async () => {
    const { sessionApi } = await import('@/api/chat')
    vi.mocked(sessionApi.create).mockRejectedValueOnce(new Error('Server down'))

    const { result } = renderHook(() => useSessionStore())
    await act(async () => {
      await result.current.createSession()
    })
    expect(result.current.error).toBe('Server down')
    expect(result.current.isLoading).toBe(false)
    expect(result.current.sessionId).toBeNull()
  })

  it('should load sessions', async () => {
    const { sessionApi } = await import('@/api/chat')
    vi.mocked(sessionApi.list).mockResolvedValueOnce([
      { id: 1, created_at: '2026-01-01' },
      { id: 2, created_at: '2026-01-02' },
    ] as any)

    const { result } = renderHook(() => useSessionStore())
    await act(async () => {
      await result.current.loadSessions()
    })
    expect(result.current.sessions).toHaveLength(2)
    expect(result.current.isLoading).toBe(false)
  })

  it('should handle loadSessions error', async () => {
    const { sessionApi } = await import('@/api/chat')
    vi.mocked(sessionApi.list).mockRejectedValueOnce(new Error('Timeout'))

    const { result } = renderHook(() => useSessionStore())
    await act(async () => {
      await result.current.loadSessions()
    })
    expect(result.current.error).toBe('Timeout')
    expect(result.current.isLoading).toBe(false)
  })

  it('should switch session', () => {
    const { result } = renderHook(() => useSessionStore())
    act(() => {
      result.current.switchSession(5)
    })
    expect(result.current.sessionId).toBe(5)
    expect(result.current.lastActiveSessionId).toBe(5)
  })

  it('should clear session', () => {
    useSessionStore.setState({ sessionId: 10 } as any)
    const { result } = renderHook(() => useSessionStore())
    act(() => {
      result.current.clearSession()
    })
    expect(result.current.sessionId).toBeNull()
  })

  it('should delete a session', async () => {
    const { sessionApi } = await import('@/api/chat')
    vi.mocked(sessionApi.delete).mockResolvedValueOnce({} as any)

    useSessionStore.setState({
      sessionId: 1,
      sessions: [{ id: 1, created_at: 'a' }, { id: 2, created_at: 'b' }],
    } as any)

    const { result } = renderHook(() => useSessionStore())
    await act(async () => {
      await result.current.deleteSession(1)
    })
    expect(result.current.sessions).toHaveLength(1)
    expect(result.current.sessions[0].id).toBe(2)
    // sessionId should be cleared because we deleted the active session
    expect(result.current.sessionId).toBeNull()
  })

  it('should handle deleteSession error', async () => {
    const { sessionApi } = await import('@/api/chat')
    vi.mocked(sessionApi.delete).mockRejectedValueOnce(new Error('Forbidden'))

    useSessionStore.setState({
      sessions: [{ id: 1, created_at: 'a' }],
    } as any)

    const { result } = renderHook(() => useSessionStore())
    await act(async () => {
      await result.current.deleteSession(1)
    })
    expect(result.current.error).toBe('Forbidden')
    // Session should NOT be removed from list
    expect(result.current.sessions).toHaveLength(1)
  })

  it('should not clear sessionId when deleting a different session', async () => {
    const { sessionApi } = await import('@/api/chat')
    vi.mocked(sessionApi.delete).mockResolvedValueOnce({} as any)

    useSessionStore.setState({
      sessionId: 1,
      sessions: [{ id: 1, created_at: 'a' }, { id: 2, created_at: 'b' }],
    } as any)

    const { result } = renderHook(() => useSessionStore())
    await act(async () => {
      await result.current.deleteSession(2)
    })
    expect(result.current.sessionId).toBe(1)
    expect(result.current.sessions).toHaveLength(1)
  })

  it('should set session id directly', () => {
    const { result } = renderHook(() => useSessionStore())
    act(() => {
      result.current.setSessionId(99)
    })
    expect(result.current.sessionId).toBe(99)

    act(() => {
      result.current.setSessionId(null)
    })
    expect(result.current.sessionId).toBeNull()
  })
})

describe('sessionStore selectors', () => {
  it('selectCurrentSession returns the active session', () => {
    const state = {
      sessionId: 2,
      sessions: [{ id: 1, name: 'a' }, { id: 2, name: 'b' }],
    } as any
    const session = selectCurrentSession(state)
    expect(session?.id).toBe(2)
    expect(session?.name).toBe('b')
  })

  it('selectCurrentSession returns undefined when no session', () => {
    const state = { sessionId: null, sessions: [] } as any
    expect(selectCurrentSession(state)).toBeUndefined()
  })

  it('selectSessionCount returns count', () => {
    const state = { sessions: [{ id: 1 }, { id: 2 }, { id: 3 }] } as any
    expect(selectSessionCount(state)).toBe(3)
  })

  it('selectSessionStatus returns loading/error', () => {
    const state = { isLoading: true, error: 'err' } as any
    const status = selectSessionStatus(state)
    expect(status.isLoading).toBe(true)
    expect(status.error).toBe('err')
  })

  it('cleanupSessionStore resets loading and error', () => {
    useSessionStore.setState({ isLoading: true, error: 'some err' } as any)
    cleanupSessionStore()
    const state = useSessionStore.getState()
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })
})
