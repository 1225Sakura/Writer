/**
 * GridItem - Bento grid cell component
 *
 * Features:
 * - Multiple size presets (1x1, 1x2, 2x1, 2x2, full)
 * - 9 color themes
 * - Hover micro-animation
 * - Optional shimmer effect
 */

import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import type { BentoItemProps, BentoItemSize } from './GridLayout'
import { colorMap, roundedMap, paddingMap } from './GridLayout'

export function BentoItem({
  children,
  className,
  size = '1x1',
  color = 'default',
  rounded = 'lg',
  padding = 'md',
  hover = true,
  onClick,
  background,
  shimmer = false,
}: BentoItemProps) {
  const colorStyle = colorMap[color]
  const Component = onClick ? motion.button : motion.div

  const sizeStyles: Record<BentoItemSize, CSSProperties> = {
    '1x1': {},
    '1x2': { gridRow: 'span 2' },
    '2x1': { gridColumn: 'span 2' },
    '2x2': { gridColumn: 'span 2', gridRow: 'span 2' },
    full: { gridColumn: '1 / -1' },
  }

  return (
    <Component
      className={cn(
        'relative overflow-hidden text-left',
        hover && 'transition-shadow duration-300',
        onClick && 'cursor-pointer',
        className
      )}
      style={{
        borderRadius: roundedMap[rounded],
        padding: paddingMap[padding],
        background: background ?? colorStyle.background,
        border: `1px solid ${colorStyle.borderColor}`,
        ...sizeStyles[size],
      }}
      onClick={onClick}
      whileHover={
        hover
          ? {
              y: -1,
              boxShadow: '0 4px 16px color-mix(in srgb, var(--ink-100) 10%, transparent)',
            }
          : undefined
      }
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    >
      {/* Shimmer overlay */}
      {shimmer && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, color-mix(in srgb, var(--paper-100) 3%, transparent) 45%, color-mix(in srgb, var(--paper-100) 6%, transparent) 50%, color-mix(in srgb, var(--paper-100) 3%, transparent) 55%, transparent 60%)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      )}

      <div className="relative z-10 h-full">{children}</div>
    </Component>
  )
}
