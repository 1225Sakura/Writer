import { useState, useEffect, useCallback, useRef } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks'

export interface ToastProps {
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  duration?: number
  onClose: () => void
}

const typeConfig = {
  info: {
    icon: Info,
    leftBorder: 'var(--color-info)',
    iconColor: 'var(--color-info)',
    glowColor: 'rgba(91, 142, 232, 0.15)',
    progressColor: 'rgba(91, 142, 232, 0.5)',
  },
  success: {
    icon: CheckCircle,
    leftBorder: 'var(--color-success)',
    iconColor: 'var(--color-success)',
    glowColor: 'rgba(126, 184, 74, 0.15)',
    progressColor: 'rgba(126, 184, 74, 0.5)',
  },
  warning: {
    icon: AlertTriangle,
    leftBorder: 'var(--color-warning)',
    iconColor: 'var(--color-warning)',
    glowColor: 'rgba(232, 184, 125, 0.15)',
    progressColor: 'rgba(232, 184, 125, 0.5)',
  },
  error: {
    icon: AlertCircle,
    leftBorder: 'var(--color-danger)',
    iconColor: 'var(--color-danger)',
    glowColor: 'rgba(196, 92, 92, 0.15)',
    progressColor: 'rgba(196, 92, 92, 0.5)',
  },
}

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

  // Enhanced entrance/exit animations with slide + fade + scale
  const enterAnimation = reducedMotion
    ? { opacity: 0 }
    : { x: 100, opacity: 0, scale: 0.9 }

  const activeAnimation = reducedMotion
    ? { opacity: 1 }
    : { x: 0, opacity: 1, scale: 1 }

  const exitAnimation = reducedMotion
    ? { opacity: 0 }
    : { x: 60, opacity: 0, scale: 0.85 }

  return (
    <motion.div
      layout={!reducedMotion}
      initial={enterAnimation}
      animate={activeAnimation}
      exit={exitAnimation}
      transition={
        reducedMotion
          ? { duration: 0.15 }
          : {
              type: 'spring',
              stiffness: 400,
              damping: 28,
              mass: 0.8,
            }
      }
      className="relative flex items-start gap-3 px-4 py-3.5 rounded-xl border backdrop-blur-md overflow-hidden min-w-[320px] max-w-[440px]"
      style={{
        background: 'rgba(26, 26, 30, 0.85)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderLeftWidth: '3px',
        borderLeftColor: config.leftBorder,
        boxShadow: `
          0 8px 32px rgba(0, 0, 0, 0.28),
          0 2px 8px rgba(0, 0, 0, 0.14),
          inset 0 1px 0 rgba(255, 255, 255, 0.04),
          0 0 20px ${config.glowColor}
        `,
      }}
    >
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 pointer-events-none rounded-xl"
        style={{
          background: `linear-gradient(135deg, ${config.glowColor} 0%, transparent 60%)`,
        }}
      />

      {/* Icon with scale + rotate entrance animation */}
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
          style={{
            backgroundColor: config.glowColor,
          }}
        >
          <Icon
            className="w-4 h-4"
            style={{ color: config.iconColor }}
          />
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
        className="relative flex-shrink-0 p-1.5 rounded-lg transition-all duration-200 hover:bg-white/10 hover:scale-110 active:scale-95"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress bar - countdown indicator */}
      <div
        className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-xl"
        style={{ backgroundColor: 'rgba(255, 255, 255, 0.04)' }}
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

      {/* Left colored accent bar (additional visual indicator) */}
      <div
        className="absolute left-0 top-3 bottom-3 w-[3px] rounded-full"
        style={{
          backgroundColor: config.leftBorder,
          opacity: 0.8,
        }}
      />
    </motion.div>
  )
}

// Toast manager
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
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end"
      style={{ maxWidth: '440px' }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
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
