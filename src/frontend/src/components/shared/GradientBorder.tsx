/**
 * GradientBorder - 渐变边框组件
 *
 * 支持多种渐变方向、颜色组合和动画效果
 * 使用 CSS mask 技术实现真正的渐变边框
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type GradientDirection =
  | 'top-to-bottom'
  | 'left-to-right'
  | 'top-left-to-bottom-right'
  | 'top-right-to-bottom-left'
  | 'radial'
  | 'conic'

export type GradientPreset =
  | 'accent'
  | 'warm'
  | 'cool'
  | 'rainbow'
  | 'sunset'
  | 'ocean'
  | 'forest'
  | 'custom'

interface GradientBorderProps {
  children: ReactNode
  className?: string
  /** 内容区域类名 */
  contentClassName?: string
  /** 渐变预设 */
  preset?: GradientPreset
  /** 自定义渐变颜色数组 */
  colors?: string[]
  /** 渐变方向 */
  direction?: GradientDirection
  /** 边框宽度 */
  borderWidth?: number
  /** 圆角 */
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  /** 是否启用动画 */
  animated?: boolean
  /** 动画速度（秒） */
  animationDuration?: number
  /** 背景色 */
  backgroundColor?: string
  /** 内边距 */
  padding?: 'none' | 'sm' | 'md' | 'lg'
}

const presetGradients: Record<GradientPreset, string[]> = {
  accent: ['rgba(var(--spotlight-accent), 0.6)', 'rgba(var(--spotlight-location), 0.5)', 'rgba(var(--spotlight-character), 0.4)'],
  warm: ['rgba(var(--spotlight-character), 0.6)', 'rgba(var(--spotlight-faction), 0.5)', 'rgba(var(--spotlight-faction), 0.4)'],
  cool: ['rgba(var(--spotlight-accent), 0.6)', 'rgba(var(--spotlight-outline), 0.5)', 'rgba(var(--spotlight-location), 0.4)'],
  rainbow: [
    'rgba(var(--spotlight-accent), 0.6)',
    'rgba(var(--spotlight-outline), 0.5)',
    'rgba(var(--spotlight-location), 0.5)',
    'rgba(var(--spotlight-ifline), 0.5)',
    'rgba(var(--spotlight-character), 0.5)',
    'rgba(var(--spotlight-faction), 0.5)',
  ],
  sunset: ['rgba(var(--spotlight-character), 0.7)', 'rgba(var(--spotlight-faction), 0.6)', 'rgba(var(--spotlight-item), 0.5)'],
  ocean: ['rgba(var(--spotlight-outline), 0.6)', 'rgba(var(--spotlight-location), 0.5)', 'rgba(var(--spotlight-accent), 0.4)'],
  forest: ['rgba(var(--spotlight-ifline), 0.6)', 'rgba(var(--spotlight-location), 0.5)', 'rgba(var(--spotlight-accent), 0.4)'],
  custom: ['rgba(var(--spotlight-accent), 0.6)', 'rgba(var(--spotlight-location), 0.5)'],
}

const directionStyles: Record<GradientDirection, string> = {
  'top-to-bottom': '180deg',
  'left-to-right': '90deg',
  'top-left-to-bottom-right': '135deg',
  'top-right-to-bottom-left': '225deg',
  radial: 'circle',
  conic: 'conic',
}

const roundedMap = {
  sm: '2px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
}

const paddingMap = {
  none: '0px',
  sm: '1px',
  md: '2px',
  lg: '3px',
}

/**
 * GradientBorder - 渐变边框组件
 *
 * 使用 CSS mask 技术实现真正的渐变边框效果
 * 支持动画、多种预设和自定义颜色
 */
export function GradientBorder({
  children,
  className,
  contentClassName,
  preset = 'accent',
  colors,
  direction = 'top-left-to-bottom-right',
  borderWidth = 1,
  rounded = 'lg',
  animated = false,
  animationDuration = 3,
  backgroundColor = 'var(--elevation-2)',
  padding = 'sm',
}: GradientBorderProps) {
  const gradientColors = colors ?? presetGradients[preset]
  const gradientString = gradientColors.join(', ')

  const isRadial = direction === 'radial'
  const isConic = direction === 'conic'

  let gradient: string
  if (isRadial) {
    gradient = `radial-gradient(circle, ${gradientString})`
  } else if (isConic) {
    gradient = `conic-gradient(from 0deg, ${gradientString})`
  } else {
    gradient = `linear-gradient(${directionStyles[direction]}, ${gradientString})`
  }

  const borderRadius = roundedMap[rounded]
  const paddingValue = paddingMap[padding]

  return (
    <div
      className={cn('relative', className)}
      style={{
        borderRadius,
        padding: `${borderWidth + (padding === 'none' ? 0 : parseInt(paddingValue))}px`,
        background: gradient,
        ...(animated && {
          backgroundSize: '200% 200%',
          animation: `gradient-shift ${animationDuration}s ease infinite`,
        }),
      }}
    >
      <div
        className={cn('relative', contentClassName)}
        style={{
          borderRadius: `calc(${borderRadius} - ${borderWidth}px)`,
          background: backgroundColor,
          padding: paddingValue,
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * AnimatedGradientBorder - 带动画的渐变边框
 *
 * 渐变颜色会不断旋转/移动
 */
export function AnimatedGradientBorder({
  children,
  className,
  contentClassName,
  preset = 'accent',
  colors,
  direction = 'conic',
  borderWidth = 1.5,
  rounded = 'lg',
  animationDuration = 4,
  backgroundColor = 'var(--elevation-2)',
}: Omit<GradientBorderProps, 'animated'>) {
  return (
    <GradientBorder
      className={className}
      contentClassName={contentClassName}
      preset={preset}
      colors={colors}
      direction={direction}
      borderWidth={borderWidth}
      rounded={rounded}
      animated
      animationDuration={animationDuration}
      backgroundColor={backgroundColor}
    >
      {children}
    </GradientBorder>
  )
}

/**
 * GlowBorder - 发光边框效果
 *
 * 带有柔和发光效果的渐变边框
 */
export function GlowBorder({
  children,
  className,
  contentClassName,
  preset = 'accent',
  colors,
  rounded = 'lg',
  intensity = 'medium',
}: {
  children: ReactNode
  className?: string
  contentClassName?: string
  preset?: GradientPreset
  colors?: string[]
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  intensity?: 'low' | 'medium' | 'high'
}) {
  const glowMap = {
    low: '0 0 8px',
    medium: '0 0 16px',
    high: '0 0 32px',
  }

  const gradientColors = colors ?? presetGradients[preset]
  const primaryColor = gradientColors[0].replace(/[\d.]+\)$/, '0.3)')

  return (
    <div
      className={cn('relative', className)}
      style={{
        borderRadius: roundedMap[rounded],
        boxShadow: `${glowMap[intensity]} ${primaryColor}`,
      }}
    >
      <GradientBorder
        className="relative z-10"
        contentClassName={contentClassName}
        preset={preset}
        colors={colors}
        rounded={rounded}
        borderWidth={1}
      >
        {children}
      </GradientBorder>
    </div>
  )
}
