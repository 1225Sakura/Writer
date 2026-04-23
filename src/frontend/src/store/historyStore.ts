import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createHybridStorage } from './utils/indexedDBStorage'

// ============================================
// Types
// ============================================

export type HistoryActionType = 'create' | 'update' | 'delete' | 'batch' | 'reorder' | 'tag'

export type HistoryEntityType =
  | 'character'
  | 'item'
  | 'location'
  | 'faction'
  | 'world'
  | 'rule'
  | 'outline'
  | 'chapter'
  | 'ifline'
  | 'plotThread'
  | 'relationship'

/** 单个编辑历史记录 */
export interface HistoryEntry {
  id: string
  timestamp: number
  action: HistoryActionType
  entityType: HistoryEntityType
  entityId: number | string
  entityName: string
  description: string
  /** 操作前的完整快照 */
  beforeSnapshot?: unknown
  /** 操作后的完整快照 */
  afterSnapshot?: unknown
  /** 关联的其他实体变更 */
  relatedChanges?: HistoryEntry[]
  /** 是否已同步到后端 */
  synced: boolean
}

/** 撤销重做栈 */
export interface HistoryStack {
  entries: HistoryEntry[]
  currentIndex: number
}

/** 按实体类型分组的历史 */
export interface GroupedHistory {
  entityType: HistoryEntityType
  entries: HistoryEntry[]
}

interface HistoryState {
  // Global history stack
  stack: HistoryEntry[]
  currentIndex: number
  canUndo: boolean
  canRedo: boolean

  // Filter
  filterEntityType: HistoryEntityType | 'all'
  filterActionType: HistoryActionType | 'all'

  // Batch mode
  isBatching: boolean
  batchBuffer: HistoryEntry[]
}

interface HistoryActions {
  // Push entry
  push: (entry: Omit<HistoryEntry, 'id' | 'timestamp' | 'synced'>) => void
  pushMany: (entries: Omit<HistoryEntry, 'id' | 'timestamp' | 'synced'>[]) => void

  // Undo/Redo
  undo: () => HistoryEntry | null
  redo: () => HistoryEntry | null
  undoMany: (count: number) => HistoryEntry[]
  redoMany: (count: number) => HistoryEntry[]

  // Batch operations
  startBatch: () => void
  endBatch: () => void
  cancelBatch: () => void

  // Navigation
  jumpTo: (index: number) => HistoryEntry | null
  getEntryAt: (index: number) => HistoryEntry | undefined

  // Filter
  setFilter: (entityType?: HistoryEntityType | 'all', actionType?: HistoryActionType | 'all') => void
  getFilteredHistory: () => HistoryEntry[]
  getHistoryForEntity: (entityType: HistoryEntityType, entityId: number | string) => HistoryEntry[]

  // Grouping
  getGroupedHistory: () => GroupedHistory[]

  // Stats
  getStats: () => { total: number; undoable: number; redoable: number; byType: Record<HistoryActionType, number> }

  // Clear
  clear: () => void
  clearUpTo: (index: number) => void

  // Sync status
  markSynced: (entryId: string) => void
  getUnsyncedEntries: () => HistoryEntry[]
}

// ============================================
// Helpers
// ============================================

