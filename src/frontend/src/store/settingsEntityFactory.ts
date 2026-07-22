// ============================================
// Settings Entity Factory — generic CRUD handler generator
// ============================================
//
// FE-017 Phase 4.2: Extract the repeated add/update/delete/getById/list pattern
// from settingsDataSlice.ts (1333 lines, 6 entity handlers × ~30 lines each = 180 lines
// of pure boilerplate) into a reusable factory.
//
// Phase 1 (this PR): cover the simple entities (item / location / faction /
// worldSetting / rule). The character entity has extra logic (relationships +
// storylines + API field name mapping cultivation_realm → cultivationRealm)
// and is left untouched in Phase 1 — refactoring it requires a CharacterAdapter
// interface that the factory can accept (Phase 2+).
//
// All factory functions preserve the exact original behavior including:
// - History entry creation (genHistoryId + MAX_HISTORY trim)
// - Error handling (showOperationError + return '' on add failure)
// - Object.assign for in-place updates (preserves Zustand reactivity)

import type { WritableDraft } from 'immer'
import { showOperationError } from '../utils/toastHelper'
import {
  genHistoryId,
  MAX_HISTORY,
} from './settingsTypes'

/**
 * Generic entity interface — must have `id: number` for storage in array.
 */
export interface BaseEntity {
  id: number
}

/**
 * Generic API client contract: each entity must provide an API client
 * with create/update/delete methods. We use `any` for the request/response
 * types to match the actual settings.ts API signatures (which return
 * `{ message: string }` on delete and accept `Partial<T>` for create/update).
 *
 * If you need strict typing, use a type assertion at the call site:
 *
 *   const itemHandlers = createEntityHandlers<Item>(
 *     { set, get },
 *     { apiClient: itemApi as ApiClient<Item>, ... }
 *   )
 */
export interface ApiClient<T> {
  create: (entity: Partial<T>) => Promise<any>
  update: (id: number, changes: Partial<T>) => Promise<any>
  delete: (id: number) => Promise<any>
}

/**
 * The five handlers exposed by the factory. Naming matches the original
 * settingsDataSlice methods so the public API is unchanged.
 */
export interface EntityHandlers<T extends BaseEntity> {
  add: (entity: Partial<T>) => Promise<string>
  update: (id: number, changes: Partial<T>) => Promise<void>
  remove: (id: number) => Promise<void>
  getById: (id: number) => T | undefined
  list: () => T[]
}

/**
 * Configuration for the factory. The `arrayKey` is the property name on the
 * Zustand state where the entity array lives; `entityType` is the string used
 * in history entries (must match EntityType enum values).
 */
export interface EntityConfig<T extends BaseEntity> {
  entityType: string
  arrayKey: string
  apiClient: ApiClient<T>
  addLabel: string         // e.g. "创建物品"
  updateLabel: string      // e.g. "更新物品"
  deleteLabel: string      // e.g. "删除物品"
  /** Optional pre-transform API → local entity (e.g. CharacterLocal). */
  apiToLocal?: (apiEntity: T) => T
}

/**
 * The Zustand-style store interface that the factory needs.
 *
 * We deliberately use `any` for `state` to avoid pulling Zustand types into
 * this module — the factory only writes to one array property by name.
 * `get()` returns a getter for reading the full state; `set()` applies immer
 * mutations.
 */
interface StoreLike {
  get: () => any
  set: (fn: (state: WritableDraft<any>) => void) => void
}

/**
 * Create a set of entity CRUD handlers (add / update / remove / getById / list)
 * that share the common pattern. The factory handles:
 *   - API call wrapping with try/catch + showOperationError
 *   - Pushing the new entity into state.characters[config.arrayKey]
 *   - Adding history entry on update/delete (create-history only via API,
 *     mirroring original behavior; the old addCharacter also wrote history
 *     but the simpler entity handlers did NOT — see `withCreateHistory`).
 *   - Trim history to MAX_HISTORY entries.
 *
 * The returned object has the same shape as the original handler methods,
 * so callers can use it as a drop-in replacement:
 *
 *   const itemHandlers = createEntityHandlers(store, {
 *     entityType: 'item',
 *     arrayKey: 'items',
 *     apiClient: itemApi,
 *     ...
 *   })
 *   // itemHandlers.add(item), itemHandlers.update(id, changes), ...
 */
export function createEntityHandlers<T extends BaseEntity>(
  store: StoreLike,
  config: EntityConfig<T>,
): EntityHandlers<T> {
  const {
    entityType,
    arrayKey,
    apiClient,
    addLabel,
    updateLabel,
    deleteLabel,
    apiToLocal,
  } = config

  /** Push a new entry onto history and trim if over MAX_HISTORY. */
  const pushHistory = (
    state: WritableDraft<any>,
    entry: {
      entityId: number
      action: 'create' | 'update' | 'delete'
      description: string
      snapshot?: unknown
      forwardSnapshot?: unknown
    },
  ) => {
    state.history.push({
      id: genHistoryId(),
      timestamp: Date.now(),
      entityType,
      ...entry,
    })
    state.historyIndex = state.history.length - 1
    state.canUndo = true
    state.canRedo = false
    if (state.history.length > MAX_HISTORY) {
      state.history.shift()
      state.historyIndex--
    }
  }

  return {
    add: async (entity) => {
      try {
        const apiEntity = await apiClient.create(entity)
        const local = apiToLocal ? apiToLocal(apiEntity) : apiEntity
        store.set((state) => {
          state[arrayKey].push(local)
        })
        return String(apiEntity.id)
      } catch (error) {
        showOperationError(addLabel, error)
        return ''
      }
    },

    update: async (id, changes) => {
      try {
        const oldEntity = store.get()[arrayKey].find((e: T) => e.id === id)
        // Deep-clone snapshot to avoid mutation after Object.assign below.
        // Real Zustand+immer uses WritableDraft which auto-handles this, but
        // for plain JS state objects we need explicit cloning.
        const snapshot = oldEntity ? { ...oldEntity } : undefined
        await apiClient.update(id, changes)
        store.set((state) => {
          const entity = state[arrayKey].find((e: T) => e.id === id)
          if (entity) Object.assign(entity, changes)
          pushHistory(state, {
            entityId: id,
            action: 'update',
            description: `${updateLabel}: ${(changes as any).name || entity?.name || id}`,
            snapshot,
            forwardSnapshot: entity ? { ...entity } : undefined,
          })
        })
      } catch (error) {
        showOperationError(updateLabel, error)
      }
    },

    remove: async (id) => {
      try {
        const oldEntity = store.get()[arrayKey].find((e: T) => e.id === id)
        const snapshot = oldEntity ? { ...oldEntity } : undefined
        await apiClient.delete(id)
        store.set((state) => {
          state[arrayKey] = state[arrayKey].filter((e: T) => e.id !== id)
          pushHistory(state, {
            entityId: id,
            action: 'delete',
            description: `${deleteLabel}: ${oldEntity?.name || String(id)}`,
            snapshot,
          })
        })
      } catch (error) {
        showOperationError(deleteLabel, error)
      }
    },

    getById: (id) => {
      return store.get()[arrayKey].find((e: T) => e.id === id)
    },

    list: () => {
      return store.get()[arrayKey]
    },
  }
}
