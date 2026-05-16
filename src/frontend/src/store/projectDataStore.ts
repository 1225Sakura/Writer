import { create } from 'zustand'
import { persist, subscribeWithSelector } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { createHybridStorage } from './utils/indexedDBStorage'
import { snapshotsApi, type SnapshotInfo, type SnapshotCreateResponse, type SnapshotRestoreResponse, type BackupStatusResponse } from '@/api/snapshots'
import { exportImportApi, type ImportProjectResponse } from '@/api/exportImport'
import type { ExportDataResponse } from '@/api/types'

// ============================================
// Types
// ============================================

export interface ProjectDataState {
  // Snapshots
  snapshots: SnapshotInfo[]
  currentSnapshot: SnapshotCreateResponse | null
  backupStatus: BackupStatusResponse | null

  // Export/Import
  exportData: ExportDataResponse | null
  importResult: ImportProjectResponse | null

  // Common
  loading: boolean
  error: string | null
}

interface ProjectDataActions {
  // Snapshots
  createSnapshot: (name?: string, description?: string) => Promise<SnapshotCreateResponse>
  listSnapshots: () => Promise<void>
  restoreSnapshot: (snapshotId: string) => Promise<SnapshotRestoreResponse>
  deleteSnapshot: (snapshotId: string) => Promise<void>
  triggerBackup: () => Promise<void>
  getBackupStatus: () => Promise<void>

  // Export
  exportJSON: () => Promise<void>
  exportYAML: () => Promise<void>
  exportZIP: (format?: 'json' | 'yaml') => Promise<void>

  // Import
  importJSON: (data: ExportDataResponse, mode?: 'merge' | 'replace') => Promise<void>
  importYAML: (yamlData: string, mode?: string) => Promise<void>
  importZIP: (zipData: Blob, mode?: string) => Promise<void>

  // Utility
  clearError: () => void
  clearImportResult: () => void
  clearExportData: () => void
}

// ============================================
// Store
// ============================================

