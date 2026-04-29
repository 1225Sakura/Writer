import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'


export interface DividerProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: string
  variant?: 'default' | 'gradient' | 'glow'
  orientation?: 'horizontal' | 'vertical'
  animated?: boolean
  spacing?: 'sm' | 'md' | 'lg'
}

const spacingStyles = {
  sm: 'my-2',
  md: 'my-4',
  lg: 'my-6',
}

export const Divider = React.forwardRef<HTMLDivElement, DividerProps>(
  (
    {
      className,
      label,
      variant = 'default',
      orientation = 'horizontal',
      animated = true,
      spacing = 'md',
      ...props
    },
    ref
  ) => {
    const isHorizontal = orientation === 'horizontal'

    if (label) {
      return (
        <div
          ref={ref}
          className={twMerge(
            clsx(
              'flex items-center gap-3',
              isHorizontal ? spacingStyles[spacing] : 'mx-4 h-full',
              !isHorizontal && 'flex-col'
            ),
            className
          )}
          {...props}
        >
          <DividerLine
            variant={variant}
            animated={animated}
            orientation={orientation}
            direction="start"
          />
          <motion.span
            className={clsx(
              'text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider whitespace-nowrap',
              !isHorizontal && 'writing-mode-vertical'
            )}
            initial={animated ? { opacity: 0, scale: 0.9 } : false}
            animate={animated ? { opacity: 1, scale: 1 } : false}
            transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
          >
            {label}
          </motion.span>
          <DividerLine
            variant={variant}
            animated={animated}
            orientation={orientation}
            direction="end"
          />
        </div>
      )
    }

    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            isHorizontal
              ? clsx('h-[1px] w-full', spacingStyles[spacing])
              : 'w-[1px] h-full mx-4'
          ),
          className
        )}
        {...props}
      >
        <DividerLine variant={variant} animated={animated} orientation={orientation} full />
      </div>
    )
  }
)
Divider.displayName = 'Divider'

// Internal line component with animation
interface DividerLineProps {
  variant: 'default' | 'gradient' | 'glow'
  animated: boolean
  orientation: 'horizontal' | 'vertical'
  direction?: 'start' | 'end'
  full?: boolean
}

function DividerLine({ variant, animated, orientation, direction, full }: DividerLineProps) {
  const isHorizontal = orientation === 'horizontal'

  const lineClass = clsx(
    'block',
    isHorizontal ? 'h-[1px]' : 'w-[1px]',
    full ? (isHorizontal ? 'w-full' : 'h-full') : 'flex-1',
    variant === 'default' && 'bg-[rgba(255,255,255,0.08)]',
    variant === 'gradient' &&
      (isHorizontal
        ? 'bg-gradient-to-r from-transparent via-[rgba(255,255,255,0.15)] to-transparent'
        : 'bg-gradient-to-b from-transparent via-[rgba(255,255,255,0.15)] to-transparent'),
    variant === 'glow' &&
      (isHorizontal
        ? 'bg-gradient-to-r from-transparent via-[var(--accent-100)]/40 to-transparent'
        : 'bg-gradient-to-b from-transparent via-[var(--accent-100)]/40 to-transparent')
  )

  if (!animated) {
    return <span className={lineClass} />
  }

  const initialProps =
    direction === 'start'
      ? { scaleX: isHorizontal ? 0 : 1, scaleY: isHorizontal ? 1 : 0, originX: 1, originY: 0 }
      : direction === 'end'
        ? { scaleX: isHorizontal ? 0 : 1, scaleY: isHorizontal ? 1 : 0, originX: 0, originY: 1 }
        : { scaleX: isHorizontal ? 0 : 1, scaleY: isHorizontal ? 1 : 0, originX: 0.5, originY: 0.5 }

  return (
    <motion.span
      className={lineClass}
      initial={initialProps}
      animate={{ scaleX: 1, scaleY: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
    />
  )
}
