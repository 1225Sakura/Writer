/**
 * GradientText - 渐变文字组件
 *
 * 支持流动色彩动画的渐变文字效果
 * 适配6种主题色彩（accent/character/item/location/faction/outline/ifline）
 * 使用 CSS variables 实现主题感知
 */

import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type GradientTextColor =
  | 'accent'
  | 'character'
  | 'item'
  | 'location'
  | 'faction'
  | 'outline'
  | 'ifline'
  | 'vermillion'
  | 'custom'

export type GradientTextDirection =
  | 'left-to-right'
  | 'top-to-bottom'
  | 'top-left-to-bottom-right'
  | 'top-right-to-bottom-left'

export interface GradientTextProps {
  children: ReactNode
  className?: string
  /** 渐变色彩主题 */
  color?: GradientTextColor
  /** 自定义渐变颜色数组（color='custom'时使用） */
  customColors?: string[]
  /** 渐变方向 */
  direction?: GradientTextDirection
  /** 是否启用流动动画 */
  animated?: boolean
  /** 动画速度（秒） */
  animationDuration?: number
  /** 文字粗细 */
  weight?: 'normal' | 'medium' | 'semibold' | 'bold'
  /** 作为行内元素 */
  asSpan?: boolean
  /** 自定义样式 */
  style?: CSSProperties
}

const colorMap: Record<GradientTextColor, string[]> = {
  accent: ['var(--accent-100)', 'var(--accent-95)', 'var(--accent-85)', 'var(--accent-100)'],
  character: ['var(--color-character)', 'var(--color-character)', 'var(--color-character)', 'var(--color-character)'],
  item: ['var(--color-item)', 'var(--color-item)', 'var(--color-item)', 'var(--color-item)'],
  location: ['var(--color-location)', 'var(--color-location)', 'var(--color-location)', 'var(--color-location)'],
  faction: ['var(--color-faction)', 'var(--color-faction)', 'var(--color-faction)', 'var(--color-faction)'],
  outline: ['var(--color-outline)', 'var(--color-outline)', 'var(--color-outline)', 'var(--color-outline)'],
  ifline: ['var(--color-ifline)', 'var(--color-ifline)', 'var(--color-ifline)', 'var(--color-ifline)'],
  vermillion: ['var(--vermillion-100)', 'var(--vermillion-95)', 'var(--vermillion-90)', 'var(--vermillion-100)'],
  custom: ['var(--accent-100)', 'var(--accent-95)', 'var(--accent-85)', 'var(--accent-100)'],
}

const directionMap: Record<GradientTextDirection, string> = {
  'left-to-right': '90deg',
  'top-to-bottom': '180deg',
  'top-left-to-bottom-right': '135deg',
  'top-right-to-bottom-left': '225deg',
}

const weightMap = {
  normal: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
}

/**
 * GradientText - 渐变文字
 *
 * 特性：
 * - 6种主题色彩预设 + 自定义
 * - 可选流动动画效果
 * - 支持多种渐变方向
 * - 使用 CSS background-clip 实现文字渐变
 */
export function GradientText({
  children,
  className,
  color = 'accent',
  customColors,
  direction = 'left-to-right',
  animated = false,
  animationDuration = 3,
  weight = 'semibold',
  asSpan = false,
  style,
}: GradientTextProps) {
  const colors = customColors ?? colorMap[color]
  const gradient = `linear-gradient(${directionMap[direction]}, ${colors.join(', ')})`

  const baseStyle: CSSProperties = {
    background: gradient,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontWeight: weightMap[weight],
    ...style,
  }

  if (animated) {
    baseStyle.backgroundSize = '200% 200%'
    baseStyle.animation = `gradient-flow ${animationDuration}s ease infinite`
  }

  const Component = asSpan ? motion.span : motion.div

  return (
    <Component
      className={cn('inline-block', className)}
      style={baseStyle}
      initial={animated ? { opacity: 0.8 } : undefined}
      animate={animated ? { opacity: 1 } : undefined}
      transition={{ duration: 0.5 }}
    >
      {children}
    </Component>
  )
}

/**
 * AnimatedGradientText - 预配置流动动画的渐变文字
 */
export function AnimatedGradientText({
  children,
  className,
  color = 'accent',
  customColors,
  direction = 'left-to-right',
  animationDuration = 3,
  weight = 'semibold',
  asSpan = false,
  style,
}: Omit<GradientTextProps, 'animated'>) {
  return (
    <GradientText
      className={className}
      color={color}
      customColors={customColors}
      direction={direction}
      animated
      animationDuration={animationDuration}
      weight={weight}
      asSpan={asSpan}
      style={style}
    >
      {children}
    </GradientText>
  )
}

/**
 * ShimmerText - 闪烁扫光文字效果
 */
export function ShimmerText({
  children,
  className,
  color = 'accent',
  duration = 2,
}: {
  children: ReactNode
  className?: string
  color?: GradientTextColor
  duration?: number
}) {
  const colors = colorMap[color]
  const primaryColor = colors[0]

  return (
    <motion.span
      className={cn('relative inline-block overflow-hidden', className)}
      style={{ color: primaryColor }}
    >
      <span className="relative z-10">{children}</span>
      <motion.span
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(90deg, transparent, ${primaryColor}30, transparent)`,
          backgroundSize: '200% 100%',
        }}
        animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
        transition={{ duration, repeat: Infinity, ease: 'linear' }}
      />
    </motion.span>
  )
}
