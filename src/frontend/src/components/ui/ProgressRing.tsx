import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'

export interface ProgressRingProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  size?: number
  strokeWidth?: number
  color?: string
  trackColor?: string
  showPercentage?: boolean
  showValue?: boolean
  label?: string
  sublabel?: string
  animated?: boolean
  glow?: boolean
  sizePreset?: 'sm' | 'md' | 'lg'
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
      trackColor = 'rgba(255,255,255,0.06)',
      showPercentage = true,
      showValue = false,
      label,
      sublabel,
      animated = true,
      glow = false,
      sizePreset = 'md',
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
                  filter: `drop-shadow(0 0 6px ${color}40)`,
                }
              : undefined
          }
        >
          {/* Track circle */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />

          {/* Progress circle */}
          {animated ? (
            <motion.circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : (
            <circle
              cx={center}
              cy={center}
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

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {showPercentage && (
            <motion.span
              className={clsx(
                preset.fontSize,
                'font-semibold text-[#f7f8f8] tabular-nums'
              )}
              key={Math.round(percentage)}
              {...(animated
                ? {
                    initial: { scale: 0.8, opacity: 0 },
                    animate: { scale: 1, opacity: 1 },
                    transition: { duration: 0.3 },
                  }
                : {})}
            >
              {showValue ? value : `${Math.round(percentage)}%`}
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
