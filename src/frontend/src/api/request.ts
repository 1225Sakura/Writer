import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import axiosRetry from 'axios-retry'
import { apiCache } from '@/utils/cache'

// ============================================
// Environment Detection
// ============================================

const isElectron = (): boolean => {
  return typeof window !== 'undefined' && !!(window as Window & { electronAPI?: unknown }).electronAPI
}

const isDev = (): boolean => {
  return import.meta.env.DEV === true
}

// ============================================
// Shared API Key Resolution
// ============================================

/**
 * Get the API key for authentication.
 * In Electron: queries the main process via IPC.
 * In browser: reads from localStorage.
 */
export const getApiKey = async (): Promise<string | null> => {
  if (isElectron()) {
    try {
      return await window.electronAPI!.getApiKey()
    } catch {
      return null
    }
  }
  return localStorage.getItem('writer_api_key')
}

// ============================================
// API Base URL Resolution
// ============================================

/**
 * Resolve the API base URL based on environment.
 *
 * - Vite dev server: uses VITE_API_BASE_URL or falls back to '' (relative,
 *   letting the Vite proxy handle /api -> localhost:8000).
 * - Electron production: queries the main process for the backend URL via IPC.
 * - Direct browser (non-Electron production): uses VITE_API_BASE_URL env var.
 */
let resolvedBaseUrl: string | null = null

const resolveBaseURL = async (): Promise<string> => {
  if (resolvedBaseUrl !== null) {
    return resolvedBaseUrl
  }

  // Electron production: ask main process for backend URL
  if (isElectron() && !isDev()) {
    try {
      const backendUrl = await window.electronAPI!.getBackendUrl()
      resolvedBaseUrl = `${backendUrl}/api/v1`
      return resolvedBaseUrl
    } catch {
      // Fallback if IPC fails
      resolvedBaseUrl = 'http://localhost:8000/api/v1'
      return resolvedBaseUrl
    }
  }

  // Vite dev or direct browser build
  const envUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
  if (envUrl) {
    resolvedBaseUrl = envUrl
  } else if (isDev()) {
    // In dev, use relative path so Vite proxy handles it
    resolvedBaseUrl = '/api/v1'
  } else {
    // Production fallback (should be set by build config)
    resolvedBaseUrl = 'http://localhost:8000/api/v1'
  }

  return resolvedBaseUrl
}

// ============================================
// API Error Types
// ============================================

export interface ApiError {
  code:
    | 'NETWORK_ERROR'
    | 'TIMEOUT_ERROR'
    | 'AUTH_ERROR'
    | 'FORBIDDEN_ERROR'
    | 'NOT_FOUND'
    | 'SERVER_ERROR'
    | 'RATE_LIMIT_ERROR'
    | 'VALIDATION_ERROR'
    | 'CANCELLED_ERROR'
    | 'UNKNOWN_ERROR'
  message: string
  statusCode?: number
  originalError?: unknown
}

// ============================================
// API Client Setup (lazy init)
// ============================================

let apiClient: AxiosInstance | null = null

const createApiClient = (baseURL: string): AxiosInstance => {
  const client = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // Attach retry logic
  axiosRetry(client, {
    retries: 3,
    retryDelay: (retryCount) => {
      return Math.pow(2, retryCount) * 1000 // Exponential backoff: 1s, 2s, 4s
    },
    retryCondition: (error) => {
      if (!error.response) {
        return true // Retry on network errors
      }
      const status = error.response.status
      return status >= 500 || status === 408 || status === 429
    },
    onRetry: (_retryCount, _error) => {
      // Retry handled silently
    },
  })

  return client
}

/**
 * Get the initialized API client. Must be awaited before first use.
 */
export const getApiClient = async (): Promise<AxiosInstance> => {
  if (apiClient) {
    return apiClient
  }
  const baseURL = await resolveBaseURL()
  apiClient = createApiClient(baseURL)
  setupInterceptors(apiClient)
  return apiClient
}

// ============================================
// Error Transformation
// ============================================

