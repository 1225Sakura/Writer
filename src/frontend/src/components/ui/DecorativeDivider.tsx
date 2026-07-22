/**
 * DecorativeDivider - 带渐变和装饰元素的视觉分隔线
 *
 * 支持水平/垂直方向，中间可带图标或文字装饰
 * 渐变色彩（使用accent色或自定义），可选shimmer流动动画
 */

import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { type LucideIcon } from 'lucide-react'

export interface DecorativeDividerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 方向 */
  orientation?: 'horizontal' | 'vertical'
  /** 中间装饰文字 */
  label?: string
  /** 中间装饰图标 */
  icon?: LucideIcon
  /** 渐变色彩主题 */
  color?: 'accent' | 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'custom'
  /** 自定义颜色值 */
  customColor?: string
  /** 是否启用shimmer流动动画 */
  shimmer?: boolean
  /** 是否启用入场动画 */
  animated?: boolean
  /** 间距大小 */
  spacing?: 'sm' | 'md' | 'lg' | 'xl'
  /** 线条粗细 */
  thickness?: 'thin' | 'default' | 'thick'
}

const colorMap: Record<string, string> = {
  accent: 'var(--accent-100)',
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
  custom: 'var(--accent-100)',
}

const spacingMap = {
  sm: 'my-2',
  md: 'my-4',
  lg: 'my-6',
  xl: 'my-8',
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '')
  const bigint = parseInt(sanitized, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const DecorativeDivider = React.forwardRef<HTMLDivElement, DecorativeDividerProps>(
  (
    {
      className,
      orientation = 'horizontal',
      label,
      icon: Icon,
      color = 'accent',
      customColor,
      shimmer = false,
      animated = true,
      spacing = 'md',
      thickness: _thickness = 'thin',
      ...props
    },
    ref
  ) => {
    const resolvedColor = customColor ?? colorMap[color] ?? colorMap.accent
    const isHorizontal = orientation === 'horizontal'

    const lineBaseClass = clsx(
      isHorizontal ? 'h-[1px] flex-1' : 'w-[1px] flex-1',
      'relative overflow-hidden'
    )

    const gradientStyle: React.CSSProperties = isHorizontal
      ? {
          background: `linear-gradient(90deg, transparent 0%, ${hexToRgba(resolvedColor, 0.4)} 50%, transparent 100%)`,
        }
      : {
          background: `linear-gradient(180deg, transparent 0%, ${hexToRgba(resolvedColor, 0.4)} 50%, transparent 100%)`,
        }

    const shimmerOverlayStyle: React.CSSProperties = shimmer
      ? {
          background: isHorizontal
            ? `linear-gradient(90deg, transparent, ${hexToRgba(resolvedColor, 0.6)}, transparent)`
            : `linear-gradient(180deg, transparent, ${hexToRgba(resolvedColor, 0.6)}, transparent)`,
          backgroundSize: isHorizontal ? '200% 100%' : '100% 200%',
          animation: isHorizontal ? 'shimmer 2s infinite' : 'shimmer-vertical 2s infinite',
        }
      : {}

    const hasDecoration = label || Icon

    const renderLine = (direction?: 'start' | 'end') => {
      const line = (
        <div className={lineBaseClass} style={gradientStyle}>
          {shimmer && (
            <div
              className="absolute inset-0"
              style={shimmerOverlayStyle}
            />
          )}
        </div>
      )

      if (!animated) return line

      const initialProps =
        direction === 'start'
          ? { scaleX: isHorizontal ? 0 : 1, scaleY: isHorizontal ? 1 : 0, originX: 1, originY: 0 }
          : direction === 'end'
            ? { scaleX: isHorizontal ? 0 : 1, scaleY: isHorizontal ? 1 : 0, originX: 0, originY: 1 }
            : { scaleX: isHorizontal ? 0 : 1, scaleY: isHorizontal ? 1 : 0, originX: 0.5, originY: 0.5 }

      return (
        <motion.div
          className={lineBaseClass}
          style={{ ...gradientStyle, originX: initialProps.originX, originY: initialProps.originY }}
          initial={{ scaleX: initialProps.scaleX, scaleY: initialProps.scaleY }}
          animate={{ scaleX: 1, scaleY: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >
          {shimmer && (
            <motion.div
              className="absolute inset-0"
              style={shimmerOverlayStyle}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: DURATION.SLOW, ease: EASE.SMOOTH }}
            />
          )}
        </motion.div>
      )
    }

    const renderDecoration = () => {
      if (!hasDecoration) return null

      const decoration = (
        <div
          className={clsx(
            'flex items-center justify-center shrink-0',
            isHorizontal ? 'flex-row gap-1.5 px-3' : 'flex-col gap-1.5 py-3'
          )}
        >
          {Icon && (
            <Icon
              className="shrink-0"
              style={{ color: resolvedColor }}
              size={isHorizontal ? 14 : 12}
              strokeWidth={1.5}
            />
          )}
          {label && (
            <span
              className={clsx(
                'text-[11px] font-medium uppercase tracking-widest whitespace-nowrap',
                isHorizontal ? '' : 'writing-mode-vertical'
              )}
              style={{ color: hexToRgba(resolvedColor, 0.7) }}
            >
              {label}
            </span>
          )}
        </div>
      )

      if (!animated) return decoration

      return (
        <motion.div
          className={clsx(
            'flex items-center justify-center shrink-0',
            isHorizontal ? 'flex-row gap-1.5 px-3' : 'flex-col gap-1.5 py-3'
          )}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        >
          {Icon && (
            <Icon
              className="shrink-0"
              style={{ color: resolvedColor }}
              size={isHorizontal ? 14 : 12}
              strokeWidth={1.5}
            />
          )}
          {label && (
            <span
              className={clsx(
                'text-[11px] font-medium uppercase tracking-widest whitespace-nowrap',
                isHorizontal ? '' : 'writing-mode-vertical'
              )}
              style={{ color: hexToRgba(resolvedColor, 0.7) }}
            >
              {label}
            </span>
          )}
        </motion.div>
      )
    }

    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            'flex',
            isHorizontal
              ? clsx('items-center w-full', spacingMap[spacing])
              : 'flex-col items-center h-full mx-4',
            className
          )
        )}
        {...props}
      >
        {hasDecoration ? (
          <>
            {renderLine('start')}
            {renderDecoration()}
            {renderLine('end')}
          </>
        ) : (
          renderLine()
        )}
      </div>
    )
  }
)

DecorativeDivider.displayName = 'DecorativeDivider'
