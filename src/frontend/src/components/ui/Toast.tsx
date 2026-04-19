import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'

export interface ToastProps {
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  duration?: number
  onClose: () => void
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  const bgColors = {
    info: 'bg-var-accent',
    success: 'bg-[#10b981]',
    warning: 'bg-var-vermillion',
    error: 'bg-red-600',
  }

  return (
    <div
      className={`fixed bottom-4 right-4 px-4 py-3 rounded-lg border border-var-border ${bgColors[type]} text-white flex items-center gap-3 z-50 animate-slide-in`}
    >
      <span className="text-sm">{message}</span>
      <button
        onClick={onClose}
        className="p-1 hover:opacity-80 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// Toast 管理器
let toastId = 0
let addToastHandler: ((message: string, type?: ToastProps['type']) => void) | null = null

export function showToast(message: string, type: ToastProps['type'] = 'info') {
  if (addToastHandler) {
    addToastHandler(message, type)
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: ToastProps['type'] }>>([])

  const addToast = useCallback((message: string, type: ToastProps['type'] = 'info') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => {
    addToastHandler = addToast
    return () => { addToastHandler = null }
  }, [addToast])

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  )
}
