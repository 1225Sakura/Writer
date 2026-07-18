/**
 * US-004 / Phase 0 commit 4 — useChatAutoAdvance hook unit tests.
 *
 * Three cases per plan AC-P0-4.3:
 *   1. 2 turns do NOT trigger interface change
 *   2. 3 turns DO trigger setCurrentInterface('settings')
 *   3. User manually jumps to settings → no repeat trigger on subsequent
 *      sendMessage calls past threshold (idempotent within a session)
 *
 * Plus a fourth assertion that the hook resets its guard once turnCount
 * returns to 0 (e.g. new chat session), so a fresh conversation can
 * auto-advance again.
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatAutoAdvance } from '@/components/chat/useChatAutoAdvance'
import { useChatStore } from '@/store/chatStore'
import { useUIStore } from '@/store/uiStore'

describe('US-004: useChatAutoAdvance hook', () => {
  beforeEach(() => {
    // Fresh state per case so the counter and interface never leak across
    // boundaries. useUIStore is reset to 'chat' since the hook only fires
    // when currentInterface differs implicitly — keeping it predictable.
    useChatStore.setState({ turnCount: 0, sessionId: null, messages: [] })
    useUIStore.setState({ currentInterface: 'chat' })
  })

  afterEach(() => {
    // Cleanup any hooks rendered during a test so React doesn't warn
    // about state updates on unmounted components.
  })

  it('does NOT auto-advance when only 2 turns have been sent', () => {
    renderHook(() => useChatAutoAdvance())

    act(() => {
      useChatStore.setState({ turnCount: 1 })
    })
    act(() => {
      useChatStore.setState({ turnCount: 2 })
    })

    expect(useUIStore.getState().currentInterface).toBe('chat')
    expect(useChatStore.getState().turnCount).toBe(2)
  })

  it('auto-advances to settings once turnCount reaches the threshold (default 3)', () => {
    renderHook(() => useChatAutoAdvance())

    act(() => {
      useChatStore.setState({ turnCount: 3 })
    })

    expect(useUIStore.getState().currentInterface).toBe('settings')
    expect(useChatStore.getState().turnCount).toBe(3)
  })

  it('does NOT re-trigger when user is already on settings (idempotent within session)', () => {
    renderHook(() => useChatAutoAdvance())

    // First crossing: interface flips to settings.
    act(() => {
      useChatStore.setState({ turnCount: 3 })
    })
    expect(useUIStore.getState().currentInterface).toBe('settings')

    // Spy on setCurrentInterface to confirm it does NOT get called again
    // on subsequent turnCount increases (4, 5, ...).
    const setCurrentInterfaceSpy = vi.spyOn(
      useUIStore.getState(),
      'setCurrentInterface'
    )

    act(() => {
      useChatStore.setState({ turnCount: 4 })
    })
    act(() => {
      useChatStore.setState({ turnCount: 5 })
    })

    expect(useUIStore.getState().currentInterface).toBe('settings')
    expect(setCurrentInterfaceSpy).not.toHaveBeenCalled()
    setCurrentInterfaceSpy.mockRestore()
  })

  it('resets the guard when turnCount returns to 0 (new session can auto-advance again)', () => {
    renderHook(() => useChatAutoAdvance())

    // Burn the threshold once.
    act(() => {
      useChatStore.setState({ turnCount: 3 })
    })
    expect(useUIStore.getState().currentInterface).toBe('settings')

    // Simulate a new chat session that resets the counter (mirrors what
    // `createSession` does for messages / extractedEntities).
    act(() => {
      useChatStore.setState({ turnCount: 0 })
    })
    // User manually went back to chat for the new session.
    act(() => {
      useUIStore.setState({ currentInterface: 'chat' })
    })

    // Three turns later, the hook fires again.
    act(() => {
      useChatStore.setState({ turnCount: 3 })
    })

    expect(useUIStore.getState().currentInterface).toBe('settings')
  })

  it('respects a custom threshold parameter', () => {
    renderHook(() => useChatAutoAdvance(5))

    act(() => {
      useChatStore.setState({ turnCount: 4 })
    })
    expect(useUIStore.getState().currentInterface).toBe('chat')

    act(() => {
      useChatStore.setState({ turnCount: 5 })
    })
    expect(useUIStore.getState().currentInterface).toBe('settings')
  })
})
