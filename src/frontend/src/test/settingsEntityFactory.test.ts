/**
 * Tests for settingsEntityFactory — Phase 4.2 FE-017.
 *
 * The factory replaces 5 entity handler blocks (~30 lines × 5 entities = 150 lines)
 * in settingsDataSlice.ts with 5 short createEntityHandlers() calls.
 *
 * Tests cover:
 *  1. add(): API create + push to state array + return id
 *  2. update(): API update + Object.assign + history entry
 *  3. remove(): API delete + filter + history entry
 *  4. getById(): find by id
 *  5. list(): return all entities
 *  6. Error handling: API throws → showOperationError + return '' (add) / void (update/remove)
 *  7. History trim: > MAX_HISTORY entries → shift oldest
 *  8. Backward compatibility: same shape as original handler methods
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createEntityHandlers } from '@/store/settingsEntityFactory'
import { MAX_HISTORY } from '@/store/settingsTypes'

// Mock the toast helper to avoid React dependency
vi.mock('@/utils/toastHelper', () => ({
  showOperationError: vi.fn(),
}))

import { showOperationError } from '@/utils/toastHelper'

interface FakeItem {
  id: number
  name: string
  description?: string
}

// Minimal store mock — just set/get + immer-style draft
function createMockStore(initial: any = {}) {
  let state = {
    items: [] as FakeItem[],
    history: [] as any[],
    historyIndex: -1,
    canUndo: false,
    canRedo: false,
    ...initial,
  }
  return {
    get: () => state,
    set: (fn: (draft: any) => void) => {
      // WritableDraft-style: apply mutations directly (immer-equivalent)
      fn(state)
    },
    _state: () => state,
  }
}

// Mock API client
function createMockApiClient() {
  return {
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

describe('createEntityHandlers', () => {
  let store: ReturnType<typeof createMockStore>
  let api: ReturnType<typeof createMockApiClient>
  let handlers: ReturnType<typeof createEntityHandlers<FakeItem>>

  beforeEach(() => {
    vi.clearAllMocks()
    store = createMockStore()
    api = createMockApiClient()
    handlers = createEntityHandlers<FakeItem>(
      { get: store.get, set: store.set },
      {
        entityType: 'item',
        arrayKey: 'items',
        apiClient: api,
        addLabel: '创建物品',
        updateLabel: '更新物品',
        deleteLabel: '删除物品',
      },
    )
  })

  // --- Test 1: add() ---
  it('add() calls api.create and pushes to array', async () => {
    api.create.mockResolvedValue({ id: 1, name: 'sword', description: 'sharp' })
    const id = await handlers.add({ name: 'sword' })
    expect(id).toBe('1')
    expect(api.create).toHaveBeenCalledWith({ name: 'sword' })
    expect(store.get().items).toHaveLength(1)
    expect(store.get().items[0]).toEqual({ id: 1, name: 'sword', description: 'sharp' })
  })

  it('add() returns "" on API failure', async () => {
    api.create.mockRejectedValue(new Error('network down'))
    const id = await handlers.add({ name: 'x' })
    expect(id).toBe('')
    expect(showOperationError).toHaveBeenCalledWith('创建物品', expect.any(Error))
  })

  // --- Test 2: update() ---
  it('update() calls api.update and patches state', async () => {
    store.set((s: any) => { s.items.push({ id: 1, name: 'old' }) })
    api.update.mockResolvedValue({ id: 1, name: 'new', description: 'updated' })

    await handlers.update(1, { name: 'new', description: 'updated' })

    expect(api.update).toHaveBeenCalledWith(1, { name: 'new', description: 'updated' })
    expect(store.get().items[0]).toMatchObject({ id: 1, name: 'new', description: 'updated' })
    // History entry should be added
    expect(store.get().history).toHaveLength(1)
    expect(store.get().history[0]).toMatchObject({
      entityType: 'item',
      entityId: 1,
      action: 'update',
    })
    expect(store.get().history[0].snapshot).toMatchObject({ name: 'old' })
  })

  it('update() preserves original behavior when entity not found (history still pushed)', async () => {
    // The original settingsDataSlice code also pushed history even when item
    // wasn't found in the array (snapshot: undefined). Factory preserves this.
    api.update.mockResolvedValue({ id: 999, name: 'ghost' })
    await handlers.update(999, { name: 'ghost' })
    // History entry is still pushed (matches baseline behavior)
    expect(store.get().history).toHaveLength(1)
    expect(store.get().history[0].entityId).toBe(999)
    expect(store.get().history[0].snapshot).toBeUndefined()
  })

  // --- Test 3: remove() ---
  it('remove() calls api.delete and filters state', async () => {
    store.set((s: any) => {
      s.items.push({ id: 1, name: 'a' })
      s.items.push({ id: 2, name: 'b' })
    })
    api.delete.mockResolvedValue({ message: 'deleted' })

    await handlers.remove(1)

    expect(api.delete).toHaveBeenCalledWith(1)
    expect(store.get().items).toHaveLength(1)
    expect(store.get().items[0].id).toBe(2)
    // History entry
    expect(store.get().history).toHaveLength(1)
    expect(store.get().history[0]).toMatchObject({
      entityType: 'item',
      entityId: 1,
      action: 'delete',
      snapshot: { id: 1, name: 'a' },
    })
  })

  // --- Test 4: getById() ---
  it('getById() returns matching entity', () => {
    store.set((s: any) => {
      s.items.push({ id: 1, name: 'a' })
      s.items.push({ id: 2, name: 'b' })
    })
    expect(handlers.getById(2)).toEqual({ id: 2, name: 'b' })
    expect(handlers.getById(999)).toBeUndefined()
  })

  // --- Test 5: list() ---
  it('list() returns all entities', () => {
    store.set((s: any) => {
      s.items.push({ id: 1, name: 'a' })
      s.items.push({ id: 2, name: 'b' })
      s.items.push({ id: 3, name: 'c' })
    })
    const list = handlers.list()
    expect(list).toHaveLength(3)
    expect(list.map((i) => i.id)).toEqual([1, 2, 3])
  })

  // --- Test 6: Error handling on update/remove ---
  it('update() shows toast on API failure', async () => {
    api.update.mockRejectedValue(new Error('boom'))
    await handlers.update(1, { name: 'x' })
    expect(showOperationError).toHaveBeenCalledWith('更新物品', expect.any(Error))
  })

  it('remove() shows toast on API failure', async () => {
    api.delete.mockRejectedValue(new Error('boom'))
    await handlers.remove(1)
    expect(showOperationError).toHaveBeenCalledWith('删除物品', expect.any(Error))
  })

  // --- Test 7: History trim ---
  it('trims history when exceeding MAX_HISTORY', async () => {
    api.update.mockResolvedValue({ id: 1, name: 'x' })
    // Seed one entity
    store.set((s: any) => { s.items.push({ id: 1, name: 'seed' }) })

    // Push MAX_HISTORY + 5 updates
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      await handlers.update(1, { name: `iter-${i}` })
    }

    // History should be capped at MAX_HISTORY
    expect(store.get().history.length).toBeLessThanOrEqual(MAX_HISTORY)
  })

  // --- Test 8: Backward compatibility (handler shape matches DataSliceActions) ---
  it('handlers expose add/update/remove/getById/list', () => {
    expect(typeof handlers.add).toBe('function')
    expect(typeof handlers.update).toBe('function')
    expect(typeof handlers.remove).toBe('function')
    expect(typeof handlers.getById).toBe('function')
    expect(typeof handlers.list).toBe('function')
  })

  it('uses entityType from config in history entries', async () => {
    // Reconfigure with different entityType
    const factionHandlers = createEntityHandlers<FakeItem>(
      { get: store.get, set: store.set },
      {
        entityType: 'faction',
        arrayKey: 'items',  // reuse items array
        apiClient: api,
        addLabel: '创建势力',
        updateLabel: '更新势力',
        deleteLabel: '删除势力',
      },
    )
    store.set((s: any) => { s.items.push({ id: 1, name: 'a' }) })
    api.update.mockResolvedValue({ id: 1, name: 'b' })

    await factionHandlers.update(1, { name: 'b' })

    expect(store.get().history[0].entityType).toBe('faction')
  })
})
