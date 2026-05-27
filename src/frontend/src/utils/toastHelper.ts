/**
 * Toast helper for stores and async operations.
 * Provides a consistent way to show success/error/info toasts
 * without directly importing React components into store files.
 */

import { useUIStore } from '@/store'
import type { ApiError } from '@/api/request'
import { isRetryableError } from '@/api/request'

export { isRetryableError }

type ToastType = 'info' | 'success' | 'warning' | 'error'

interface ToastOptions {
  duration?: number
  type?: ToastType
}

/** Show a toast notification via the UI store */
export function showToast(message: string, options: ToastOptions = {}) {
  const { type = 'info', duration = 3000 } = options
  try {
    useUIStore.getState().addToast({
      message,
      type,
      duration,
    })
  } catch {
    // Store not initialized yet — toast silently dropped
  }
}

/** Show a success toast */
export function showSuccess(message: string, duration = 3000) {
  showToast(message, { type: 'success', duration })
}

/** Show an error toast */
export function showError(message: string, duration = 5000) {
  showToast(message, { type: 'error', duration })
}

/** Show a warning toast */
export function showWarning(message: string, duration = 4000) {
  showToast(message, { type: 'warning', duration })
}

/** Show an info toast */
export function showInfo(message: string, duration = 3000) {
  showToast(message, { type: 'info', duration })
}

/**
 * Convert an API error to a user-friendly toast message.
 * Preserves the original error code for debugging while showing a friendly message.
 */
export function showApiError(error: unknown, fallbackMessage = '操作失败') {
  if (error && typeof error === 'object' && 'code' in error) {
    const apiError = error as ApiError
    const messages: Record<string, string> = {
      NETWORK_ERROR: '网络连接失败，请检查网络设置',
      TIMEOUT_ERROR: '请求超时，请稍后重试',
      AUTH_ERROR: '登录已过期，请重新登录',
      FORBIDDEN_ERROR: '您没有权限执行此操作',
      NOT_FOUND: '请求的资源不存在',
      RATE_LIMIT_ERROR: '请求过于频繁，请稍后再试',
      VALIDATION_ERROR: apiError.message || '请求参数错误',
      SERVER_ERROR: '服务器内部错误，请稍后重试',
      CANCELLED_ERROR: '请求已取消',
      UNKNOWN_ERROR: apiError.message || fallbackMessage,
    }
    const msg = messages[apiError.code] || apiError.message || fallbackMessage
    showError(msg)
    return msg
  }

  const msg = error instanceof Error ? error.message : fallbackMessage
  showError(msg)
  return msg
}

/**
 * Show a toast for a successful async operation.
 */
export function showOperationSuccess(operationName: string) {
  showSuccess(`${operationName}成功`)
}

/**
 * Show a toast for a failed async operation with retry suggestion.
 */
export function showOperationError(operationName: string, error: unknown, retryable?: boolean) {
  const suffix = retryable ? '，请重试' : ''
  if (error && typeof error === 'object' && 'code' in error) {
    const apiError = error as ApiError
    showApiError(apiError, `${operationName}失败${suffix}`)
  } else {
    const msg = error instanceof Error ? error.message : `${operationName}失败${suffix}`
    showError(msg)
  }
}

/**
 * Wrap an async function with toast notifications.
 * Shows success on completion, error on failure.
 */
export async function withToast<T>(
  operation: () => Promise<T>,
  options: {
    successMessage?: string
    errorMessage?: string
    showSuccess?: boolean
    showError?: boolean
  } = {}
): Promise<T | undefined> {
  const { successMessage, errorMessage, showSuccess: showSuccessToast = true, showError: showErrorToast = true } = options

  try {
    const result = await operation()
    if (showSuccessToast && successMessage) {
      showSuccess(successMessage)
    }
    return result
  } catch (error) {
    if (showErrorToast) {
      showApiError(error, errorMessage || '操作失败')
    }
    throw error
  }
}
