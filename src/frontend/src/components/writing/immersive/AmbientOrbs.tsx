import { motion, AnimatePresence } from 'framer-motion'
import { useImmersiveModeContext } from './ImmersiveModeContext'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'

const IMMERSIVE_EASE = [0.16, 1, 0.3, 1] as const

export function AmbientOrbs() {
  const { immersiveMode } = useImmersiveModeContext()
  const prefersReducedMotion = usePrefersReducedMotion()

  return (
    <AnimatePresence>
      {immersiveMode && (
        <motion.div
          key="ambient-glow"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 2.0, ease: IMMERSIVE_EASE }}
          className="fixed inset-0 pointer-events-none z-25"
        >
          {/* Orb 1: Top-right warm glow - character orange, large and soft */}
          <div
            className="absolute rounded-full"
            style={{
              width: '28rem',
              height: '28rem',
              top: '-12%',
              right: '-8%',
              background: 'radial-gradient(circle, color-mix(in srgb, var(--color-character) 5%, transparent) 0%, color-mix(in srgb, var(--color-character) 1.5%, transparent) 35%, transparent 70%)',
              filter: 'blur(70px)',
              animation: prefersReducedMotion ? 'none' : 'ambient-orb-float 18s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
            }}
          />
          {/* Orb 2: Bottom-left cool glow - outline blue, medium drift */}
          <div
            className="absolute rounded-full"
            style={{
              width: '22rem',
              height: '22rem',
              bottom: '-10%',
              left: '-5%',
              background: 'radial-gradient(circle, color-mix(in srgb, var(--color-outline) 4%, transparent) 0%, color-mix(in srgb, var(--color-outline) 1%, transparent) 40%, transparent 75%)',
              filter: 'blur(80px)',
              animation: prefersReducedMotion ? 'none' : 'ambient-orb-float 22s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite reverse',
            }}
          />
          {/* Orb 3: Subtle center glow - primary accent, very soft */}
          <div
            className="absolute rounded-full"
            style={{
              width: '20rem',
              height: '20rem',
              top: '45%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              background: 'radial-gradient(circle, color-mix(in srgb, var(--accent-primary) 2.5%, transparent) 0%, color-mix(in srgb, var(--accent-primary) 0.8%, transparent) 45%, transparent 80%)',
              filter: 'blur(90px)',
              animation: prefersReducedMotion ? 'none' : 'ambient-orb-float 20s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
              animationDelay: prefersReducedMotion ? '0s' : '-6s',
            }}
          />
          {/* Orb 4: Small accent - IF line green, upper left */}
          <div
            className="absolute rounded-full"
            style={{
              width: '14rem',
              height: '14rem',
              top: '10%',
              left: '-3%',
              background: 'radial-gradient(circle, color-mix(in srgb, var(--color-ifline) 2.5%, transparent) 0%, transparent 65%)',
              filter: 'blur(60px)',
              animation: prefersReducedMotion ? 'none' : 'ambient-orb-float 15s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite',
              animationDelay: prefersReducedMotion ? '0s' : '-3s',
            }}
          />
          {/* Orb 5: Small accent - item purple, lower right */}
          <div
            className="absolute rounded-full"
            style={{
              width: '12rem',
              height: '12rem',
              bottom: '8%',
              right: '-2%',
              background: 'radial-gradient(circle, color-mix(in srgb, var(--color-item) 2.5%, transparent) 0%, transparent 65%)',
              filter: 'blur(60px)',
              animation: prefersReducedMotion ? 'none' : 'ambient-orb-float 17s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite reverse',
              animationDelay: prefersReducedMotion ? '0s' : '-8s',
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
