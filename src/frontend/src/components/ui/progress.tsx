import * as React from 'react'
import * as ProgressPrimitive from '@radix-ui/react-progress'
import { motion, useSpring, useTransform } from 'framer-motion'
import { cn } from '@/lib/utils'

export interface ProgressProps extends React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> {
  gradient?: boolean
  gradientColors?: [string, string]
  animated?: boolean
  glowIntensity?: number
}

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  ProgressProps
>(({ className, value, gradient = false, gradientColors, glowIntensity, ...props }, ref) => {
  const clampedValue = Math.min(Math.max(value || 0, 0), 100)
  const [_displayValue, _setDisplayValue] = React.useState(clampedValue)

  const springValue = useSpring(clampedValue, {
    stiffness: 120,
    damping: 18,
    mass: 0.8,
  })

  const scaleX = useTransform(springValue, [0, 100], [0, 1])

  React.useEffect(() => {
    springValue.set(clampedValue)
  }, [clampedValue, springValue])

  const defaultGradientColors: [string, string] = ['var(--accent-100)', 'var(--accent-95)']
  const [from, to] = gradientColors || defaultGradientColors

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        'relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--ink-80)]',
        className
      )}
      {...props}
    >
      {/* Glow layer behind the bar */}
      {glowIntensity && glowIntensity > 0 && (
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${clampedValue}%`,
            background: gradient ? `linear-gradient(90deg, ${from}, ${to})` : from,
            filter: `blur(${glowIntensity}px)`,
            opacity: 0.4,
          }}
        />
      )}

      <motion.div
        className={cn(
          'h-full rounded-full',
          gradient ? 'bg-gradient-to-r' : 'bg-primary'
        )}
        style={gradient ? {
          background: `linear-gradient(90deg, ${from}, ${to})`,
          scaleX,
          transformOrigin: 'left',
        } : {
          scaleX,
          transformOrigin: 'left',
        }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      />

      {/* Shimmer effect */}
      <div
        className="absolute inset-0 rounded-full overflow-hidden"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, color-mix(in srgb, var(--accent-100) 8%, transparent) 50%, transparent 100%)',
          animation: 'shimmer 2s infinite',
        }}
      />
    </ProgressPrimitive.Root>
  )
})
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
