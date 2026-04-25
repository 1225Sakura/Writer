/**
 * Snapshots API - Frontend wrappers for snapshot, backup, and archive management.
 *
 * Covers:
 * - Create snapshot (/snapshots/create)
 * - Restore snapshot (/snapshots/restore/{id})
 * - List snapshots (/snapshots)
 * - Get snapshot (/snapshots/{id})
 * - Delete snapshot (/snapshots/{id})
 * - Trigger backup (/snapshots/backups/trigger)
 * - Backup status (/snapshots/backups/status)
 * - Update backup schedule (/snapshots/backups/schedule)
 * - Start scheduler (/snapshots/backups/start-scheduler)
 * - Stop scheduler (/snapshots/backups/stop-scheduler)
 * - Export archive (/snapshots/archives/export)
 * - Import archive (/snapshots/archives/import)
 * - List archives (/snapshots/archives/list)
 * - Delete archive (/snapshots/archives/{filename})
 */

import { api } from "./request"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SnapshotInfo {
  id: string
  name?: string
  description?: string
  created_at: string
  size_bytes?: number
}

export interface SnapshotCreateRequest {
  name?: string
  description?: string
}

export interface SnapshotCreateResponse {
  snapshot_id: string
  name?: string
  description?: string
  created_at: string
}

export interface SnapshotRestoreResponse {
  success: boolean
  message: string
  snapshot_id: string
}

export interface BackupStatusResponse {
  status: string
  last_backup?: string
  next_backup?: string
  schedule: {
    enabled: boolean
    interval_minutes: number
    max_snapshots: number
    backup_on_shutdown: boolean
    backup_on_chapter_save: boolean
    backup_on_settings_change: boolean
  }
}

export interface BackupScheduleRequest {
  enabled?: boolean
  interval_minutes?: number
  max_snapshots?: number
  backup_on_shutdown?: boolean
  backup_on_chapter_save?: boolean
  backup_on_settings_change?: boolean
}

export interface ArchiveExportRequest {
  snapshot_id?: string
  format?: "zip" | "tar.gz" | "tar.bz2"
  include_content_storage?: boolean
}

export interface ArchiveExportResponse {
  filename: string
  path: string
  size_bytes: number
}

export interface ArchiveImportResponse {
  success: boolean
  message: string
  imported_files: string[]
}

export interface ArchiveInfo {
  filename: string
  size_bytes: number
  created_at: string
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/** Create a full project snapshot. */
export const createSnapshot = (
  request: SnapshotCreateRequest = {}
): Promise<SnapshotCreateResponse> =>
  api.post<SnapshotCreateResponse>("/snapshots/create", request)

/** Restore project data from a snapshot. */
export const restoreSnapshot = (
  snapshotId: string
): Promise<SnapshotRestoreResponse> =>
  api.post<SnapshotRestoreResponse>(`/snapshots/restore/${encodeURIComponent(snapshotId)}`)

/** List all available snapshots. */
export const listSnapshots = (): Promise<SnapshotInfo[]> =>
  api.get<SnapshotInfo[]>("/snapshots")

/** Get full snapshot data by ID. */
export const getSnapshot = (snapshotId: string): Promise<Record<string, unknown>> =>
  api.get<Record<string, unknown>>(`/snapshots/${encodeURIComponent(snapshotId)}`)

/** Delete a snapshot by ID. */
export const deleteSnapshot = (
  snapshotId: string
): Promise<{ message: string; snapshot_id: string }> =>
  api.delete<{ message: string; snapshot_id: string }>(
    `/snapshots/${encodeURIComponent(snapshotId)}`
  )

/** Manually trigger a backup. */
export const triggerBackup = (
  request: SnapshotCreateRequest = {}
): Promise<Record<string, unknown>> =>
  api.post<Record<string, unknown>>("/snapshots/backups/trigger", request)

/** Get current backup system status. */
export const getBackupStatus = (): Promise<BackupStatusResponse> =>
  api.get<BackupStatusResponse>("/snapshots/backups/status")

/** Update backup schedule configuration. */
export const updateBackupSchedule = (
  request: BackupScheduleRequest
): Promise<Record<string, unknown>> =>
  api.post<Record<string, unknown>>("/snapshots/backups/schedule", request)

/** Start the background backup scheduler. */
export const startBackupScheduler = (): Promise<{ status: string; message: string }> =>
  api.post<{ status: string; message: string }>("/snapshots/backups/start-scheduler")

/** Stop the background backup scheduler. */
export const stopBackupScheduler = (): Promise<{ status: string; message: string }> =>
  api.post<{ status: string; message: string }>("/snapshots/backups/stop-scheduler")

/** Export project as a compressed archive. */
export const exportArchive = (
  request: ArchiveExportRequest = {}
): Promise<ArchiveExportResponse> =>
  api.post<ArchiveExportResponse>("/snapshots/archives/export", request)

/** Import project from a compressed archive. */
export const importArchive = (
  archivePath: string,
  overwrite = false
): Promise<ArchiveImportResponse> =>
  api.post<ArchiveImportResponse>("/snapshots/archives/import", {
    archive_path: archivePath,
    overwrite,
  })

/** List all exported archives. */
export const listArchives = (): Promise<ArchiveInfo[]> =>
  api.get<ArchiveInfo[]>("/snapshots/archives/list")

/** Delete an archive file. */
export const deleteArchive = (filename: string): Promise<{ message: string; filename: string }> =>
  api.delete<{ message: string; filename: string }>(
    `/snapshots/archives/${encodeURIComponent(filename)}`
  )

// ---------------------------------------------------------------------------
// Grouped API export
// ---------------------------------------------------------------------------

export const snapshotsApi = {
  createSnapshot,
  restoreSnapshot,
  listSnapshots,
  getSnapshot,
  deleteSnapshot,
  triggerBackup,
  getBackupStatus,
  updateBackupSchedule,
  startBackupScheduler,
  stopBackupScheduler,
  exportArchive,
  importArchive,
  listArchives,
  deleteArchive,
}

export default snapshotsApi
