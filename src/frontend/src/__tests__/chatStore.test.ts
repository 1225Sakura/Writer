/**
 * US-004 — Chat N-turn auto-advance to settings.
 *
 * Verifies the chat store's `turnCount` counter:
 *  - defaults to 0
 *  - increments by 1 on each sendMessage call
 *  - persists across multiple calls (not reset)
 *  - triggers setCurrentInterface('settings') via cross-store reference
 *    when the threshold (3) is reached
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatStore } from '@/store/chatStore'
import { useUIStore } from '@/store/uiStore'

// Mock the chat API so sendMessage completes successfully without hitting
// the real (now inert) backend stub. Without this mock the catch branch
// would fire because the stub returns the wrong response shape, but
// turnCount would still increment — this mock keeps the test surface clean.
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

describe('US-004: Chat N-turn auto-advance hook', () => {
  beforeEach(() => {
    // Reset both stores between tests so counters don't bleed across cases.
    useChatStore.setState({ turnCount: 0, sessionId: null, messages: [] })
    useUIStore.setState({ currentInterface: 'chat' })
  })

  it('turnCount field exists and defaults to 0', () => {
    const state = useChatStore.getState()
    expect(state.turnCount).toBe(0)
  })

  it('initial UI interface is "chat"', () => {
    const ui = useUIStore.getState()
    expect(ui.currentInterface).toBe('chat')
  })

  it('sendMessage 1 time increments turnCount to 1', async () => {
    // Set a session id so sendMessage proceeds (it early-returns without one).
    useChatStore.setState({ sessionId: 1 })

    await useChatStore.getState().sendMessage('hello world')

    expect(useChatStore.getState().turnCount).toBe(1)
    // Below threshold — interface should NOT have changed.
    expect(useUIStore.getState().currentInterface).toBe('chat')
  })

  it('sendMessage 2 times sets turnCount=2 but interface stays on chat', async () => {
    useChatStore.setState({ sessionId: 1 })

    await useChatStore.getState().sendMessage('turn one')
    await useChatStore.getState().sendMessage('turn two')

    expect(useChatStore.getState().turnCount).toBe(2)
    expect(useUIStore.getState().currentInterface).toBe('chat')
  })

  it('sendMessage 3 times triggers auto-advance to settings interface', async () => {
    useChatStore.setState({ sessionId: 1 })

    await useChatStore.getState().sendMessage('turn one')
    await useChatStore.getState().sendMessage('turn two')
    await useChatStore.getState().sendMessage('turn three')

    expect(useChatStore.getState().turnCount).toBe(3)
    expect(useUIStore.getState().currentInterface).toBe('settings')
  })

  it('turnCount accumulates across sendMessage calls (never resets)', async () => {
    useChatStore.setState({ sessionId: 1 })

    for (let i = 0; i < 5; i++) {
      await useChatStore.getState().sendMessage(`message ${i}`)
    }

    expect(useChatStore.getState().turnCount).toBe(5)
    // Once past threshold, interface stays on settings (does not flip back).
    expect(useUIStore.getState().currentInterface).toBe('settings')
  })
})