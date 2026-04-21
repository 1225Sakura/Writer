/**
 * LoadingOverlay — Full-screen or localized loading overlay with brand animation
 * Uses Framer Motion for smooth entrance/exit animations
 */

import { motion, AnimatePresence } from 'framer-motion'
import { Feather } from 'lucide-react'

interface LoadingOverlayProps {
  visible: boolean
  message?: string
  fullscreen?: boolean
  className?: string
}

export function LoadingOverlay({
  visible,
  message = '加载中...',
  fullscreen = true,
}: LoadingOverlayProps) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={
            fullscreen
              ? 'fixed inset-0 z-[100] flex flex-col items-center justify-center'
              : 'absolute inset-0 z-50 flex flex-col items-center justify-center rounded-lg'
          }
          style={{
            backgroundColor: fullscreen
              ? 'rgba(8, 9, 10, 0.85)'
              : 'rgba(8, 9, 10, 0.7)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {/* Brand logo animation — rotating feather/quill */}
          <div className="relative flex items-center justify-center mb-6">
            {/* Pulse ring effect */}
            <div
              className="absolute w-16 h-16 rounded-full animate-pulse-ring"
              style={{ backgroundColor: 'rgba(94, 106, 210, 0.2)' }}
            />
            <div
              className="absolute w-16 h-16 rounded-full animate-pulse-ring"
              style={{
                backgroundColor: 'rgba(94, 106, 210, 0.15)',
                animationDelay: '0.5s',
              }}
            />

            {/* Rotating feather icon */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: 'linear',
              }}
              className="relative z-10"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: 'rgba(94, 106, 210, 0.15)',
                  border: '1px solid rgba(94, 106, 210, 0.3)',
                }}
              >
                <Feather
                  className="w-6 h-6"
                  style={{ color: '#5e6ad2' }}
                />
              </div>
            </motion.div>
          </div>

          {/* Loading message */}
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.2 }}
            className="text-sm font-medium"
            style={{ color: '#d0d6e0' }}
          >
            {message}
          </motion.p>

          {/* Progress dots */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex gap-1.5 mt-3"
          >
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: '#5e6ad2' }}
                animate={{
                  opacity: [0.3, 1, 0.3],
                  scale: [0.8, 1.2, 0.8],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  delay: i * 0.2,
                  ease: 'easeInOut',
                }}
              />
            ))}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Simplified inline loading overlay for section-level loading */
export function SectionLoadingOverlay({
  visible,
  message = '加载中...',
}: {
  visible: boolean
  message?: string
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="absolute inset-0 z-40 flex flex-col items-center justify-center rounded-lg"
          style={{
            backgroundColor: 'rgba(8, 9, 10, 0.6)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          >
            <Feather className="w-5 h-5" style={{ color: '#5e6ad2' }} />
          </motion.div>
          <span
            className="text-xs mt-2"
            style={{ color: '#8a8f98' }}
          >
            {message}
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
