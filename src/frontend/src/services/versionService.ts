/**
 * VersionSnapshot Service - IndexedDB-backed version snapshot storage
 *
 * Stores incremental entity diffs for chat session version history.
 * Uses a dedicated IndexedDB instance via createHybridStorage (2MB threshold).
 * LRU cleanup: max 50 snapshots per session.
 */

import { createHybridStorage } from '@/store/utils/indexedDBStorage'
import type { ExtractedEntityLocal } from '@/store/chatStore'

// ============================================
// Types
// ============================================

export interface EntityDiffItem {
  id: string
  type: 'added' | 'removed' | 'modified'
  entityType: string
  name: string
  oldEntity?: ExtractedEntityLocal
  newEntity?: ExtractedEntityLocal
}

export interface VersionSnapshot {
  id: string
  sessionId: number
  timestamp: number
  entities: ExtractedEntityLocal[]
  messageCount: number
  summary: string
  entityDiff: EntityDiffItem[]
}

// ============================================
// Constants
// ============================================

const STORAGE_KEY = 'writer-version-snapshots'
const MAX_SNAPSHOTS = 50
const snapshotStorage = createHybridStorage(2 * 1024 * 1024) // 2MB

// ============================================
// Internal helpers
// ============================================

interface SnapshotStore {
  snapshots: VersionSnapshot[]
}

async function loadStore(): Promise<SnapshotStore> {
  try {
    const raw = await snapshotStorage.getItem(STORAGE_KEY)
    if (raw && typeof raw === 'object' && 'state' in raw) {
      return (raw as { state: SnapshotStore }).state
    }
  } catch {
    // ignore
  }
  return { snapshots: [] }
}

async function saveStore(store: SnapshotStore): Promise<void> {
  try {
    await snapshotStorage.setItem(STORAGE_KEY, { state: store, version: 0 })
  } catch {
    // Storage full — trim oldest snapshots and retry
    if (store.snapshots.length > 10) {
      store.snapshots = store.snapshots.slice(-10)
      try {
        await snapshotStorage.setItem(STORAGE_KEY, { state: store, version: 0 })
      } catch {
        // give up
      }
    }
  }
}

function genSnapshotId(): string {
  return `snap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// ============================================
// Diff algorithm
// ============================================

export function diffSnapshots(
  oldEntities: ExtractedEntityLocal[],
  newEntities: ExtractedEntityLocal[]
): EntityDiffItem[] {
  const oldMap = new Map(oldEntities.map((e) => [e.id, e]))
  const newMap = new Map(newEntities.map((e) => [e.id, e]))
  const diff: EntityDiffItem[] = []

  // Added: in new but not in old
  for (const [id, entity] of newMap) {
    if (!oldMap.has(id)) {
      diff.push({
        id,
        type: 'added',
        entityType: entity.type,
        name: entity.name,
        newEntity: entity,
      })
    }
  }

  // Removed: in old but not in new
  for (const [id, entity] of oldMap) {
    if (!newMap.has(id)) {
      diff.push({
        id,
        type: 'removed',
        entityType: entity.type,
        name: entity.name,
        oldEntity: entity,
      })
    }
  }

  // Modified: in both but changed
  for (const [id, newEntity] of newMap) {
    const oldEntity = oldMap.get(id)
    if (oldEntity && entityChanged(oldEntity, newEntity)) {
      diff.push({
        id,
        type: 'modified',
        entityType: newEntity.type,
        name: newEntity.name,
        oldEntity,
        newEntity,
      })
    }
  }

  return diff
}

function entityChanged(a: ExtractedEntityLocal, b: ExtractedEntityLocal): boolean {
  return (
    a.name !== b.name ||
    a.description !== b.description ||
    a.type !== b.type ||
    a.confirmed !== b.confirmed
  )
}

// ============================================
// Public API
// ============================================

/**
 * Create a new snapshot for a session.
 * Only stores the entity diff against the previous snapshot (incremental).
 */
export async function createSnapshot(
  sessionId: number,
  entities: ExtractedEntityLocal[],
  messageCount: number
): Promise<VersionSnapshot> {
  const store = await loadStore()

  // Find the previous snapshot for this session
  const sessionSnapshots = store.snapshots.filter((s) => s.sessionId === sessionId)
  const previousSnapshot = sessionSnapshots.length > 0
    ? sessionSnapshots[sessionSnapshots.length - 1]
    : null

  const entityDiff = previousSnapshot
    ? diffSnapshots(previousSnapshot.entities, entities)
    : entities.map((e) => ({
        id: e.id,
        type: 'added' as const,
        entityType: e.type,
        name: e.name,
        newEntity: e,
      }))

  const summary = buildSummary(entityDiff, messageCount)

  const snapshot: VersionSnapshot = {
    id: genSnapshotId(),
    sessionId,
    timestamp: Date.now(),
    entities: [...entities],
    messageCount,
    summary,
    entityDiff,
  }

  store.snapshots.push(snapshot)

  // LRU cleanup: keep max MAX_SNAPSHOTS per session
  const sessionSnaps = store.snapshots.filter((s) => s.sessionId === sessionId)
  if (sessionSnaps.length > MAX_SNAPSHOTS) {
    const toRemove = new Set(
      sessionSnaps.slice(0, sessionSnaps.length - MAX_SNAPSHOTS).map((s) => s.id)
    )
    store.snapshots = store.snapshots.filter((s) => !toRemove.has(s.id))
  }

  await saveStore(store)
  return snapshot
}

/**
 * List all snapshots for a session, ordered by timestamp ascending.
 */
export async function listSnapshots(sessionId: number): Promise<VersionSnapshot[]> {
  const store = await loadStore()
  return store.snapshots
    .filter((s) => s.sessionId === sessionId)
    .sort((a, b) => a.timestamp - b.timestamp)
}

/**
 * Get a specific snapshot by ID.
 */
export async function getSnapshot(snapshotId: string): Promise<VersionSnapshot | null> {
  const store = await loadStore()
  return store.snapshots.find((s) => s.id === snapshotId) ?? null
}

/**
 * Restore entities from a snapshot.
 */
export async function rollbackToSnapshot(
  sessionId: number,
  snapshotId: string
): Promise<ExtractedEntityLocal[] | null> {
  const store = await loadStore()
  const snapshot = store.snapshots.find(
    (s) => s.id === snapshotId && s.sessionId === sessionId
  )
  if (!snapshot) return null
  return [...snapshot.entities]
}

// ============================================
// Summary builder
// ============================================

function buildSummary(diff: EntityDiffItem[], messageCount: number): string {
  const added = diff.filter((d) => d.type === 'added').length
  const removed = diff.filter((d) => d.type === 'removed').length
  const modified = diff.filter((d) => d.type === 'modified').length

  const parts: string[] = []
  parts.push(`${messageCount} 条消息`)
  if (added > 0) parts.push(`+${added} 新增`)
  if (removed > 0) parts.push(`-${removed} 删除`)
  if (modified > 0) parts.push(`~${modified} 修改`)
  if (added === 0 && removed === 0 && modified === 0) parts.push('无变更')
  return parts.join(', ')
}
