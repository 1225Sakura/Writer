/**
 * US-004 — Chat N-turn counter (store-layer).
 *
 * Per Phase 0 commit 4, the `turnCount` counter is owned purely by the
 * chat store. The interface auto-advance side effect has been extracted
 * into `src/components/chat/useChatAutoAdvance.ts` (see
 * `__tests__/useChatAutoAdvance.test.ts`). These tests cover the store's
 * mutation contract only:
 *  - field defaults to 0
 *  - increments by 1 on each sendMessage call
 *  - persists across multiple calls (never resets)
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatStore } from '@/store/chatStore'

// Mock the chat API so sendMessage completes successfully without hitting
// the real (now inert) backend stub. We only care about the counter here,
// not the AI response.
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

describe('US-004: Chat turnCount store field (mutation only)', () => {
  beforeEach(() => {
    // Reset store between tests so counters don't bleed across cases.
    useChatStore.setState({ turnCount: 0, sessionId: null, messages: [] })
  })

  it('turnCount field exists and defaults to 0', () => {
    const state = useChatStore.getState()
    expect(state.turnCount).toBe(0)
  })

  it('sendMessage 1 time increments turnCount to 1', async () => {
    // Set a session id so sendMessage proceeds (it early-returns without one).
    useChatStore.setState({ sessionId: 1 })

    await useChatStore.getState().sendMessage('hello world')

    expect(useChatStore.getState().turnCount).toBe(1)
  })

  it('sendMessage 2 times sets turnCount=2', async () => {
    useChatStore.setState({ sessionId: 1 })

    await useChatStore.getState().sendMessage('turn one')
    await useChatStore.getState().sendMessage('turn two')

    expect(useChatStore.getState().turnCount).toBe(2)
  })

  it('turnCount accumulates across sendMessage calls (never resets)', async () => {
    useChatStore.setState({ sessionId: 1 })

    for (let i = 0; i < 5; i++) {
      await useChatStore.getState().sendMessage(`message ${i}`)
    }

    expect(useChatStore.getState().turnCount).toBe(5)
  })

  it('store does NOT mutate uiStore (auto-advance was extracted to hook)', async () => {
    // Regression guard for commit 4 refactor: removing the inline
    // `useUIStore.getState().setCurrentInterface('settings')` from
    // sendMessage must not silently come back.
    useChatStore.setState({ sessionId: 1 })
    // Import dynamically so any future lazy loaders don't matter; the
    // important thing is the snapshot of currentInterface afterwards.
    const { useUIStore } = await import('@/store/uiStore')
    const before = useUIStore.getState().currentInterface

    await useChatStore.getState().sendMessage('only turn')
    await useChatStore.getState().sendMessage('only turn 2')
    await useChatStore.getState().sendMessage('only turn 3')

    // Store action should not have flipped the interface. The hook is the
    // only place that does that now.
    expect(useUIStore.getState().currentInterface).toBe(before)
  })
})
