/**
 * IndexedDB 存储适配器，用于替代 localStorage 存储大数据
 * 解决 localStorage 5MB 限制问题
 */

import type { PersistStorage, StorageValue } from 'zustand/middleware'

const DB_NAME = 'writer-store-db'
const DB_VERSION = 1
const STORE_NAME = 'store-data'

interface DBStorageValue {
  value: unknown
  timestamp: number
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }
  })

  return dbPromise
}

export const indexedDBStorage: PersistStorage<unknown> = {
  async getItem(name) {
    try {
      const db = await openDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const store = tx.objectStore(STORE_NAME)
        const request = store.get(name)

        request.onsuccess = () => {
          const result = request.result as DBStorageValue | undefined
          if (!result) {
            resolve(null)
            return
          }
          resolve({
            state: result.value,
            version: 0,
          } as StorageValue<unknown>)
        }
        request.onerror = () => reject(request.error)
      })
    } catch {
      return null
    }
  },

  async setItem(name, value) {
    try {
      const db = await openDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const request = store.put(
          { value: value.state, timestamp: Date.now() } as DBStorageValue,
          name
        )

        request.onsuccess = () => resolve(undefined)
        request.onerror = () => reject(request.error)
      })
    } catch {
      // Fallback silently
    }
  },

  async removeItem(name) {
    try {
      const db = await openDB()
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        const store = tx.objectStore(STORE_NAME)
        const request = store.delete(name)

        request.onsuccess = () => resolve(undefined)
        request.onerror = () => reject(request.error)
      })
    } catch {
      // Fallback silently
    }
  },
}

/**
 * 创建混合存储适配器：小数据用 localStorage，大数据用 IndexedDB
 */
export function createHybridStorage(thresholdBytes = 50 * 1024): PersistStorage<unknown> {
  return {
    async getItem(name) {
      // 先尝试 localStorage
      const localValue = localStorage.getItem(name)
      if (localValue !== null) {
        try {
          return JSON.parse(localValue) as StorageValue<unknown>
        } catch {
          return null
        }
      }

      // 再尝试 IndexedDB
      return indexedDBStorage.getItem(name)
    },

    async setItem(name, value) {
      const serialized = JSON.stringify(value)
      if (serialized.length > thresholdBytes) {
        // 大数据存 IndexedDB，同时清理 localStorage
        localStorage.removeItem(name)
        await indexedDBStorage.setItem(name, value)
      } else {
        // 小数据存 localStorage
        localStorage.setItem(name, serialized)
      }
    },

    async removeItem(name) {
      localStorage.removeItem(name)
      await indexedDBStorage.removeItem(name)
    },
  }
}
