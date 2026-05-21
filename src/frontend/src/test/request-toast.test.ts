import { describe, it, expect, vi } from 'vitest'
import {
  api,
  getApiClient,
  transformError,
  getErrorMessage,
  isApiError,
  isRetryableError,
  isCancelledError,
  getOnlineStatus,
  setupOnlineDetection,
} from '@/api/request'

// Mock axios and dependencies
vi.mock('axios', () => {
  const mockAxiosInstance = {
    request: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({ data: {} }),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
    patch: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  }
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      isCancel: vi.fn(() => false),
    },
    AxiosError: class AxiosError extends Error {},
  }
})

vi.mock('axios-retry', () => ({
  default: vi.fn(),
}))

vi.mock('@/utils/cache', () => ({
  apiCache: {
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
  },
}))

describe('request utility', () => {
  it('should export the api convenience object', () => {
    expect(api).toBeDefined()
    expect(typeof api.get).toBe('function')
    expect(typeof api.post).toBe('function')
    expect(typeof api.put).toBe('function')
    expect(typeof api.patch).toBe('function')
    expect(typeof api.delete).toBe('function')
  })

  it('should export getApiClient', () => {
    expect(typeof getApiClient).toBe('function')
  })

  it('should export transformError', () => {
    expect(typeof transformError).toBe('function')
  })

  it('should export getErrorMessage', () => {
    expect(typeof getErrorMessage).toBe('function')
  })

  it('should export error check utilities', () => {
    expect(typeof isApiError).toBe('function')
    expect(typeof isRetryableError).toBe('function')
    expect(typeof isCancelledError).toBe('function')
  })

  it('should export online detection utilities', () => {
    expect(typeof getOnlineStatus).toBe('function')
    expect(typeof setupOnlineDetection).toBe('function')
  })

  it('should return correct messages for known error codes', () => {
    expect(getErrorMessage({ code: 'NETWORK_ERROR', message: '' })).toContain('网络')
    expect(getErrorMessage({ code: 'TIMEOUT_ERROR', message: '' })).toContain('超时')
    expect(getErrorMessage({ code: 'AUTH_ERROR', message: '' })).toContain('登录')
    expect(getErrorMessage({ code: 'SERVER_ERROR', message: '' })).toContain('服务器')
    expect(getErrorMessage({ code: 'CANCELLED_ERROR', message: '' })).toContain('取消')
  })

  it('should identify retryable errors', () => {
    expect(isRetryableError({ code: 'NETWORK_ERROR', message: '' })).toBe(true)
    expect(isRetryableError({ code: 'TIMEOUT_ERROR', message: '' })).toBe(true)
    expect(isRetryableError({ code: 'SERVER_ERROR', message: '' })).toBe(true)
    expect(isRetryableError({ code: 'AUTH_ERROR', message: '' })).toBe(false)
    expect(isRetryableError(null)).toBe(false)
  })

  it('should identify API errors by code', () => {
    expect(isApiError({ code: 'AUTH_ERROR', message: '' }, 'AUTH_ERROR')).toBe(true)
    expect(isApiError({ code: 'NETWORK_ERROR', message: '' }, 'AUTH_ERROR')).toBe(false)
    expect(isApiError(null, 'AUTH_ERROR')).toBe(false)
    expect(isApiError('string', 'AUTH_ERROR')).toBe(false)
  })

  it('should transform axios-like errors', () => {
    // Network error (no response)
    const networkErr = { response: undefined, message: 'Network Error', code: 'ERR_NETWORK' }
    const result = transformError(networkErr)
    expect(result.code).toBe('NETWORK_ERROR')
    expect(result.message).toBeTruthy()
  })

  it('should handle setupOnlineDetection cleanup', () => {
    const onOnline = vi.fn()
    const onOffline = vi.fn()
    const cleanup = setupOnlineDetection(onOnline, onOffline)
    expect(typeof cleanup).toBe('function')
    cleanup() // Should not throw
  })

  it('should return a boolean from getOnlineStatus', () => {
    const status = getOnlineStatus()
    expect(typeof status).toBe('boolean')
  })
})
