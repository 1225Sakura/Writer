import { motion, AnimatePresence } from 'framer-motion'
import { useImmersiveModeContext } from './ImmersiveModeContext'

const IMMERSIVE_EASE = [0.16, 1, 0.3, 1] as const

/**
 * ImmersiveVignette - Ink wash style vignette overlay for immersive mode.
 * Uses enhancements.css vignette classes for consistent visual treatment.
 */
export function ImmersiveVignette() {
  const { immersiveMode } = useImmersiveModeContext()

  return (
    <AnimatePresence>
      {immersiveMode && (
        <motion.div
          key="vignette"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: IMMERSIVE_EASE }}
          className="fixed inset-0 pointer-events-none z-30 vignette-overlay-strong"
        />
      )}
    </AnimatePresence>
  )
}
