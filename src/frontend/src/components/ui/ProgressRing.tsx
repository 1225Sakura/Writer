import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion, useSpring, useTransform } from 'framer-motion'

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
  secondaryColor?: string
  trackColor?: string
  showPercentage?: boolean
  showValue?: boolean
  label?: string
  sublabel?: string
  animated?: boolean
  glow?: boolean
  sizePreset?: 'sm' | 'md' | 'lg'
  gradient?: boolean
}

const presetConfig = {
  sm: { size: 40, strokeWidth: 3, fontSize: 'text-xs' },
  md: { size: 64, strokeWidth: 4, fontSize: 'text-sm' },
  lg: { size: 96, strokeWidth: 5, fontSize: 'text-lg' },
}

export const ProgressRing = React.forwardRef<HTMLDivElement, ProgressRingProps>(
  (
    {
      className,
      value,
      max = 100,
      size: sizeProp,
      strokeWidth: strokeWidthProp,
      color = '#5e6ad2',
      secondaryColor,
      trackColor = 'rgba(255,255,255,0.06)',
      showPercentage = true,
      showValue = false,
      label,
      sublabel,
      animated = true,
      glow = false,
      sizePreset = 'md',
      gradient = false,
      ...props
    },
    ref
  ) => {
    const preset = presetConfig[sizePreset]
    const size = sizeProp ?? preset.size
    const strokeWidth = strokeWidthProp ?? preset.strokeWidth

    const percentage = Math.min(Math.max((value / max) * 100, 0), 100)
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (percentage / 100) * circumference

    const center = size / 2

    const springValue = useSpring(percentage, {
      stiffness: 100,
      damping: 16,
      mass: 0.6,
    })

    const animatedOffset = useTransform(springValue, (v) => {
      const p = Math.min(Math.max(v, 0), 100)
      const c = 2 * Math.PI * radius
      return c - (p / 100) * c
    })

    React.useEffect(() => {
      springValue.set(percentage)
    }, [percentage, springValue])

    const gradId = React.useRef(
      `progress-ring-grad-${Math.random().toString(36).slice(2, 9)}`
    )

    return (
      <div
        ref={ref}
        className={twMerge(
          clsx('relative inline-flex items-center justify-center', className)
        )}
        {...props}
      >
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          style={
            glow
              ? {
                  filter: `drop-shadow(0 0 8px ${color}50)`,
                }
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
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />

          {animated ? (
            <motion.circle
              cx={center}
              cy={center}
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
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={gradient ? `url(#${gradId.current})` : color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showPercentage && (
            <motion.span
              className={clsx(
                preset.fontSize,
                'font-bold text-[#f7f8f8] tabular-nums'
              )}
              style={{
                textShadow: '0 0 14px rgba(94, 106, 210, 0.5)',
              }}
            >
              {showValue ? value : `${Math.round(percentage)}`}
              {!showValue && (
                <span className="text-[10px] font-medium text-[#8a8f98]">%</span>
              )}
            </motion.span>
          )}

          {label && (
            <span
              className={clsx(
                'text-[10px] text-[#8a8f98] mt-0.5 font-medium',
                size < 56 && 'hidden'
              )}
            >
              {label}
            </span>
          )}

          {sublabel && (
            <span
              className={clsx(
                'text-[9px] text-[#8a8f98]/70',
                size < 72 && 'hidden'
              )}
            >
              {sublabel}
            </span>
          )}
        </div>
      </div>
    )
  }
)
ProgressRing.displayName = 'ProgressRing'