const transformError = (err: unknown): ApiError => {
  const error = err as AxiosError

  // Check for cancellation first
  if (axios.isCancel?.(error) || error.message?.includes('canceled') || error.message?.includes('aborted')) {
    return {
      code: 'CANCELLED_ERROR',
      message: '请求已取消',
      originalError: error,
    }
  }

  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return {
        code: 'TIMEOUT_ERROR',
        message: '请求超时，请稍后重试',
        originalError: error,
      }
    }
    return {
      code: 'NETWORK_ERROR',
      message: '网络连接失败，请检查您的网络设置',
      originalError: error,
    }
  }

  const statusCode = error.response.status

  switch (statusCode) {
    case 400: {
      const data = error.response?.data as {
        error?: { code?: string; message?: string }
        detail?: string
        message?: string
        errors?: Record<string, string[]>
      }
      const fieldErrors = data?.errors
        ? Object.entries(data.errors).map(([k, v]) => `${k}: ${v.join(', ')}`).join('; ')
        : ''
      return {
        code: 'VALIDATION_ERROR',
        message: fieldErrors || data?.error?.message || data?.detail || data?.message || '请求参数错误',
        statusCode,
        originalError: error,
      }
    }
    case 401:
      return {
        code: 'AUTH_ERROR',
        message: '登录已过期，请重新登录',
        statusCode,
        originalError: error,
      }
    case 403:
      return {
        code: 'FORBIDDEN_ERROR',
        message: '您没有权限执行此操作',
        statusCode,
        originalError: error,
      }
    case 404:
      return {
        code: 'NOT_FOUND',
        message: '请求的资源不存在',
        statusCode,
        originalError: error,
      }
    case 429:
      return {
        code: 'RATE_LIMIT_ERROR',
        message: '请求过于频繁，请稍后再试',
        statusCode,
        originalError: error,
      }
    case 500:
    case 502:
    case 503:
      return {
        code: 'SERVER_ERROR',
        message: '服务器内部错误，请稍后重试',
        statusCode,
        originalError: error,
      }
    default: {
      const data = error.response?.data as {
        error?: { code?: string; message?: string }
        detail?: string
        message?: string
      }
      return {
        code: 'UNKNOWN_ERROR',
        message: data?.error?.message || data?.detail || data?.message || '请求失败，请稍后重试',
        statusCode,
        originalError: error,
      }
    }
  }
}

// ============================================
// Error Message Mapping
// ============================================

export const getErrorMessage = (error: ApiError): string => {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return '网络连接失败，请检查您的网络设置'
    case 'TIMEOUT_ERROR':
      return '请求超时，请稍后重试'
    case 'AUTH_ERROR':
      return '登录已过期，请重新登录'
    case 'FORBIDDEN_ERROR':
      return '您没有权限执行此操作'
    case 'NOT_FOUND':
      return '请求的资源不存在'
    case 'RATE_LIMIT_ERROR':
      return '请求过于频繁，请稍后再试'
    case 'VALIDATION_ERROR':
      return error.message || '请求参数错误'
    case 'SERVER_ERROR':
      return '服务器内部错误，请稍后重试'
    case 'CANCELLED_ERROR':
      return '请求已取消'
    default:
      return error.message || '请求失败，请稍后重试'
  }
}

/**
 * Check if an error is a specific API error code.
 */
export const isApiError = (error: unknown, code: ApiError['code']): boolean => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as ApiError).code === code
  )
}

/**
 * Check if an error is a network-related error (retryable).
 */
export const isRetryableError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false
  const apiError = error as ApiError
  return (
    apiError.code === 'NETWORK_ERROR' ||
    apiError.code === 'TIMEOUT_ERROR' ||
    apiError.code === 'SERVER_ERROR' ||
    apiError.code === 'RATE_LIMIT_ERROR'
  )
}

/**
 * Check if an error is a cancellation.
 */
export const isCancelledError = (error: unknown): boolean => {
  return isApiError(error, 'CANCELLED_ERROR')
}

// ============================================
// Interceptors
// ============================================

