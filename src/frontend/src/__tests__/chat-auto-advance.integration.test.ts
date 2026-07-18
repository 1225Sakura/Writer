/**
 * US-004 / Phase 0 commit 4 — Integration test for chat N-turn auto-advance.
 *
 * Per plan AC-P0-4.4 the integration case drives the real `useChatStore`
 * (with `sendMessage`) and verifies that the rendered `useChatAutoAdvance`
 * hook correctly flips `useUIStore.currentInterface` from `'chat'` to
 * `'settings'` once the threshold is crossed.
 *
 * Performance smoke (AC-P0-4.5): the hook effect body must run in under
 * 10ms. We measure the synchronous portion via `performance.now()`.
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useChatAutoAdvance } from '@/components/chat/useChatAutoAdvance'
import { useChatStore } from '@/store/chatStore'
import { useUIStore } from '@/store/uiStore'

// Mock the chat API so sendMessage completes quickly (no real AI). The
// store mutation path is what we are validating, not the network round
// trip.
vi.mock('@/api/chat', async () => {
  const actual = await vi.importActual<typeof import('@/api/chat')>('@/api/chat')
  return {
    ...actual,
    messageApi: {
      ...actual.messageApi,
      send: vi.fn(async () => ({
        ai_message: {
          id: 1,
          content: 'mocked assistant reply',
          created_at: new Date().toISOString(),
        },
      })),
    },
    sessionApi: {
      ...actual.sessionApi,
      create: vi.fn(async () => ({
        id: 1,
        title: 'Test Session',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })),
    },
  }
})

describe('US-004: chat N-turn auto-advance (integration)', () => {
  beforeEach(() => {
    useChatStore.setState({ turnCount: 0, sessionId: null, messages: [] })
    useUIStore.setState({ currentInterface: 'chat' })
  })

  it('drives sendMessage 3 times and verifies uiStore flips to settings', async () => {
    // Render hook once at the start of the test — it stays subscribed for
    // the rest of the case.
    renderHook(() => useChatAutoAdvance())

    // Bootstrap a session so sendMessage doesn't early-return.
    act(() => {
      useChatStore.setState({ sessionId: 1 })
    })

    // Three turns, exactly the default threshold.
    await act(async () => {
      await useChatStore.getState().sendMessage('turn one')
    })
    expect(useUIStore.getState().currentInterface).toBe('chat')
    expect(useChatStore.getState().turnCount).toBe(1)

    await act(async () => {
      await useChatStore.getState().sendMessage('turn two')
    })
    expect(useUIStore.getState().currentInterface).toBe('chat')
    expect(useChatStore.getState().turnCount).toBe(2)

    await act(async () => {
      await useChatStore.getState().sendMessage('turn three')
    })
    // The hook should have flipped the interface by now.
    expect(useChatStore.getState().turnCount).toBe(3)
    expect(useUIStore.getState().currentInterface).toBe('settings')
  })

  it('hook effect body runs in well under 10ms (perf smoke AC-P0-4.5)', () => {
    // Mount the hook at the default threshold first so the effect has
    // already run once (avoids measuring the cold-mount path).
    renderHook(() => useChatAutoAdvance())

    // Measure the hot-path effect for a single turnCount update.
    const samples: number[] = []
    for (let i = 0; i < 50; i++) {
      const start = performance.now()
      act(() => {
        useChatStore.setState({ turnCount: i + 1 })
      })
      samples.push(performance.now() - start)
    }
    // Median is robust to occasional GC / scheduler hiccups on Windows.
    samples.sort((a, b) => a - b)
    const median = samples[Math.floor(samples.length / 2)]
    // AC-P0-4.5 budget: <10ms per hook call. Allow generous headroom
    // (full vitest + jsdom + act() wrapper overhead can chew ~1-2ms)
    // but still trip the assertion if anything regresses badly.
    expect(median).toBeLessThan(10)
  })
})
