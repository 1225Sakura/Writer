import { motion, useSpring, useTransform } from 'framer-motion'
import { useEffect, useRef } from 'react'

export interface CircularProgressProps {
  value: number
  size?: number
  strokeWidth?: number
  color?: string
  secondaryColor?: string
  trackColor?: string
  showPercentage?: boolean
  className?: string
  label?: string
  animated?: boolean
  gradient?: boolean
  glowIntensity?: number
}

export function CircularProgress({
  value,
  size = 64,
  strokeWidth = 4,
  color = 'var(--accent-100)',
  secondaryColor,
  trackColor = 'color-mix(in srgb, var(--paper-100) 6%, transparent)',
  showPercentage = true,
  className,
  label,
  animated = true,
  gradient = false,
  glowIntensity = 0,
}: CircularProgressProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clampedValue / 100) * circumference

  const springValue = useSpring(clampedValue, {
    stiffness: 100,
    damping: 16,
    mass: 0.6,
  })

  const animatedOffset = useTransform(springValue, (v) => {
    const c = 2 * Math.PI * radius
    return c - (Math.min(Math.max(v, 0), 100) / 100) * c
  })

  useEffect(() => {
    springValue.set(clampedValue)
  }, [clampedValue, springValue])

  const gradId = useRef(`circular-grad-${Math.random().toString(36).slice(2, 9)}`)

  return (
    <div className={`relative inline-flex items-center justify-center ${className || ''}`}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        style={
          glowIntensity && glowIntensity > 0
            ? { filter: `drop-shadow(0 0 ${glowIntensity}px color-mix(in srgb, ${color} 31%, transparent))` }
            : undefined
        }
      >
        <defs>
          {gradient && (
            <linearGradient id={gradId.current} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={color} />
              <stop offset="100%" stopColor={secondaryColor || color} />
            </linearGradient>
          )}
        </defs>

        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />

        {animated ? (
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={gradient ? `url(#${gradId.current})` : color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: animatedOffset }}
            transition={{ type: 'spring', stiffness: 100, damping: 16 }}
          />
        ) : (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        )}
      </svg>

      {showPercentage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-sm font-bold text-[var(--paper-100)] tabular-nums"
            style={{
              textShadow: '0 0 12px color-mix(in srgb, var(--accent-100) 50%, transparent)',
            }}
          >
            {Math.round(clampedValue)}
            <span className="text-[10px] font-medium text-[var(--text-tertiary)] ml-[1px]">%</span>
          </motion.span>
          {label && (
            <span className="text-[10px] text-[var(--text-tertiary)] mt-0.5 font-medium">{label}</span>
          )}
        </div>
      )}
    </div>
  )
}
