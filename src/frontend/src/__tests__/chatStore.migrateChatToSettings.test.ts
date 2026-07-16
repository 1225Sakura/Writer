/**
 * US-007 — Chat → 6 entity auto-migration frontend action.
 *
 * Verifies that `migrateChatToSettings` in the chat store:
 *   - delegates to the API with the right arguments
 *   - updates the local `extractedEntities` state on success
 *   - propagates errors into the store's `error` field
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useChatStore } from '@/store/chatStore'

// Mock the chat API so the migration action calls our deterministic stub.
vi.mock('@/api/chat', async () => {
  const actual = await vi.importActual<typeof import('@/api/chat')>('@/api/chat')
  return {
    ...actual,
    migrateChatToSettings: vi.fn(),
  }
})

import * as chatApi from '@/api/chat'

const mockedMigrate = chatApi.migrateChatToSettings as unknown as ReturnType<typeof vi.fn>

describe('US-007: migrateChatToSettings action', () => {
  beforeEach(() => {
    useChatStore.setState({
      extractionState: 'idle',
      extractionProgress: 0,
      error: null,
      extractedEntities: [],
    })
    mockedMigrate.mockReset()
  })

  it('calls backend API with (sessionId, projectId, targetCategories)', async () => {
    mockedMigrate.mockResolvedValue({
      created: [
        { type: 'character', id: 7, name: '林远图' },
        { type: 'world', id: 8, name: '九州大陆' },
      ],
      skipped: [],
      partial: false,
      errors: [],
    })

    const result = await useChatStore
      .getState()
      .migrateChatToSettings(1, 42, ['character', 'world'])

    expect(mockedMigrate).toHaveBeenCalledTimes(1)
    expect(mockedMigrate).toHaveBeenCalledWith(1, 42, ['character', 'world'])
    expect(result.created).toHaveLength(2)
  })

  it('updates extractedEntities state on success', async () => {
    mockedMigrate.mockResolvedValue({
      created: [
        { type: 'character', id: 7, name: '林远图' },
        { type: 'world', id: 8, name: '九州大陆' },
      ],
      skipped: [],
      partial: false,
      errors: [],
    })

    await useChatStore
      .getState()
      .migrateChatToSettings(1, 42, ['character', 'world'])

    const entities = useChatStore.getState().extractedEntities
    const names = entities.map((e) => e.name)
    expect(names).toContain('林远图')
    expect(names).toContain('九州大陆')
    expect(useChatStore.getState().extractionState).toBe('completed')
    expect(useChatStore.getState().extractionProgress).toBe(100)
    expect(useChatStore.getState().error).toBeNull()
  })

  it('sets error state when the API call fails', async () => {
    mockedMigrate.mockRejectedValue(new Error('boom'))

    await expect(
      useChatStore
        .getState()
        .migrateChatToSettings(1, 42, ['character']),
    ).rejects.toThrow('boom')

    const state = useChatStore.getState()
    expect(state.error).toBe('boom')
    expect(state.extractionState).toBe('error')
  })
})