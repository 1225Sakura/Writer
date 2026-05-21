import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createHybridStorage } from './utils/indexedDBStorage'
import { api } from '../api/request'
import { showError } from '../utils/toastHelper'

// ============================================
// Types
// ============================================

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'conflict' | 'error'

export type SyncMode = 'auto' | 'manual' | 'paused'

/** IF线同步状态 */
export interface IFLineSyncState {
  ifLineId: number
  status: SyncStatus
  lastSyncedAt: number | null
  lastSyncContent: string
  conflictContent?: string
  autoSync: boolean
  syncInterval: number
}

/** 角色故事线进度 */
export interface CharacterStoryProgress {
  characterId: number
  characterName: string
  currentChapter: number
  totalChapters: number
  wordCount: number
  lastUpdated: number
}

/** 同步冲突 */
export interface SyncConflict {
  id: string
  ifLineId: number
  ifLineTitle: string
  mainContent: string
  ifLineContent: string
  timestamp: number
  resolved: boolean
  resolution?: 'main' | 'ifline' | 'merge'
}

/** AI生成任务 */
export interface AIGenerationTask {
  id: string
  ifLineId: number
  type: 'continue' | 'branch' | 'merge'
  status: 'pending' | 'generating' | 'completed' | 'failed'
  prompt: string
  result?: string
  error?: string
  createdAt: number
  completedAt?: number
}

interface SyncState {
  // IF线同步状态
  ifLineSyncStates: Map<number, IFLineSyncState>

  // 全局同步模式
  globalSyncMode: SyncMode

  // 角色故事线进度
  characterProgress: CharacterStoryProgress[]

  // 冲突列表
  conflicts: SyncConflict[]

  // AI生成任务队列
  generationTasks: AIGenerationTask[]

  // 加载状态
  isSyncing: boolean
  lastGlobalSync: number | null

  // 统计
  totalSyncedWords: number
  totalGeneratedWords: number
}

interface SyncActions {
  // IF线同步状态管理
  registerIFLine: (ifLineId: number, autoSync?: boolean) => void
  unregisterIFLine: (ifLineId: number) => void
  setIFLineSyncStatus: (ifLineId: number, status: SyncStatus) => void
  updateIFLineContent: (ifLineId: number, content: string) => void
  setIFLineAutoSync: (ifLineId: number, autoSync: boolean) => void
  getIFLineSyncState: (ifLineId: number) => IFLineSyncState | undefined

  // 全局同步控制
  setGlobalSyncMode: (mode: SyncMode) => void
  triggerGlobalSync: () => Promise<void>

  // 角色进度
  updateCharacterProgress: (progress: CharacterStoryProgress) => void
  getCharacterProgress: (characterId: number) => CharacterStoryProgress | undefined
  getAllProgress: () => CharacterStoryProgress[]

  // 冲突管理
  addConflict: (conflict: Omit<SyncConflict, 'id' | 'timestamp' | 'resolved'>) => string
  resolveConflict: (conflictId: string, resolution: 'main' | 'ifline' | 'merge', mergeContent?: string) => void
  getUnresolvedConflicts: () => SyncConflict[]
  dismissConflict: (conflictId: string) => void

  // AI生成任务
  addGenerationTask: (task: Omit<AIGenerationTask, 'id' | 'createdAt' | 'status'>) => string
  updateTaskStatus: (taskId: string, status: AIGenerationTask['status'], result?: string, error?: string) => void
  cancelTask: (taskId: string) => void
  getPendingTasks: () => AIGenerationTask[]
  getTasksForIFLine: (ifLineId: number) => AIGenerationTask[]
  clearCompletedTasks: () => void

  // 统计
  incrementSyncedWords: (count: number) => void
  incrementGeneratedWords: (count: number) => void
  getStats: () => { totalSyncedWords: number; totalGeneratedWords: number; activeIFLines: number; pendingConflicts: number }

  // 批量操作
  syncAllIFLines: () => Promise<void>
  pauseAllSync: () => void
  resumeAllSync: () => void
}

// ============================================
// Helpers
// ============================================

