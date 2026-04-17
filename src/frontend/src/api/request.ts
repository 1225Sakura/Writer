import axios, {
  type AxiosInstance,
  type AxiosError,
  type InternalAxiosRequestConfig,
  type AxiosResponse,
} from 'axios'
import axiosRetry from 'axios-retry'

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
    | 'UNKNOWN_ERROR'
  message: string
  statusCode?: number
  originalError?: unknown
}

// ============================================
// API Client Setup
// ============================================

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string) || 'http://127.0.0.1:8000/api'

const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ============================================
// Error Transformation
// ============================================

const transformError = (err: unknown): ApiError => {
  const error = err as AxiosError

  if (!error.response) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
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
      const data = error.response?.data as { detail?: string; message?: string }
      return {
        code: 'UNKNOWN_ERROR',
        message: data?.detail || data?.message || '请求失败，请稍后重试',
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
    case 'SERVER_ERROR':
      return '服务器内部错误，请稍后重试'
    default:
      return error.message || '请求失败，请稍后重试'
  }
}

// ============================================
// Request Interceptor
// ============================================

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token')
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`
    }
    // Add timestamp for GET requests to avoid caching
    if (config.method === 'get' && config.params) {
      config.params = { ...config.params, _t: Date.now() }
    } else if (config.method === 'get') {
      config.params = { _t: Date.now() }
    }
    return config
  },
  (error) => {
    return Promise.reject(transformError(error))
  }
)

// ============================================
// Response Interceptor
// ============================================

apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response
  },
  (error: AxiosError) => {
    return Promise.reject(transformError(error))
  }
)

// ============================================
// Retry Configuration
// ============================================

axiosRetry(apiClient, {
  retries: 3,
  retryDelay: (retryCount) => {
    return retryCount * 1000 // Exponential backoff: 1s, 2s, 4s
  },
  retryCondition: (error) => {
    if (!error.response) {
      return true // Retry on network errors
    }
    const status = error.response.status
    return status >= 500 || status === 408 || status === 429
  },
  onRetry: (retryCount, error) => {
    console.log(`[API Retry] Attempt ${retryCount} for ${error.config?.url}`)
  },
})

// ============================================
// Offline Detection
// ============================================

let isOnline = navigator.onLine

type OnlineCallback = () => void

const onlineListeners: OnlineCallback[] = []
const offlineListeners: OnlineCallback[] = []

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
  onOffline: OnlineCallback
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
// API Request Wrapper
// ============================================

interface RequestOptions {
  skipOnlineCheck?: boolean
  skipRetry?: boolean
}

const request = async <T>(
  method: 'get' | 'post' | 'put' | 'delete' | 'patch',
  url: string,
  data?: unknown,
  options: RequestOptions = {}
): Promise<T> => {
  if (!options.skipOnlineCheck && !navigator.onLine) {
    return Promise.reject({
      code: 'NETWORK_ERROR',
      message: '当前处于离线状态，请检查您的网络连接',
    } as ApiError)
  }

  const config: Record<string, unknown> = {}
  if (options.skipRetry) {
    config['axios-retry'] = { retries: 0 }
  }

  const response = await apiClient.request<T>({
    method,
    url,
    data,
    ...config,
  })

  return response.data
}

// Convenience method for GET requests (used by chat.ts and settings.ts)
const get = <T>(url: string, params?: Record<string, unknown>): Promise<T> =>
  request<T>('get', url, { params })

// Convenience method for POST requests
const post = <T>(url: string, data?: unknown): Promise<T> =>
  request<T>('post', url, data)

// Convenience method for PUT requests
const put = <T>(url: string, data?: unknown): Promise<T> =>
  request<T>('put', url, data)

// Convenience method for PATCH requests
const patch = <T>(url: string, data?: unknown): Promise<T> =>
  request<T>('patch', url, data)

// Convenience method for DELETE requests
const del = <T>(url: string): Promise<T> =>
  request<T>('delete', url)

export { get, post, put, patch, del as delete }

// ============================================
// API Convenience Methods
// ============================================

export const api = {
  get: <T>(url: string, params?: Record<string, unknown>, options?: RequestOptions) =>
    request<T>('get', url, { params }, options),

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
// Named Exports
// ============================================

export { apiClient }
export { transformError }

// Default export for backwards compatibility with existing imports
export default { get, post, put, patch, delete: del }
