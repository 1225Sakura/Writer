/**
 * IndexedDB startup health check (v0.4 P0-Sec4d).
 *
 * Per spec v0.4 §5.1 P0-Sec4d:
 * - App startup: scan IndexedDB stores; detect missing keys (data loss)
 * - If losses detected, show banner offering backup restore
 * - Manual test: simulate quota exceeded → banner displays after restart
 */

import { openDB, type IDBPDatabase, type DBSchema } from 'idb'
import { indexedDBStorage, IndexedDBStorageError } from './indexedDBStorage'

const DB_NAME = 'writer-store-db'
const STORE_NAME = 'store-data'
const EXPECTED_STORE_KEYS = [
  'writer-store',
  'chat-store',
  'settings-store',
  'writing-store',
]

export interface HealthCheckResult {
  healthy: boolean
  missingKeys: string[]
  quotaEstimate: { usage: number; quota: number; percent: number } | null
  errors: string[]
}

export async function checkIndexedDBHealth(): Promise<HealthCheckResult> {
  const result: HealthCheckResult = {
    healthy: true,
    missingKeys: [],
    quotaEstimate: null,
    errors: [],
  }

  // Check 1: list expected store keys
  try {
    const db = await openDB(DB_NAME, 1)
    for (const key of EXPECTED_STORE_KEYS) {
      const value = await db.get(STORE_NAME, key)
      if (!value) {
        result.missingKeys.push(key)
      }
    }
    await db.close()
  } catch (err) {
    result.errors.push(`Failed to enumerate IDB stores: ${err instanceof Error ? err.message : String(err)}`)
    result.healthy = false
    return result
  }

  // Check 2: estimate quota (via navigator.storage if available)
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate()
      if (estimate.usage !== undefined && estimate.quota !== undefined && estimate.quota > 0) {
        const percent = (estimate.usage / estimate.quota) * 100
        result.quotaEstimate = {
          usage: estimate.usage,
          quota: estimate.quota,
          percent,
        }
        if (percent > 80) {
          result.errors.push(
            `Storage usage at ${percent.toFixed(1)}% (${estimate.usage}/${estimate.quota} bytes); consider backup`
          )
        }
      }
    } catch (err) {
      result.errors.push(`Quota estimate failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  result.healthy = result.missingKeys.length === 0 && result.errors.length === 0
  return result
}

/**
 * Display a one-time banner if health check finds issues.
 * Caller (App startup) decides whether to surface banner.
 */
export function formatHealthBanner(result: HealthCheckResult): string | null {
  if (result.healthy) return null
  const parts: string[] = []
  if (result.missingKeys.length > 0) {
    parts.push(
      `检测到 ${result.missingKeys.length} 个 store 数据丢失: ${result.missingKeys.join(', ')}`
    )
  }
  if (result.quotaEstimate && result.quotaEstimate.percent > 80) {
    parts.push(
      `存储空间使用率 ${result.quotaEstimate.percent.toFixed(1)}%，建议备份项目数据`
    )
  }
  if (result.errors.length > 0) {
    parts.push(result.errors.join('; '))
  }
  return parts.length > 0 ? parts.join(' | ') + ' (建议从备份恢复或导出)' : null
}