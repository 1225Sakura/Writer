import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useMessageStore, selectMessageCount, selectIsEmptySession, selectUserMessages, selectAssistantMessages } from '@/store/messageStore'

// Mock API modules
vi.mock('@/api/chat', () => ({
  messageApi: {
    send: vi.fn().mockResolvedValue({
      ai_message: {
        id: 1,
        content: 'AI reply',
        role: 'assistant',
        created_at: new Date().toISOString(),
      },
    }),
    list: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('@/store/utils/indexedDBStorage', () => ({
  createHybridStorage: () => ({
    getItem: vi.fn().mockResolvedValue(null),
    setItem: vi.fn().mockResolvedValue(undefined),
    removeItem: vi.fn().mockResolvedValue(undefined),
  }),
}))

describe('messageStore', () => {
  beforeEach(() => {
    useMessageStore.setState({
      messages: [],
      isStreaming: false,
      currentStreamContent: '',
      streamAbortController: null,
      isLoading: false,
      error: null,
      messageCache: { messages: {}, cachedAt: {} },
    })
  })

  it('should have initial state', () => {
    const { result } = renderHook(() => useMessageStore())
    expect(result.current.messages).toEqual([])
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.currentStreamContent).toBe('')
    expect(result.current.streamAbortController).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.messageCache).toEqual({ messages: {}, cachedAt: {} })
  })

  it('should expose key actions', () => {
    const { result } = renderHook(() => useMessageStore())
    expect(typeof result.current.sendMessage).toBe('function')
    expect(typeof result.current.loadMessages).toBe('function')
    expect(typeof result.current.editMessage).toBe('function')
    expect(typeof result.current.deleteMessage).toBe('function')
    expect(typeof result.current.retryMessage).toBe('function')
    expect(typeof result.current.updateStreamingContent).toBe('function')
    expect(typeof result.current.finishStreaming).toBe('function')
    expect(typeof result.current.abortStreaming).toBe('function')
    expect(typeof result.current.setMessages).toBe('function')
    expect(typeof result.current.addMessage).toBe('function')
    expect(typeof result.current.clearMessageCache).toBe('function')
    expect(typeof result.current.getCachedMessages).toBe('function')
    expect(typeof result.current.updateCacheForSession).toBe('function')
  })

  it('should set messages directly', () => {
    const { result } = renderHook(() => useMessageStore())
    const msgs = [
      { id: 'm1', role: 'user' as const, content: 'Hello', createdAt: Date.now() },
      { id: 'm2', role: 'assistant' as const, content: 'Hi', createdAt: Date.now() },
    ]
    act(() => {
      result.current.setMessages(msgs)
    })
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.messages[0].content).toBe('Hello')
  })

  it('should add a single message', () => {
    const { result } = renderHook(() => useMessageStore())
    act(() => {
      result.current.addMessage({ id: 'new1', role: 'user', content: 'Test', createdAt: Date.now() })
    })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].id).toBe('new1')
  })

  it('should edit a message', () => {
    useMessageStore.setState({
      messages: [{ id: 'edit1', role: 'user', content: 'Old', createdAt: Date.now() }],
    } as any)

    const { result } = renderHook(() => useMessageStore())
    act(() => {
      result.current.editMessage('edit1', 'New content')
    })
    expect(result.current.messages[0].content).toBe('New content')
    expect(result.current.messages[0].editedAt).toBeDefined()
  })

  it('should delete a message', () => {
    useMessageStore.setState({
      messages: [
        { id: 'del1', role: 'user', content: 'A', createdAt: Date.now() },
        { id: 'del2', role: 'assistant', content: 'B', createdAt: Date.now() },
      ],
    } as any)

    const { result } = renderHook(() => useMessageStore())
    act(() => {
      result.current.deleteMessage('del1')
    })
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.messages[0].id).toBe('del2')
  })

  it('should update streaming content', () => {
    const { result } = renderHook(() => useMessageStore())
    act(() => {
      result.current.updateStreamingContent('Partial reply...')
    })
    expect(result.current.currentStreamContent).toBe('Partial reply...')
  })

  it('should finish streaming and create assistant message', () => {
    const { result } = renderHook(() => useMessageStore())
    act(() => {
      result.current.updateStreamingContent('Complete reply')
    })
    let finishedMsg: any
    act(() => {
      finishedMsg = result.current.finishStreaming()
    })
    expect(finishedMsg).toBeDefined()
    expect(finishedMsg.role).toBe('assistant')
    expect(finishedMsg.content).toBe('Complete reply')
    expect(result.current.messages).toHaveLength(1)
    expect(result.current.currentStreamContent).toBe('')
    expect(result.current.isStreaming).toBe(false)
  })

  it('should return null from finishStreaming when no content', () => {
    const { result } = renderHook(() => useMessageStore())
    let finishedMsg: any
    act(() => {
      finishedMsg = result.current.finishStreaming()
    })
    expect(finishedMsg).toBeNull()
  })

  it('should abort streaming', () => {
    const { result } = renderHook(() => useMessageStore())
    const mockAbort = vi.fn()
    act(() => {
      useMessageStore.setState({
        isStreaming: true,
        currentStreamContent: 'partial',
        streamAbortController: { abort: mockAbort } as any,
      })
    })

    act(() => {
      result.current.abortStreaming()
    })
    expect(result.current.isStreaming).toBe(false)
    expect(result.current.currentStreamContent).toBe('')
    expect(result.current.streamAbortController).toBeNull()
  })

  it('should send a message and receive reply', async () => {
    const { messageApi } = await import('@/api/chat')
    vi.mocked(messageApi.send).mockResolvedValueOnce({
      ai_message: {
        id: 10,
        content: 'AI says hello',
        role: 'assistant',
        created_at: '2026-01-01T00:00:00Z',
      },
    } as any)

    const { result } = renderHook(() => useMessageStore())
    await act(async () => {
      await result.current.sendMessage(1, 'Hello AI')
    })
    // Should have user message + assistant message
    expect(result.current.messages.length).toBeGreaterThanOrEqual(2)
    expect(result.current.isStreaming).toBe(false)
  })

  it('should handle sendMessage error', async () => {
    const { messageApi } = await import('@/api/chat')
    vi.mocked(messageApi.send).mockRejectedValueOnce(new Error('Network error'))

    const { result } = renderHook(() => useMessageStore())
    await act(async () => {
      await result.current.sendMessage(1, 'Hello')
    })
    expect(result.current.error).toBe('Network error')
    expect(result.current.isStreaming).toBe(false)
    // The user message should be marked as failed
    const userMsg = result.current.messages.find((m) => m.role === 'user')
    expect(userMsg?.failed).toBe(true)
  })

  it('should load messages from backend', async () => {
    const { messageApi } = await import('@/api/chat')
    vi.mocked(messageApi.list).mockResolvedValueOnce([
      { id: 1, role: 'user', content: 'Q', created_at: '2026-01-01T00:00:00Z' },
      { id: 2, role: 'assistant', content: 'A', created_at: '2026-01-01T00:01:00Z' },
    ] as any)

    const { result } = renderHook(() => useMessageStore())
    await act(async () => {
      await result.current.loadMessages(1)
    })
    expect(result.current.messages).toHaveLength(2)
    expect(result.current.isLoading).toBe(false)
  })

  it('should manage message cache', () => {
    const { result } = renderHook(() => useMessageStore())
    const msgs = [{ id: 'c1', role: 'user' as const, content: 'cached', createdAt: Date.now() }]

    act(() => {
      result.current.updateCacheForSession(5, msgs)
    })
    expect(result.current.getCachedMessages(5)).toEqual(msgs)

    act(() => {
      result.current.clearMessageCache()
    })
    expect(result.current.getCachedMessages(5)).toBeUndefined()
    expect(result.current.messageCache).toEqual({ messages: {}, cachedAt: {} })
  })
})

describe('messageStore selectors', () => {
  it('selectMessageCount returns count', () => {
    const state = { messages: [{ id: '1' }, { id: '2' }] } as any
    expect(selectMessageCount(state)).toBe(2)
  })

  it('selectIsEmptySession returns true when no messages', () => {
    expect(selectIsEmptySession({ messages: [] } as any)).toBe(true)
    expect(selectIsEmptySession({ messages: [{ id: '1' }] } as any)).toBe(false)
  })

  it('selectUserMessages filters user messages', () => {
    const state = {
      messages: [
        { id: '1', role: 'user' },
        { id: '2', role: 'assistant' },
        { id: '3', role: 'user' },
      ],
    } as any
    expect(selectUserMessages(state)).toHaveLength(2)
  })

  it('selectAssistantMessages filters assistant messages', () => {
    const state = {
      messages: [
        { id: '1', role: 'user' },
        { id: '2', role: 'assistant' },
        { id: '3', role: 'assistant' },
      ],
    } as any
    expect(selectAssistantMessages(state)).toHaveLength(2)
  })
})