const genId = () => `hist-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const MAX_STACK_SIZE = 100

// ============================================
// Store
// ============================================

export const useHistoryStore = create<HistoryState & HistoryActions>()(
  immer(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial state
          stack: [],
          currentIndex: -1,
          canUndo: false,
          canRedo: false,
          filterEntityType: 'all',
          filterActionType: 'all',
          isBatching: false,
          batchBuffer: [],

          // ----------------------------------------
          // Push
          // ----------------------------------------

          push: (entry) => {
            const fullEntry: HistoryEntry = {
              ...entry,
              id: genId(),
              timestamp: Date.now(),
              synced: false,
            }

            set((state) => {
              if (state.isBatching) {
                state.batchBuffer.push(fullEntry)
                return
              }

              // Remove any redo entries
              if (state.currentIndex < state.stack.length - 1) {
                state.stack = state.stack.slice(0, state.currentIndex + 1)
              }

              state.stack.push(fullEntry)
              state.currentIndex = state.stack.length - 1

              // Trim if too large
              if (state.stack.length > MAX_STACK_SIZE) {
                state.stack.shift()
                state.currentIndex--
              }

              state.canUndo = state.currentIndex >= 0
              state.canRedo = false
            })
          },

          pushMany: (entries) => {
            const fullEntries = entries.map((e) => ({
              ...e,
              id: genId(),
              timestamp: Date.now(),
              synced: false,
            }))

            set((state) => {
              if (state.currentIndex < state.stack.length - 1) {
                state.stack = state.stack.slice(0, state.currentIndex + 1)
              }

              state.stack.push(...fullEntries)
              state.currentIndex = state.stack.length - 1

              if (state.stack.length > MAX_STACK_SIZE) {
                const overflow = state.stack.length - MAX_STACK_SIZE
                state.stack = state.stack.slice(overflow)
                state.currentIndex = state.stack.length - 1
              }

              state.canUndo = state.currentIndex >= 0
              state.canRedo = false
            })
          },

          // ----------------------------------------
          // Undo/Redo
          // ----------------------------------------

          undo: () => {
            const { currentIndex, stack } = get()
            if (currentIndex < 0) return null

            const entry = stack[currentIndex]
            set((state) => {
              state.currentIndex--
              state.canUndo = state.currentIndex >= 0
              state.canRedo = true
            })
            return entry
          },

          redo: () => {
            const { currentIndex, stack } = get()
            if (currentIndex >= stack.length - 1) return null

            const entry = stack[currentIndex + 1]
            set((state) => {
              state.currentIndex++
              state.canUndo = true
              state.canRedo = state.currentIndex < state.stack.length - 1
            })
            return entry
          },

          undoMany: (count) => {
            const { currentIndex } = get()
            const targetIndex = Math.max(-1, currentIndex - count)
            const undone: HistoryEntry[] = []

            set((state) => {
              for (let i = state.currentIndex; i > targetIndex; i--) {
                undone.push(state.stack[i])
              }
              state.currentIndex = targetIndex
              state.canUndo = state.currentIndex >= 0
              state.canRedo = state.currentIndex < state.stack.length - 1
            })

            return undone
          },

          redoMany: (count) => {
            const { currentIndex, stack } = get()
            const targetIndex = Math.min(stack.length - 1, currentIndex + count)
            const redone: HistoryEntry[] = []

            set((state) => {
              for (let i = state.currentIndex + 1; i <= targetIndex; i++) {
                redone.push(state.stack[i])
              }
              state.currentIndex = targetIndex
              state.canUndo = true
              state.canRedo = state.currentIndex < state.stack.length - 1
            })

            return redone
          },

          // ----------------------------------------
          // Batch
          // ----------------------------------------

          startBatch: () => {
            set((state) => {
              state.isBatching = true
              state.batchBuffer = []
            })
          },

          endBatch: () => {
            set((state) => {
              state.isBatching = false
              if (state.batchBuffer.length === 0) return

              if (state.currentIndex < state.stack.length - 1) {
                state.stack = state.stack.slice(0, state.currentIndex + 1)
              }

              // Create a single batch entry with related changes
              const batchEntry: HistoryEntry = {
                ...state.batchBuffer[0],
                id: genId(),
                timestamp: Date.now(),
                synced: false,
                action: 'batch',
                description: `批量操作: ${state.batchBuffer.length} 项变更`,
                relatedChanges: state.batchBuffer.slice(1),
              }

              state.stack.push(batchEntry)
              state.currentIndex = state.stack.length - 1
              state.batchBuffer = []

              if (state.stack.length > MAX_STACK_SIZE) {
                const overflow = state.stack.length - MAX_STACK_SIZE
                state.stack = state.stack.slice(overflow)
                state.currentIndex = state.stack.length - 1
              }

              state.canUndo = true
              state.canRedo = false
            })
          },

          cancelBatch: () => {
            set((state) => {
              state.isBatching = false
              state.batchBuffer = []
            })
          },

          // ----------------------------------------
          // Navigation
          // ----------------------------------------

          jumpTo: (index) => {
            const { stack } = get()
            if (index < -1 || index >= stack.length) return null

            set((state) => {
              state.currentIndex = index
              state.canUndo = state.currentIndex >= 0
              state.canRedo = state.currentIndex < state.stack.length - 1
            })
            return stack[index] || null
          },

          getEntryAt: (index) => {
            return get().stack[index]
          },

          // ----------------------------------------
          // Filter
          // ----------------------------------------

          setFilter: (entityType, actionType) => {
            set((state) => {
              if (entityType) state.filterEntityType = entityType
              if (actionType) state.filterActionType = actionType
            })
          },

          getFilteredHistory: () => {
            const { stack, filterEntityType, filterActionType } = get()
            return stack.filter((entry) => {
              const matchEntity = filterEntityType === 'all' || entry.entityType === filterEntityType
              const matchAction = filterActionType === 'all' || entry.action === filterActionType
              return matchEntity && matchAction
            })
          },

          getHistoryForEntity: (entityType, entityId) => {
            return get().stack.filter(
              (e) => e.entityType === entityType && e.entityId === entityId
            )
          },

          // ----------------------------------------
          // Grouping
          // ----------------------------------------

          getGroupedHistory: () => {
            const { stack } = get()
            const groups = new Map<HistoryEntityType, HistoryEntry[]>()

            stack.forEach((entry) => {
              if (!groups.has(entry.entityType)) {
                groups.set(entry.entityType, [])
              }
              groups.get(entry.entityType)!.push(entry)
            })

            return Array.from(groups.entries()).map(([entityType, entries]) => ({
              entityType,
              entries,
            }))
          },

          // ----------------------------------------
          // Stats
          // ----------------------------------------

          getStats: () => {
            const { stack, currentIndex } = get()
            const byType: Record<HistoryActionType, number> = {
              create: 0,
              update: 0,
              delete: 0,
              batch: 0,
              reorder: 0,
              tag: 0,
            }

            stack.forEach((e) => {
              byType[e.action] = (byType[e.action] || 0) + 1
            })

            return {
              total: stack.length,
              undoable: currentIndex + 1,
              redoable: stack.length - currentIndex - 1,
              byType,
            }
          },

          // ----------------------------------------
          // Clear
          // ----------------------------------------

          clear: () => {
            set((state) => {
              state.stack = []
              state.currentIndex = -1
              state.canUndo = false
              state.canRedo = false
              state.batchBuffer = []
              state.isBatching = false
            })
          },

          clearUpTo: (index) => {
            set((state) => {
              state.stack = state.stack.slice(index + 1)
              state.currentIndex = state.stack.length - 1
              state.canUndo = state.currentIndex >= 0
              state.canRedo = false
            })
          },

          // ----------------------------------------
          // Sync
          // ----------------------------------------

          markSynced: (entryId) => {
            set((state) => {
              const entry = state.stack.find((e) => e.id === entryId)
              if (entry) entry.synced = true
            })
          },

          getUnsyncedEntries: () => {
            return get().stack.filter((e) => !e.synced)
          },
        }),
        {
          name: 'writer-history-store',
          storage: createHybridStorage(100 * 1024) as never,
          partialize: (state) => ({
            stack: state.stack.slice(-20), // Only persist last 20
            currentIndex: Math.min(state.currentIndex, 19),
          }),
          version: 1,
        }
      )
    )
  )
)

// ============================================
// Selectors
// ============================================

export const selectRecentHistory = (count: number) => (state: HistoryState) =>
  state.stack.slice(Math.max(0, state.currentIndex - count + 1), state.currentIndex + 1)

export const selectUnsyncedCount = (state: HistoryState) =>
  state.stack.filter((e) => !e.synced).length