const setupInterceptors = (client: AxiosInstance): void => {
  // Request interceptor
  client.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Local API key auth for desktop app
      const apiKey = await getApiKey()
      if (apiKey && config.headers) {
        config.headers['X-API-Key'] = apiKey
      }

      // Add timestamp for GET requests to avoid caching
      if (config.method === 'get') {
        if (config.params) {
          config.params = { ...config.params, _t: Date.now() }
        } else {
          config.params = { _t: Date.now() }
        }
      }

      return config
    },
    (error) => {
      return Promise.reject(transformError(error))
    }
  )

  // Response interceptor
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      return response
    },
    (error: AxiosError) => {
      return Promise.reject(transformError(error))
    }
  )
}

// ============================================
// Offline Detection
// ============================================

let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true

type OnlineCallback = () => void
type OfflineCallback = () => void

const onlineListeners: OnlineCallback[] = []
const offlineListeners: OfflineCallback[] = []

const handleOnline = () => {
  isOnline = true
  onlineListeners.forEach((cb) => cb())
}

const handleOffline = () => {
  isOnline = false
  offlineListeners.forEach((cb) => cb())
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
}

export const setupOnlineDetection = (
  onOnline: OnlineCallback,
  onOffline: OfflineCallback
): (() => void) => {
  onlineListeners.push(onOnline)
  offlineListeners.push(onOffline)
  return () => {
    const onIdx = onlineListeners.indexOf(onOnline)
    const offIdx = offlineListeners.indexOf(onOffline)
    if (onIdx > -1) onlineListeners.splice(onIdx, 1)
    if (offIdx > -1) offlineListeners.splice(offIdx, 1)
  }
}

export const getOnlineStatus = (): boolean => isOnline

// ============================================
// AbortController / Request Cancellation
// ============================================

export interface CancellableRequest<T> {
  promise: Promise<T>
  cancel: (reason?: string) => void
}

/**
 * Wrap an Axios request with an AbortController for cancellation support.
 */
const makeCancellable = <T>(executor: (signal: AbortSignal) => Promise<T>): CancellableRequest<T> => {
  const controller = new AbortController()
  const promise = executor(controller.signal)
  return {
    promise,
    cancel: (reason?: string) => controller.abort(reason),
  }
}

// ============================================
// Request Wrapper
// ============================================

export interface RequestOptions {
  skipOnlineCheck?: boolean
  skipRetry?: boolean
  cacheTTL?: number // Cache TTL in ms, 0 to disable, default 1 min
  signal?: AbortSignal
  skipDedup?: boolean // Skip request deduplication
  params?: Record<string, unknown>
}

// ============================================
// Request Deduplication
// ============================================

/** Pending request tracker for deduplication */
const pendingRequests = new Map<string, Promise<unknown>>()

/**
 * Generate a deduplication key from request parameters.
 * Only GET requests are deduplicated by default (safe + idempotent).
 */
function getDedupKey(method: string, url: string, data?: unknown): string {
  const dataHash = data ? JSON.stringify(data) : ''
  return `${method}:${url}:${dataHash}`
}

/**
 * Clear a pending request from the deduplication tracker.
 */
function clearPendingRequest(key: string): void {
  pendingRequests.delete(key)
}

const request = async <T>(
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  url: string,
  data?: unknown,
  options: RequestOptions = {}
): Promise<T> => {
  if (!options.skipOnlineCheck && typeof navigator !== 'undefined' && !navigator.onLine) {
    return Promise.reject({
      code: 'NETWORK_ERROR',
      message: '当前处于离线状态，请检查您的网络连接',
    } as ApiError)
  }

  // Build cache key including params for GET requests
  const cacheKey = method === 'get' && options.params
    ? `${url}?${new URLSearchParams(options.params as Record<string, string>).toString()}`
    : url

  // Check cache for GET requests
  if (method === 'get' && options.cacheTTL !== 0) {
    const cached = apiCache.get<T>(cacheKey)
    if (cached) {
      return cached
    }
  }

  // Request deduplication for GET requests
  const dedupKey = getDedupKey(method, url, data)
  if (!options.skipDedup && method === 'get') {
    const existing = pendingRequests.get(dedupKey)
    if (existing) {
      return existing as Promise<T>
    }
  }

  const client = await getApiClient()

  const config: Record<string, unknown> = {}
  if (options.skipRetry) {
    config['axios-retry'] = { retries: 0 }
  }
  if (options.signal) {
    config['signal'] = options.signal
  }
  if (options.params) {
    config['params'] = options.params
  }

  const requestPromise = client.request<T>({
    method,
    url,
    data,
    ...config,
  }).then((response) => {
    // Unwrap backend ApiResponse envelope: {success, data} -> data
    // Falls back to response.data if envelope is absent (raw JSON, non-API endpoints).
    const body = response.data as unknown
    const unwrapped =
      body && typeof body === 'object' && 'data' in body && (body as { data?: unknown }).data !== undefined
        ? (body as { data: T }).data
        : (response.data as T)
    // Cache GET responses
    if (method === 'get') {
      apiCache.set(cacheKey, unwrapped as unknown, options.cacheTTL)
    }
    clearPendingRequest(dedupKey)
    return unwrapped
  }).catch((error) => {
    clearPendingRequest(dedupKey)
    throw error
  })

  // Track pending GET requests for deduplication
  if (!options.skipDedup && method === 'get') {
    pendingRequests.set(dedupKey, requestPromise)
  }

  return requestPromise
}

