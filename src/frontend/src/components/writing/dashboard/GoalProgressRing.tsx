/**
 * GoalProgressRing — animated circular progress meter.
 *
 * Phase 0b.2 merge: consolidated from src/components/writing/GoalProgressRing.tsx
 * (114 lines) into dashboard/GoalProgressRing.tsx (was a 1-line re-export shim).
 * All call-sites already imported the dashboard/ path, so the legacy file is
 * removed (see commit history). Use this dashboard variant exclusively.
 */
import { motion, useSpring, useTransform } from 'framer-motion'
import { useEffect } from 'react'

interface GoalProgressRingProps {
  current: number
  target: number
  label: string
  size?: number
  color?: string
}

function getProgressColor(progress: number): string {
  if (progress >= 75) return 'var(--color-ifline)'      // green
  if (progress >= 50) return 'var(--color-character)'   // yellow/orange
  if (progress >= 25) return 'var(--color-outline)'     // blue/orange
  return 'var(--color-vermillion)'                       // red
}

export function GoalProgressRing({
  current,
  target,
  label,
  size = 80,
  color,
}: GoalProgressRingProps) {
  const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0
  const resolvedColor = color ?? getProgressColor(progress)

  const strokeWidth = size * 0.08
  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  const springProgress = useSpring(progress, {
    stiffness: 60,
    damping: 20,
    mass: 1,
  })

  useEffect(() => {
    springProgress.set(progress)
  }, [progress, springProgress])

  const dashOffset = useTransform(
    springProgress,
    (p: number) => circumference - (p / 100) * circumference,
  )

  const formattedCurrent = current >= 10000
    ? `${(current / 10000).toFixed(1)}万`
    : current.toString()
  const formattedTarget = target >= 10000
    ? `${(target / 10000).toFixed(1)}万`
    : target.toString()

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="transform -rotate-90"
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="color-mix(in srgb, var(--paper-100) 6%, transparent)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Progress */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={resolvedColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            style={{ strokeDashoffset: dashOffset }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-xs font-semibold leading-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {formattedCurrent}
          </span>
          <span
            className="text-[9px] leading-tight"
            style={{ color: 'var(--text-muted)' }}
          >
            /{formattedTarget}
          </span>
        </div>
      </div>

      <span
        className="text-[11px] font-medium"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </span>
    </div>
  )
}

export type { GoalProgressRingProps }