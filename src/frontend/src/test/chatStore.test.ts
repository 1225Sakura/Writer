import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatStore } from '@/store/chatStore'

describe('chatStore', () => {
  it('should have initial state', () => {
    const { result } = renderHook(() => useChatStore())
    expect(result.current.sessionId).toBeNull()
    expect(result.current.messages).toEqual([])
    expect(result.current.isStreaming).toBe(false)
  })

  it('should clear session', () => {
    const { result } = renderHook(() => useChatStore())
    act(() => {
      result.current.clearSession()
    })
    expect(result.current.sessionId).toBeNull()
    expect(result.current.messages).toEqual([])
  })
})
