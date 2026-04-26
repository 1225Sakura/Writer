import { motion, AnimatePresence } from 'framer-motion'
import { useImmersiveModeContext } from './ImmersiveModeContext'

const IMMERSIVE_EASE = [0.16, 1, 0.3, 1] as const

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
          transition={{ duration: 1.4, ease: IMMERSIVE_EASE }}
          className="fixed inset-0 pointer-events-none z-30 immersive-vignette"
          style={{
            background: `
              /* Layer 1: Outer deep vignette - softest falloff */
              radial-gradient(ellipse 100% 95% at 50% 50%, transparent 35%, color-mix(in srgb, var(--ink-100) 20%, transparent) 65%, color-mix(in srgb, var(--ink-100) 65%, transparent) 100%),
              /* Layer 2: Mid vignette - medium depth */
              radial-gradient(ellipse 80% 70% at 50% 50%, transparent 45%, color-mix(in srgb, var(--ink-95) 15%, transparent) 75%, color-mix(in srgb, var(--ink-95) 40%, transparent) 100%),
              /* Layer 3: Inner vignette - tight focus */
              radial-gradient(ellipse 55% 50% at 50% 50%, transparent 55%, color-mix(in srgb, var(--ink-90) 10%, transparent) 85%, color-mix(in srgb, var(--ink-90) 25%, transparent) 100%),
              /* Layer 4: Warm paper center glow - reduces eye strain */
              radial-gradient(ellipse 30% 25% at 50% 50%, color-mix(in srgb, var(--paper-100) 5%, transparent) 0%, transparent 60%),
              /* Layer 5: Subtle character warmth at focus area */
              radial-gradient(ellipse 20% 18% at 50% 50%, color-mix(in srgb, var(--color-character) 2%, transparent) 0%, transparent 75%)
            `,
          }}
        />
      )}
    </AnimatePresence>
  )
}
