/**
 * Simple in-memory cache for API responses
 */

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in ms
}

class APICache {
  private cache = new Map<string, CacheEntry<unknown>>()
  private maxSize = 100

  get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined
    if (!entry) return null

    // Check if expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key)
      return null
    }

    return entry.data
  }

  set<T>(key: string, data: T, ttl = 60000): void { // Default 1 min
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey) this.cache.delete(oldestKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    })
  }

  invalidate(key: string): void {
    this.cache.delete(key)
  }

  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key)
      }
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

export const apiCache = new APICache()

// Helper to create cache key from endpoint and params
export function createCacheKey(endpoint: string, params?: Record<string, unknown>): string {
  if (!params) return endpoint
  const sortedParams = Object.keys(params).sort().map((k) => `${k}=${params[k]}`).join('&')
  return `${endpoint}?${sortedParams}`
}
