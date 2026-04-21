import { useState, useEffect, useCallback, useRef } from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface ToastProps {
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  duration?: number
  onClose: () => void
}

const typeConfig = {
  info: {
    bg: 'bg-[#5e6ad2]',
    icon: Info,
    progressColor: 'bg-white/40',
  },
  success: {
    bg: 'bg-[#7eb84a]',
    icon: CheckCircle,
    progressColor: 'bg-white/40',
  },
  warning: {
    bg: 'bg-[#e8b87d]',
    icon: AlertTriangle,
    progressColor: 'bg-white/40',
  },
  error: {
    bg: 'bg-[#c45c5c]',
    icon: AlertCircle,
    progressColor: 'bg-white/40',
  },
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [progress, setProgress] = useState(100)
  const startTimeRef = useRef(Date.now())
  const rafRef = useRef<number>()

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

  return (
    <motion.div
      layout
      initial={{ x: 80, opacity: 0, scale: 0.95 }}
      animate={{ x: 0, opacity: 1, scale: 1 }}
      exit={{ y: -20, opacity: 0, scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
      }}
      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 shadow-lg overflow-hidden ${config.bg} text-white min-w-[280px] max-w-[400px]`}
    >
      <Icon className="w-5 h-5 flex-shrink-0 opacity-90" />
      <span className="text-sm font-medium flex-1 pr-2">{message}</span>
      <button
        onClick={onClose}
        className="p-1 hover:bg-white/20 rounded-md transition-colors flex-shrink-0"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/10">
        <motion.div
          className={`h-full ${config.progressColor}`}
          style={{ width: `${progress}%` }}
          transition={{ duration: 0 }}
        />
      </div>
    </motion.div>
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
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
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
