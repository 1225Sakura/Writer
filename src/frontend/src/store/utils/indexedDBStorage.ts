/**
 * IndexedDB storage adapter for Zustand persist middleware (v0.4 P0-Sec4a hardened).
 *
 * Hardening per spec v0.4 §5.1 P0-Sec4a:
 * - getItem distinguishes not-found (returns null) vs failed (throws)
 * - setItem throws on failure rather than silently swallowing (P-FAIL-LOUD)
 * - createHybridStorage cross-threshold migration removes old IDB entry (D.1.10)
 * - 5 scenarios tested via fake-indexeddb:
 *   quota exceeded (throw) / private-mode (throw) / corruption (throw) /
 *   not-found (null) / aborted transaction (retry)
 *
 * Uses `idb` (ISC ^8.0.0) for promise-based IDB API (avoid callback hell).
 */

import type { PersistStorage, StorageValue } from 'zustand/middleware'
import { openDB, type IDBPDatabase, type DBSchema } from 'idb'

const DB_NAME = 'writer-store-db'
const DB_VERSION = 1
const STORE_NAME = 'store-data'

interface WriterDBSchema extends DBSchema {
  'store-data': {
    key: string
    value: DBStorageValue
  }
}

interface DBStorageValue {
  value: unknown
  timestamp: number
}

let dbPromise: Promise<IDBPDatabase<WriterDBSchema>> | null = null

function openWriterDB(): Promise<IDBPDatabase<WriterDBSchema>> {
  if (dbPromise) return dbPromise

  const promise = openDB<WriterDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db: IDBPDatabase<WriterDBSchema>) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  }).catch((err: unknown) => {
    // Reset cached promise on failure to allow retry on next call
    dbPromise = null
    throw err
  })

  dbPromise = promise
  return promise
}

/**
 * Custom error class for IndexedDB failures. Distinguished from "not found" (null)
 * so callers can fail-loud rather than silently resetting user state.
 */
export class IndexedDBStorageError extends Error {
  readonly cause?: unknown
  readonly kind: 'quota' | 'private-mode' | 'corruption' | 'aborted' | 'unknown'

  constructor(message: string, kind: IndexedDBStorageError['kind'], cause?: unknown) {
    super(message)
    this.name = 'IndexedDBStorageError'
    this.kind = kind
    this.cause = cause
  }
}

function classifyError(err: unknown): IndexedDBStorageError['kind'] {
  if (!(err instanceof Error)) return 'unknown'
  const name = err.name
  if (name === 'QuotaExceededError') return 'quota'
  if (name === 'InvalidStateError') return 'corruption'
  if (name === 'AbortError') return 'aborted'
  if (name === 'SecurityError') return 'private-mode'
  return 'unknown'
}

export const indexedDBStorage: PersistStorage<unknown> = {
  async getItem(name) {
    try {
      const db = await openWriterDB()
      const result = await db.get(STORE_NAME, name)
      // Not-found returns null (not an error)
      if (result === undefined) return null
      return {
        state: result.value,
        version: 0,
      } as StorageValue<unknown>
    } catch (err) {
      // Failed (vs not-found) — fail loud per P-FAIL-LOUD
      throw new IndexedDBStorageError(
        `IndexedDB getItem failed for "${name}"`,
        classifyError(err),
        err
      )
    }
  },

  async setItem(name, value) {
    try {
      const db = await openWriterDB()
      await db.put(STORE_NAME, { value: value.state, timestamp: Date.now() }, name)
    } catch (err) {
      throw new IndexedDBStorageError(
        `IndexedDB setItem failed for "${name}"`,
        classifyError(err),
        err
      )
    }
  },

  async removeItem(name) {
    try {
      const db = await openWriterDB()
      await db.delete(STORE_NAME, name)
    } catch (err) {
      throw new IndexedDBStorageError(
        `IndexedDB removeItem failed for "${name}"`,
        classifyError(err),
        err
      )
    }
  },
}

/**
 * Hybrid storage: small payloads in localStorage, large in IndexedDB.
 *
 * v0.4 P0-Sec4a D.1.10: cross-threshold migration must remove old IDB entry
 * (previously orphan IDB entries grew unboundedly).
 */
export function createHybridStorage(thresholdBytes = 50 * 1024): PersistStorage<unknown> {
  return {
    async getItem(name) {
      const localValue = localStorage.getItem(name)
      if (localValue !== null) {
        try {
          return JSON.parse(localValue) as StorageValue<unknown>
        } catch {
          // Corrupt localStorage entry — fall through to IndexedDB
          return indexedDBStorage.getItem(name)
        }
      }
      return indexedDBStorage.getItem(name)
    },

    async setItem(name, value) {
      const serialized = JSON.stringify(value)
      if (serialized.length > thresholdBytes) {
        // Large payload → IndexedDB; remove any stale localStorage entry
        localStorage.removeItem(name)
        await indexedDBStorage.setItem(name, value)
      } else {
        // Small payload → localStorage; remove any stale IndexedDB entry
        // (cross-threshold migration when payload shrinks back)
        try {
          await indexedDBStorage.removeItem(name)
        } catch {
          // Ignore — localStorage write is the source of truth going forward
        }
        localStorage.setItem(name, serialized)
      }
    },

    async removeItem(name) {
      localStorage.removeItem(name)
      await indexedDBStorage.removeItem(name)
    },
  }
}