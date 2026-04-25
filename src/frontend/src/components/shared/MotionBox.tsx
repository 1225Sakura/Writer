import { ReactNode } from 'react'
import { motion, MotionProps } from 'framer-motion'
import { useUIStore } from '@/store'

interface MotionBoxProps extends Omit<MotionProps, 'transition'> {
  children: ReactNode
  className?: string
  /** CSS transition duration in ms for degraded mode (default: 150) */
  degradedDuration?: number
  style?: React.CSSProperties
}

/**
 * MotionBox - A motion.div wrapper that degrades to CSS transitions
 * when reducedMotion or lowPerformanceMode is enabled in useUIStore.
 *
 * Usage: Replace motion.div with MotionBox for consistent degraded behavior.
 */
export function MotionBox({
  children,
  className,
  degradedDuration = 150,
  style,
  ...motionProps
}: MotionBoxProps) {
  const { reducedMotion, lowPerformanceMode } = useUIStore()

  if (reducedMotion || lowPerformanceMode) {
    // Degraded: render as plain div with CSS transition
    return (
      <div
        className={className}
        style={{
          transition: `all ${degradedDuration}ms ease`,
          ...style,
        }}
        {...(motionProps as Record<string, unknown>)}
      >
        {children}
      </div>
    )
  }

  // Normal: full Framer Motion animation
  return (
    <motion.div className={className} style={style} {...motionProps}>
      {children}
    </motion.div>
  )
}
