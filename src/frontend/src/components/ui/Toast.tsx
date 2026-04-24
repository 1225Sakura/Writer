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
    bg: 'bg-gradient-to-br from-[#5b8ee8] to-[#4a7ad0]',
    borderColor: 'rgba(91, 142, 232, 0.4)',
    icon: Info,
    progressColor: 'bg-white/30',
    textColor: 'text-white',
    shadowColor: 'rgba(91, 142, 232, 0.25)',
  },
  success: {
    bg: 'bg-gradient-to-br from-[#7eb84a] to-[#6aa33d]',
    borderColor: 'rgba(126, 184, 74, 0.4)',
    icon: CheckCircle,
    progressColor: 'bg-white/30',
    textColor: 'text-white',
    shadowColor: 'rgba(126, 184, 74, 0.25)',
  },
  warning: {
    bg: 'bg-gradient-to-br from-[#e8b87d] to-[#d4a366]',
    borderColor: 'rgba(232, 184, 125, 0.4)',
    icon: AlertTriangle,
    progressColor: 'bg-white/30',
    textColor: 'text-white',
    shadowColor: 'rgba(232, 184, 125, 0.25)',
  },
  error: {
    bg: 'bg-gradient-to-br from-[#c45c5c] to-[#b04a4a]',
    borderColor: 'rgba(196, 92, 92, 0.4)',
    icon: AlertCircle,
    progressColor: 'bg-white/30',
    textColor: 'text-white',
    shadowColor: 'rgba(196, 92, 92, 0.25)',
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

  // 根据 reduced-motion 选择动画参数 - 优化进入/退出动画
  const enterAnimation = reducedMotion
    ? { opacity: 0 }
    : { x: 80, opacity: 0, scale: 0.92, rotateY: -8 }

  const activeAnimation = reducedMotion
    ? { opacity: 1 }
    : { x: 0, opacity: 1, scale: 1, rotateY: 0 }

  const exitAnimation = reducedMotion
    ? { opacity: 0 }
    : { x: 60, opacity: 0, scale: 0.88, rotateY: 4 }

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
              stiffness: 380,
              damping: 30,
              mass: 0.7,
            }
      }
      style={{
        boxShadow: `0 8px 32px ${config.shadowColor}, 0 2px 8px rgba(0,0,0,0.12)`,
      }}
      className={`relative flex items-center gap-3 px-4 py-3.5 rounded-2xl border backdrop-blur-sm overflow-hidden ${config.bg} ${config.textColor} min-w-[300px] max-w-[420px]`}
    >
      <div className="relative">
        <Icon className="w-5 h-5 flex-shrink-0 drop-shadow-md" />
      </div>
      <span className="text-sm font-medium flex-1 pr-2 leading-tight">{message}</span>
      <button
        onClick={onClose}
        className="p-1.5 hover:bg-white/15 rounded-lg transition-all duration-200 flex-shrink-0 hover:scale-110 active:scale-95"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/10">
        <motion.div
          className={`h-full ${config.progressColor}`}
          style={{ width: `${progress}%` }}
          transition={{ duration: 0 }}
        />
      </div>
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
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-3 items-end">
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