export const useProjectDataStore = create<ProjectDataState & ProjectDataActions>()(
  immer(
    subscribeWithSelector(
      persist(
        (set, get) => ({
          // Initial state
          snapshots: [],
          currentSnapshot: null,
          backupStatus: null,
          exportData: null,
          importResult: null,
          loading: false,
          error: null,

          // --- Snapshot actions ---

          createSnapshot: async (name, description) => {
            set((s) => { s.loading = true; s.error = null })
            try {
              const result = await snapshotsApi.createSnapshot({ name, description })
              set((s) => {
                s.currentSnapshot = result
                s.loading = false
              })
              // Refresh snapshot list
              get().listSnapshots()
              return result
            } catch (err) {
              const message = err instanceof Error ? err.message : '创建快照失败'
              set((s) => { s.loading = false; s.error = message })
              throw err
            }
          },

          listSnapshots: async () => {
            set((s) => { s.loading = true; s.error = null })
            try {
              const snapshots = await snapshotsApi.listSnapshots()
              set((s) => { s.snapshots = snapshots; s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '获取快照列表失败'
              set((s) => { s.loading = false; s.error = message })
            }
          },

          restoreSnapshot: async (snapshotId) => {
            set((s) => { s.loading = true; s.error = null })
            try {
              const result = await snapshotsApi.restoreSnapshot(snapshotId)
              set((s) => { s.loading = false })
              return result
            } catch (err) {
              const message = err instanceof Error ? err.message : '恢复快照失败'
              set((s) => { s.loading = false; s.error = message })
              throw err
            }
          },

          deleteSnapshot: async (snapshotId) => {
            set((s) => { s.loading = true; s.error = null })
            try {
              await snapshotsApi.deleteSnapshot(snapshotId)
              set((s) => {
                s.snapshots = s.snapshots.filter((snap) => snap.id !== snapshotId)
                s.loading = false
              })
            } catch (err) {
              const message = err instanceof Error ? err.message : '删除快照失败'
              set((s) => { s.loading = false; s.error = message })
            }
          },

          triggerBackup: async () => {
            set((s) => { s.loading = true; s.error = null })
            try {
              await snapshotsApi.triggerBackup()
              set((s) => { s.loading = false })
              get().getBackupStatus()
            } catch (err) {
              const message = err instanceof Error ? err.message : '触发备份失败'
              set((s) => { s.loading = false; s.error = message })
            }
          },

          getBackupStatus: async () => {
            try {
              const status = await snapshotsApi.getBackupStatus()
              set((s) => { s.backupStatus = status })
            } catch (err) {
              const message = err instanceof Error ? err.message : '获取备份状态失败'
              set((s) => { s.error = message })
            }
          },

          // --- Export actions ---

          exportJSON: async () => {
            set((s) => { s.loading = true; s.error = null })
            try {
              const data = await exportImportApi.exportProject()
              set((s) => { s.exportData = data; s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '导出JSON失败'
              set((s) => { s.loading = false; s.error = message })
            }
          },

          exportYAML: async () => {
            set((s) => { s.loading = true; s.error = null })
            try {
              await exportImportApi.exportAsYaml()
              set((s) => { s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '导出YAML失败'
              set((s) => { s.loading = false; s.error = message })
            }
          },

          exportZIP: async (format) => {
            set((s) => { s.loading = true; s.error = null })
            try {
              await exportImportApi.exportAsZip({ format })
              set((s) => { s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '导出ZIP失败'
              set((s) => { s.loading = false; s.error = message })
            }
          },

          // --- Import actions ---

          importJSON: async (data, mode) => {
            set((s) => { s.loading = true; s.error = null; s.importResult = null })
            try {
              const result = await exportImportApi.importProject({ data, mode })
              set((s) => { s.importResult = result; s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '导入JSON失败'
              set((s) => { s.loading = false; s.error = message })
            }
          },

          importYAML: async (yamlData, mode) => {
            set((s) => { s.loading = true; s.error = null; s.importResult = null })
            try {
              const result = await exportImportApi.importFromYaml({ yaml_data: yamlData, mode })
              set((s) => { s.importResult = result; s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '导入YAML失败'
              set((s) => { s.loading = false; s.error = message })
            }
          },

          importZIP: async (zipData, mode) => {
            set((s) => { s.loading = true; s.error = null; s.importResult = null })
            try {
              const result = await exportImportApi.importFromZip(zipData, { mode })
              set((s) => { s.importResult = result; s.loading = false })
            } catch (err) {
              const message = err instanceof Error ? err.message : '导入ZIP失败'
              set((s) => { s.loading = false; s.error = message })
            }
          },

          // --- Utility ---

          clearError: () => {
            set((s) => { s.error = null })
          },

          clearImportResult: () => {
            set((s) => { s.importResult = null })
          },

          clearExportData: () => {
            set((s) => { s.exportData = null })
          },
        }),
        {
          name: 'project-data-store',
          storage: createHybridStorage(),
          partialize: (state) => ({
            snapshots: state.snapshots,
            backupStatus: state.backupStatus,
          }),
        }
      )
    )
  )
)

// Selectors
export const selectSnapshots = (s: ProjectDataState) => s.snapshots
export const selectSnapshotCount = (s: ProjectDataState) => s.snapshots.length
export const selectBackupStatus = (s: ProjectDataState) => s.backupStatus
export const selectExportData = (s: ProjectDataState) => s.exportData
export const selectImportResult = (s: ProjectDataState) => s.importResult
export const selectProjectDataLoading = (s: ProjectDataState) => s.loading
export const selectProjectDataError = (s: ProjectDataState) => s.error

export function cleanupProjectDataStore() {
  useProjectDataStore.setState({
    snapshots: [],
    currentSnapshot: null,
    backupStatus: null,
    exportData: null,
    importResult: null,
    loading: false,
    error: null,
  })
}