// Convenience method for GET requests
const get = <T>(url: string, params?: Record<string, unknown>, options?: RequestOptions): Promise<T> =>
  request<T>('get', url, undefined, { ...options, params })

// Convenience method for POST requests
const post = <T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> =>
  request<T>('post', url, data, options)

// Convenience method for PUT requests
const put = <T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> =>
  request<T>('put', url, data, options)

// Convenience method for PATCH requests
const patch = <T>(url: string, data?: unknown, options?: RequestOptions): Promise<T> =>
  request<T>('patch', url, data, options)

// Convenience method for DELETE requests
const del = <T>(url: string, options?: RequestOptions): Promise<T> =>
  request<T>('delete', url, undefined, options)

export { get, post, put, patch, del as delete }

// ============================================
// API Convenience Methods
// ============================================

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>, options?: RequestOptions) =>
    request<T>('get', url, undefined, { ...options, params }),

  post: <T>(url: string, data?: unknown, options?: RequestOptions) =>
    request<T>('post', url, data, options),

  put: <T>(url: string, data?: unknown, options?: RequestOptions) =>
    request<T>('put', url, data, options),

  patch: <T>(url: string, data?: unknown, options?: RequestOptions) =>
    request<T>('patch', url, data, options),

  delete: <T>(url: string, options?: RequestOptions) =>
    request<T>('delete', url, undefined, options),
}

// ============================================
// Health Check Polling
// ============================================

export interface HealthPollerOptions {
  intervalMs?: number
  timeoutMs?: number
  onHealthy?: () => void
  onUnhealthy?: (error: ApiError) => void
  onStatusChange?: (isHealthy: boolean) => void
}

let healthPollerId: ReturnType<typeof setInterval> | null = null

/**
 * Start polling the backend health endpoint.
 * Returns a function to stop polling.
 */
export const startHealthPolling = (options: HealthPollerOptions = {}): (() => void) => {
  const { intervalMs = 30000, timeoutMs = 5000 } = options

  if (healthPollerId) {
    clearInterval(healthPollerId)
  }

  let lastHealthy = true

  const check = async () => {
    try {
      const client = await getApiClient()
      await client.get('/health', { timeout: timeoutMs })
      if (!lastHealthy) {
        lastHealthy = true
        options.onHealthy?.()
        options.onStatusChange?.(true)
      }
    } catch (err) {
      const apiErr = err as ApiError
      if (lastHealthy && apiErr.code !== 'CANCELLED_ERROR') {
        lastHealthy = false
        options.onUnhealthy?.(apiErr)
        options.onStatusChange?.(false)
      }
    }
  }

  // Initial check
  check()

  healthPollerId = setInterval(check, intervalMs)

  return () => {
    if (healthPollerId) {
      clearInterval(healthPollerId)
      healthPollerId = null
    }
  }
}

// ============================================
// Named Exports
// ============================================

/** Get the raw Axios instance (initialized lazily). */
export const getAxiosInstance = async (): Promise<AxiosInstance> => getApiClient()

export { transformError }
export { makeCancellable, createApiClient, resolveBaseURL }

// Default export for backwards compatibility with existing imports
export default { get, post, put, patch, delete: del }