const genId = () => `sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

// ============================================
// Store
// ============================================

export const useSyncStore = create<SyncState & SyncActions>()(
  immer(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial state
          ifLineSyncStates: new Map(),
          globalSyncMode: 'auto',
          characterProgress: [],
          conflicts: [],
          generationTasks: [],
          isSyncing: false,
          lastGlobalSync: null,
          totalSyncedWords: 0,
          totalGeneratedWords: 0,

          // ----------------------------------------
          // IF线同步状态
          // ----------------------------------------

          registerIFLine: (ifLineId, autoSync = true) => {
            set((state) => {
              if (!state.ifLineSyncStates.has(ifLineId)) {
                state.ifLineSyncStates.set(ifLineId, {
                  ifLineId,
                  status: 'idle',
                  lastSyncedAt: null,
                  lastSyncContent: '',
                  autoSync,
                  syncInterval: 60000, // 1 minute default
                })
              }
            })
          },

          unregisterIFLine: (ifLineId) => {
            set((state) => {
              state.ifLineSyncStates.delete(ifLineId)
            })
          },

          setIFLineSyncStatus: (ifLineId, status) => {
            set((state) => {
              const syncState = state.ifLineSyncStates.get(ifLineId)
              if (syncState) {
                syncState.status = status
                if (status === 'synced') {
                  syncState.lastSyncedAt = Date.now()
                }
              }
            })
          },

          updateIFLineContent: (ifLineId, content) => {
            set((state) => {
              const syncState = state.ifLineSyncStates.get(ifLineId)
              if (syncState) {
                syncState.lastSyncContent = content
                if (syncState.autoSync && state.globalSyncMode === 'auto') {
                  syncState.status = 'syncing'
                }
              }
            })
          },

          setIFLineAutoSync: (ifLineId, autoSync) => {
            set((state) => {
              const syncState = state.ifLineSyncStates.get(ifLineId)
              if (syncState) {
                syncState.autoSync = autoSync
              }
            })
          },

          getIFLineSyncState: (ifLineId) => {
            return get().ifLineSyncStates.get(ifLineId)
          },

          // ----------------------------------------
          // 全局同步控制
          // ----------------------------------------

          setGlobalSyncMode: (mode) => {
            set((state) => { state.globalSyncMode = mode })
          },

          triggerGlobalSync: async () => {
            const { ifLineSyncStates, globalSyncMode } = get()
            if (globalSyncMode === 'paused') return

            set((state) => { state.isSyncing = true })

            try {
              const syncPromises: Promise<void>[] = []

              ifLineSyncStates.forEach((syncState, ifLineId) => {
                if (syncState.autoSync) {
                  syncPromises.push(
                    (async () => {
                      set((state) => {
                        const ss = state.ifLineSyncStates.get(ifLineId)
                        if (ss) {
                          ss.status = 'syncing'
                        }
                      })
                      try {
                        await api.post(`/chapters/if-lines/${ifLineId}/sync`)
                        set((state) => {
                          const ss = state.ifLineSyncStates.get(ifLineId)
                          if (ss) {
                            ss.status = 'synced'
                            ss.lastSyncedAt = Date.now()
                          }
                        })
                      } catch {
                        set((state) => {
                          const ss = state.ifLineSyncStates.get(ifLineId)
                          if (ss) {
                            ss.status = 'error'
                          }
                        })
                      }
                    })()
                  )
                }
              })

              await Promise.all(syncPromises)
              set((state) => {
                state.lastGlobalSync = Date.now()
                state.isSyncing = false
              })
            } catch (error) {
              showError('全局同步失败，请稍后重试')
              set((state) => { state.isSyncing = false })
            }
          },

          // ----------------------------------------
          // 角色进度
          // ----------------------------------------

          updateCharacterProgress: (progress) => {
            set((state) => {
              const idx = state.characterProgress.findIndex(
                (p) => p.characterId === progress.characterId
              )
              if (idx >= 0) {
                state.characterProgress[idx] = progress
              } else {
                state.characterProgress.push(progress)
              }
            })
          },

          getCharacterProgress: (characterId) => {
            return get().characterProgress.find((p) => p.characterId === characterId)
          },

          getAllProgress: () => {
            return get().characterProgress
          },

          // ----------------------------------------
          // 冲突管理
          // ----------------------------------------

          addConflict: (conflict) => {
            const id = genId()
            const newConflict: SyncConflict = {
              ...conflict,
              id,
              timestamp: Date.now(),
              resolved: false,
            }
            set((state) => {
              state.conflicts.push(newConflict)
              // Update IF line status to conflict
              const syncState = state.ifLineSyncStates.get(conflict.ifLineId)
              if (syncState) {
                syncState.status = 'conflict'
                syncState.conflictContent = conflict.ifLineContent
              }
            })
            return id
          },

          resolveConflict: (conflictId, resolution, mergeContent) => {
            set((state) => {
              const conflict = state.conflicts.find((c) => c.id === conflictId)
              if (!conflict) return

              conflict.resolved = true
              conflict.resolution = resolution

              // Update IF line status
              const syncState = state.ifLineSyncStates.get(conflict.ifLineId)
              if (syncState) {
                syncState.status = 'synced'
                syncState.lastSyncedAt = Date.now()
                if (resolution === 'merge' && mergeContent) {
                  syncState.lastSyncContent = mergeContent
                } else if (resolution === 'main') {
                  syncState.lastSyncContent = conflict.mainContent
                } else if (resolution === 'ifline') {
                  syncState.lastSyncContent = conflict.ifLineContent
                }
              }
            })
          },

          getUnresolvedConflicts: () => {
            return get().conflicts.filter((c) => !c.resolved)
          },

          dismissConflict: (conflictId) => {
            set((state) => {
              state.conflicts = state.conflicts.filter((c) => c.id !== conflictId)
            })
          },

          // ----------------------------------------
          // AI生成任务
          // ----------------------------------------

          addGenerationTask: (task) => {
            const id = genId()
            const newTask: AIGenerationTask = {
              ...task,
              id,
              createdAt: Date.now(),
              status: 'pending',
            }
            set((state) => {
              state.generationTasks.push(newTask)
            })
            return id
          },

          updateTaskStatus: (taskId, status, result, error) => {
            set((state) => {
              const task = state.generationTasks.find((t) => t.id === taskId)
              if (!task) return

              task.status = status
              if (result !== undefined) task.result = result
              if (error !== undefined) task.error = error
              if (status === 'completed') {
                task.completedAt = Date.now()
                // Count generated words
                const wordCount = result?.replace(/\s/g, '').length || 0
                state.totalGeneratedWords += wordCount
              }
            })
          },

          cancelTask: (taskId) => {
            set((state) => {
              const task = state.generationTasks.find((t) => t.id === taskId)
              if (task && task.status === 'pending') {
                task.status = 'failed'
                task.error = '已取消'
              }
            })
          },

          getPendingTasks: () => {
            return get().generationTasks.filter(
              (t) => t.status === 'pending' || t.status === 'generating'
            )
          },

          getTasksForIFLine: (ifLineId) => {
            return get().generationTasks.filter((t) => t.ifLineId === ifLineId)
          },

          clearCompletedTasks: () => {
            set((state) => {
              state.generationTasks = state.generationTasks.filter(
                (t) => t.status === 'pending' || t.status === 'generating'
              )
            })
          },

          // ----------------------------------------
          // 统计
          // ----------------------------------------

          incrementSyncedWords: (count) => {
            set((state) => { state.totalSyncedWords += count })
          },

          incrementGeneratedWords: (count) => {
            set((state) => { state.totalGeneratedWords += count })
          },

          getStats: () => {
            const state = get()
            return {
              totalSyncedWords: state.totalSyncedWords,
              totalGeneratedWords: state.totalGeneratedWords,
              activeIFLines: state.ifLineSyncStates.size,
              pendingConflicts: state.conflicts.filter((c) => !c.resolved).length,
            }
          },

          // ----------------------------------------
          // 批量操作
          // ----------------------------------------

          syncAllIFLines: async () => {
            await get().triggerGlobalSync()
          },

          pauseAllSync: () => {
            set((state) => {
              state.globalSyncMode = 'paused'
              state.ifLineSyncStates.forEach((ss) => {
                ss.autoSync = false
              })
            })
          },

          resumeAllSync: () => {
            set((state) => {
              state.globalSyncMode = 'auto'
              state.ifLineSyncStates.forEach((ss) => {
                ss.autoSync = true
              })
            })
          },
        }),
        {
          name: 'writer-sync-store',
          storage: createHybridStorage(100 * 1024) as never,
          partialize: (state) => ({
            globalSyncMode: state.globalSyncMode,
            characterProgress: state.characterProgress,
            conflicts: state.conflicts,
            totalSyncedWords: state.totalSyncedWords,
            totalGeneratedWords: state.totalGeneratedWords,
            lastGlobalSync: state.lastGlobalSync,
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

export const selectActiveIFLines = (state: SyncState) =>
  Array.from(state.ifLineSyncStates.values()).filter((s) => s.autoSync)

export const selectConflictsNeedingAttention = (state: SyncState) =>
  state.conflicts.filter((c) => !c.resolved)

export const selectSyncProgress = (state: SyncState) => {
  const total = state.ifLineSyncStates.size
  if (total === 0) return 100
  const synced = Array.from(state.ifLineSyncStates.values()).filter(
    (s) => s.status === 'synced'
  ).length
  return Math.round((synced / total) * 100)
}

/** 仅选择同步状态（最小重渲染） */
export const selectSyncStatusOnly = (state: SyncState) => ({
  isSyncing: state.isSyncing,
  globalSyncMode: state.globalSyncMode,
  lastGlobalSync: state.lastGlobalSync,
})

/** 选择统计信息 */
export const selectSyncStats = (state: SyncState) => ({
  totalSyncedWords: state.totalSyncedWords,
  totalGeneratedWords: state.totalGeneratedWords,
  activeIFLines: state.ifLineSyncStates.size,
  pendingConflicts: state.conflicts.filter((c) => !c.resolved).length,
})

/** 清理 sync store 临时状态 */
export function cleanupSyncStore() {
  useSyncStore.setState({
    isSyncing: false,
    generationTasks: [],
  })
}
