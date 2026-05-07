import { useState, useEffect, useCallback, useRef } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks'

// ============================================================
// TYPES
// ============================================================

export type ToastType = 'info' | 'success' | 'warning' | 'error'

export interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose: () => void
}

// ============================================================
// DESIGN TOKENS PER TYPE
// ============================================================

const typeConfig = {
  info: {
    icon: Info,
    borderColor: 'var(--color-info)',
    iconColor: 'var(--color-info)',
    glowColor: 'rgba(91, 142, 232, 0.15)',
    progressColor: 'rgba(91, 142, 232, 0.5)',
    ariaLabel: '信息提示',
  },
  success: {
    icon: CheckCircle,
    borderColor: 'var(--color-success)',
    iconColor: 'var(--color-success)',
    glowColor: 'rgba(126, 184, 74, 0.15)',
    progressColor: 'rgba(126, 184, 74, 0.5)',
    ariaLabel: '成功提示',
  },
  warning: {
    icon: AlertTriangle,
    borderColor: 'var(--color-warning)',
    iconColor: 'var(--color-warning)',
    glowColor: 'rgba(232, 184, 125, 0.15)',
    progressColor: 'rgba(232, 184, 125, 0.5)',
    ariaLabel: '警告提示',
  },
  error: {
    icon: AlertCircle,
    borderColor: 'var(--color-danger)',
    iconColor: 'var(--color-danger)',
    glowColor: 'rgba(196, 92, 92, 0.15)',
    progressColor: 'rgba(196, 92, 92, 0.5)',
    ariaLabel: '错误提示',
  },
}

// ============================================================
// SINGLE TOAST COMPONENT
// ============================================================

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [progress, setProgress] = useState(100)
  const startTimeRef = useRef(Date.now())
  const rafRef = useRef<number>()
  const reducedMotion = usePrefersReducedMotion()

  useEffect(() => {
    startTimeRef.current = Date.now()

    const updateProgress = () => {
      const elapsed = Date.now() - startTimeRef.current
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100)
      setProgress(remaining)
      if (remaining > 0) {
        rafRef.current = requestAnimationFrame(updateProgress)
      }
    }

    rafRef.current = requestAnimationFrame(updateProgress)
    const timer = setTimeout(onClose, duration)

    return () => {
      clearTimeout(timer)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [duration, onClose])

  const config = typeConfig[type]
  const Icon = config.icon

  const enterAnimation = reducedMotion ? { opacity: 0 } : { y: 24, opacity: 0, scale: 0.96 }
  const activeAnimation = reducedMotion ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }
  const exitAnimation = reducedMotion ? { opacity: 0 } : { y: 16, opacity: 0, scale: 0.96 }

  return (
    <motion.div
      layout={!reducedMotion}
      role="alert"
      aria-live="polite"
      aria-label={config.ariaLabel}
      initial={enterAnimation}
      animate={activeAnimation}
      exit={exitAnimation}
      transition={
        reducedMotion
          ? { duration: 0.15 }
          : { type: 'spring', stiffness: 400, damping: 28, mass: 0.8 }
      }
      className="relative flex items-start gap-3 px-4 py-3.5 rounded-xl border overflow-hidden min-w-[320px] max-w-[440px]"
      style={{
        background: 'var(--color-surface-overlay)',
        borderColor: 'var(--border-subtle)',
        borderLeftWidth: '3px',
        borderLeftColor: config.borderColor,
        boxShadow: `
          var(--shadow-card),
          0 0 20px ${config.glowColor}
        `,
      }}
    >
      {/* Gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${config.glowColor} 0%, transparent 60%)`,
        }}
      />

      {/* Icon */}
      <motion.div
        className="relative flex-shrink-0 mt-0.5"
        initial={reducedMotion ? { opacity: 0 } : { scale: 0, rotate: -45, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={
          reducedMotion
            ? { duration: 0.15 }
            : { type: 'spring', stiffness: 500, damping: 20, delay: 0.1 }
        }
      >
        <div
          className="flex items-center justify-center w-8 h-8 rounded-lg"
          style={{ backgroundColor: config.glowColor }}
        >
          <Icon className="w-4 h-4" style={{ color: config.iconColor }} aria-hidden="true" />
        </div>
      </motion.div>

      {/* Message */}
      <span
        className="text-sm font-medium flex-1 pr-2 leading-relaxed mt-1"
        style={{ color: 'var(--text-primary)' }}
      >
        {message}
      </span>

      {/* Close button */}
      <button
        onClick={onClose}
        className="relative flex-shrink-0 p-1.5 rounded-lg transition-all duration-200 hover:bg-[var(--color-surface-hover)] hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
        style={{ color: 'var(--text-tertiary)' }}
        aria-label="关闭提示"
      >
        <X className="w-4 h-4" aria-hidden="true" />
      </button>

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-xl"
        style={{ backgroundColor: 'var(--color-surface-base)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            width: `${progress}%`,
            backgroundColor: config.progressColor,
            boxShadow: `0 0 6px ${config.progressColor}`,
          }}
          transition={{ duration: 0 }}
        />
      </div>
    </motion.div>
  )
}

// ============================================================
// TOAST MANAGER
// ============================================================

let toastId = 0
let addToastHandler: ((message: string, type?: ToastType) => void) | null = null

export function showToast(message: string, type: ToastType = 'info') {
  if (addToastHandler) {
    addToastHandler(message, type)
  }
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: ToastType }>>([])

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++toastId
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  useEffect(() => {
    addToastHandler = addToast
    return () => { addToastHandler = null }
  }, [addToast])

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end"
      style={{ maxWidth: '440px' }}
      aria-live="polite"
      aria-atomic="true"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}
