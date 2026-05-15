/**
 * IconSpinners - Icon-based animated spinner components for LoadingOverlayVariant.
 */

import { motion } from 'framer-motion'
import { Feather, BookOpen, Pen, Sparkles } from 'lucide-react'

export type LoadingVariant = 'feather' | 'book' | 'pen' | 'sparkle' | 'orbit' | 'bars' | 'pulseRing' | 'gradientSpinner' | 'textSkeleton'

interface SpinnerProps {
  size?: string
  color?: string
}

/** FeatherSpinner - Feather icon rotation animation */
export function FeatherSpinner({ size = 'md', color = 'var(--accent-primary)' }: SpinnerProps) {
  const sizeMap = { sm: 24, md: 36, lg: 48 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 36

  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
    >
      <Feather className="opacity-80" style={{ width: iconSize, height: iconSize, color }} />
    </motion.div>
  )
}

/** BookSpinner - Book page-flip animation */
export function BookSpinner({ size = 'md', color = 'var(--accent-primary)' }: SpinnerProps) {
  const sizeMap = { sm: 28, md: 40, lg: 56 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 40

  return (
    <div className="relative" style={{ width: iconSize, height: iconSize }}>
      <motion.div
        className="absolute inset-0"
        animate={{ rotateY: [0, -30, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        style={{ perspective: 100 }}
      >
        <BookOpen style={{ width: iconSize, height: iconSize, color }} />
      </motion.div>
    </div>
  )
}

/** PenSpinner - Pen wobble animation */
export function PenSpinner({ size = 'md', color = 'var(--accent-primary)' }: SpinnerProps) {
  const sizeMap = { sm: 24, md: 36, lg: 48 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 36

  return (
    <motion.div
      animate={{ rotate: [0, 15, -15, 0], y: [0, -4, 0] }}
      transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
    >
      <Pen style={{ width: iconSize, height: iconSize, color }} />
    </motion.div>
  )
}

/** SparkleSpinner - Sparkle pulse animation */
export function SparkleSpinner({ size = 'md', color = 'var(--accent-primary)' }: SpinnerProps) {
  const sizeMap = { sm: 24, md: 36, lg: 48 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 36

  return (
    <motion.div
      animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
      transition={{ duration: 1, repeat: Infinity }}
    >
      <Sparkles style={{ width: iconSize, height: iconSize, color }} />
    </motion.div>
  )
}

/** OrbitSpinner - Orbiting dot with central icon */
export function OrbitSpinner({ size = 'md', color = 'var(--accent-primary)' }: SpinnerProps) {
  const sizeMap = { sm: 32, md: 48, lg: 64 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 48

  return (
    <div className="relative" style={{ width: iconSize, height: iconSize }}>
      <motion.div
        className="absolute inset-0 border-2 border-dashed rounded-full"
        style={{ borderColor: `${color}40` }}
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute inset-1"
        animate={{ rotate: -360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: color, position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}
        />
      </motion.div>
      <motion.div
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
        className="absolute inset-0 flex items-center justify-center"
      >
        <Feather style={{ width: iconSize * 0.4, height: iconSize * 0.4, color }} />
      </motion.div>
    </div>
  )
}

/** BarsSpinner - Animated bar equalizer */
export function BarsSpinner({ size = 'md', color = 'var(--accent-primary)' }: SpinnerProps) {
  const sizeMap = { sm: 24, md: 36, lg: 48 }
  const iconSize = sizeMap[size as keyof typeof sizeMap] ?? 36

  return (
    <div className="flex items-center gap-1" style={{ height: iconSize }}>
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="w-1 rounded-full"
          style={{ backgroundColor: color, height: '60%' }}
          animate={{ scaleY: [0.4, 1, 0.4] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            delay: i * 0.1,
            ease: 'easeInOut',
          }}
        />
      ))}
    </div>
  )
}

/** PulseRingSpinner - Multi-layer expanding pulse rings */
export function PulseRingSpinner({ size = 'md', color = 'var(--accent-primary)' }: SpinnerProps) {
  const sizeMap = { sm: 48, md: 64, lg: 88 }
  const containerSize = sizeMap[size as keyof typeof sizeMap] ?? 64
  const ringCount = 3

  return (
    <div className="relative flex items-center justify-center" style={{ width: containerSize, height: containerSize }}>
      {Array.from({ length: ringCount }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: containerSize * (0.4 + i * 0.25),
            height: containerSize * (0.4 + i * 0.25),
            border: `2px solid ${color}`,
            opacity: 0.6 - i * 0.15,
          }}
          animate={{
            scale: [1, 1.4 + i * 0.1, 1],
            opacity: [0.6 - i * 0.15, 0, 0.6 - i * 0.15],
          }}
          transition={{
            duration: 2 + i * 0.3,
            repeat: Infinity,
            ease: 'easeInOut',
            delay: i * 0.4,
          }}
        />
      ))}
      {/* Center dot */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: containerSize * 0.12,
          height: containerSize * 0.12,
          backgroundColor: color,
          boxShadow: `0 0 ${containerSize * 0.15}px ${color}60`,
        }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

/** GradientSpinner - Conic gradient rotating ring */
export function GradientSpinner({ size = 'md', color = 'var(--accent-primary)' }: SpinnerProps) {
  const sizeMap = { sm: 40, md: 56, lg: 80 }
  const spinnerSize = sizeMap[size as keyof typeof sizeMap] ?? 56
  const borderWidth = Math.max(2, spinnerSize / 14)

  return (
    <div className="relative flex items-center justify-center" style={{ width: spinnerSize, height: spinnerSize }}>
      {/* Outer rotating gradient ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: spinnerSize,
          height: spinnerSize,
          background: `conic-gradient(from 0deg, ${color}, ${color}40, ${color}10, ${color}40, ${color})`,
          mask: `radial-gradient(circle, transparent ${spinnerSize / 2 - borderWidth}px, black ${spinnerSize / 2 - borderWidth + 0.5}px)`,
          WebkitMask: `radial-gradient(circle, transparent ${spinnerSize / 2 - borderWidth}px, black ${spinnerSize / 2 - borderWidth + 0.5}px)`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
      />
      {/* Inner glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: spinnerSize * 0.6,
          height: spinnerSize * 0.6,
          background: `radial-gradient(circle, ${color}20 0%, transparent 70%)`,
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Center dot */}
      <div
        className="absolute rounded-full"
        style={{
          width: spinnerSize * 0.1,
          height: spinnerSize * 0.1,
          backgroundColor: color,
          boxShadow: `0 0 ${spinnerSize * 0.12}px ${color}50`,
        }}
      />
    </div>
  )
}

/** TextSkeletonSpinner - Text skeleton with shimmer sweep */
export function TextSkeletonSpinner({ size = 'md', color = 'var(--accent-primary)' }: SpinnerProps) {
  const sizeMap = { sm: 160, md: 240, lg: 320 }
  const width = sizeMap[size as keyof typeof sizeMap] ?? 240
  const lineHeights = size === 'sm' ? [12, 10, 10] : size === 'lg' ? [20, 14, 14, 14] : [16, 12, 12, 12]
  const lineWidths = size === 'sm' ? ['70%', '100%', '85%'] : size === 'lg' ? ['60%', '100%', '90%', '75%'] : ['65%', '100%', '88%', '80%']

  return (
    <div className="flex flex-col items-center gap-3" style={{ width }}>
      <div className="w-full space-y-2.5">
        {lineHeights.map((h, i) => (
          <div key={i} className="relative overflow-hidden rounded-md" style={{ width: lineWidths[i], height: h }}>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(90deg, ${color}10, ${color}25, ${color}10)`,
                backgroundSize: '200% 100%',
                animation: 'shimmer-skeleton 1.5s ease-in-out infinite',
              }}
            />
          </div>
        ))}
      </div>
      {/* Animated dots below */}
      <div className="flex gap-1.5 mt-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color }}
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
      </div>
    </div>
  )
}

/** Map of all spinner variants to their components */
export const spinners: Record<LoadingVariant, React.FC<SpinnerProps>> = {
  feather: FeatherSpinner,
  book: BookSpinner,
  pen: PenSpinner,
  sparkle: SparkleSpinner,
  orbit: OrbitSpinner,
  bars: BarsSpinner,
  pulseRing: PulseRingSpinner,
  gradientSpinner: GradientSpinner,
  textSkeleton: TextSkeletonSpinner,
}
