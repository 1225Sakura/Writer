/**
 * AmbientLight - 环境光晕球组件
 *
 * 用于页面角落的氛围光效，替代硬编码的背景发光
 * 可配置颜色、大小、位置、动画
 * 主题感知，支持6种主题色
 */

import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type AmbientColor =
  | 'accent'
  | 'character'
  | 'item'
  | 'location'
  | 'faction'
  | 'outline'
  | 'ifline'
  | 'vermillion'
  | 'warm'
  | 'cool'
  | 'custom'

export type AmbientPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'top-center'
  | 'bottom-center'
  | 'center-left'
  | 'center-right'
  | 'center'

export type AmbientSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'

export type AmbientShape = 'circle' | 'ellipse' | 'blob'

export interface AmbientLightProps {
  className?: string
  /** 光晕颜色主题 */
  color?: AmbientColor
  /** 自定义颜色值（color='custom'时使用） */
  customColor?: string
  /** 光晕大小 */
  size?: AmbientSize
  /** 位置 */
  position?: AmbientPosition
  /** 形状 */
  shape?: AmbientShape
  /** 是否启用呼吸动画 */
  animated?: boolean
  /** 动画持续时间（秒） */
  animationDuration?: number
  /** 透明度 */
  opacity?: number
  /** 模糊程度 */
  blur?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** 是否使用渐变 */
  gradient?: boolean
  /** z-index */
  zIndex?: number
  /** 自定义样式 */
  style?: CSSProperties
}

const colorMap: Record<AmbientColor, string> = {
  accent: 'rgba(94, 106, 210, 0.28)',
  character: 'rgba(232, 184, 125, 0.22)',
  item: 'rgba(155, 126, 217, 0.22)',
  location: 'rgba(94, 181, 166, 0.22)',
  faction: 'rgba(212, 93, 93, 0.22)',
  outline: 'rgba(91, 142, 232, 0.22)',
  ifline: 'rgba(126, 183, 74, 0.22)',
  vermillion: 'rgba(196, 92, 92, 0.22)',
  warm: 'rgba(232, 184, 125, 0.18)',
  cool: 'rgba(94, 181, 166, 0.18)',
  custom: 'rgba(94, 106, 210, 0.28)',
}

const sizeMap: Record<AmbientSize, { width: string; height: string }> = {
  sm: { width: '200px', height: '200px' },
  md: { width: '300px', height: '300px' },
  lg: { width: '400px', height: '400px' },
  xl: { width: '500px', height: '500px' },
  '2xl': { width: '600px', height: '600px' },
  full: { width: '100%', height: '100%' },
}

const positionMap: Record<AmbientPosition, CSSProperties> = {
  'top-left': { top: '-10%', left: '-10%' },
  'top-right': { top: '-10%', right: '-10%' },
  'bottom-left': { bottom: '-10%', left: '-10%' },
  'bottom-right': { bottom: '-10%', right: '-10%' },
  'top-center': { top: '-10%', left: '50%', transform: 'translateX(-50%)' },
  'bottom-center': { bottom: '-10%', left: '50%', transform: 'translateX(-50%)' },
  'center-left': { top: '50%', left: '-10%', transform: 'translateY(-50%)' },
  'center-right': { top: '50%', right: '-10%', transform: 'translateY(-50%)' },
  center: { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' },
}

const blurMap = {
  sm: '40px',
  md: '60px',
  lg: '80px',
  xl: '120px',
  '2xl': '160px',
}

/**
 * AmbientLight - 环境光晕球
 *
 * 特性：
 * - 11种颜色主题 + 自定义
 * - 6种尺寸预设
 * - 9种位置预设
 * - 3种形状（圆形/椭圆/不规则）
 * - 可选呼吸动画
 * - 可配置模糊程度
 */
export function AmbientLight({
  className,
  color = 'accent',
  customColor,
  size = 'lg',
  position = 'top-right',
  shape = 'circle',
  animated = true,
  animationDuration = 6,
  opacity = 1,
  blur = 'xl',
  gradient = false,
  zIndex = 0,
  style,
}: AmbientLightProps) {
  const colorValue = customColor ?? colorMap[color]
  const sizeValue = sizeMap[size]
  const positionValue = positionMap[position]
  const blurValue = blurMap[blur]

  const baseStyle: CSSProperties = {
    position: 'absolute',
    ...positionValue,
    width: sizeValue.width,
    height: sizeValue.height,
    borderRadius: shape === 'circle' ? '50%' : shape === 'ellipse' ? '50% 40%' : '60% 40% 30% 70% / 60% 30% 70% 40%',
    filter: `blur(${blurValue})`,
    opacity,
    zIndex,
    pointerEvents: 'none',
    ...style,
  }

  if (gradient) {
    baseStyle.background = `radial-gradient(circle, ${colorValue}, transparent 70%)`
  } else {
    baseStyle.backgroundColor = colorValue
  }

  if (animated) {
    return (
      <motion.div
        className={cn('pointer-events-none', className)}
        style={baseStyle}
        animate={{
          scale: [1, 1.06, 0.98, 1.04, 1],
          opacity: [opacity * 0.75, opacity, opacity * 0.65, opacity * 0.9, opacity * 0.75],
        }}
        transition={{
          duration: animationDuration,
          repeat: Infinity,
          ease: 'easeInOut',
          times: [0, 0.25, 0.5, 0.75, 1],
        }}
      />
    )
  }

  return (
    <div
      className={cn('pointer-events-none', className)}
      style={baseStyle}
    />
  )
}

/**
 * AmbientLightGroup - 多个环境光组合
 * 用于创建更丰富的背景氛围
 */
export function AmbientLightGroup({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
      aria-hidden="true"
    >
      {children}
    </div>
  )
}

/**
 * AmbientGlow - 简化版环境光晕（固定配置）
 */
export function AmbientGlow({
  className,
  variant = 'default',
}: {
  className?: string
  variant?: 'default' | 'warm' | 'cool' | 'subtle'
}) {
  const variants: Record<string, { colors: AmbientColor[]; sizes: AmbientSize[]; positions: AmbientPosition[] }> = {
    default: {
      colors: ['accent', 'character'],
      sizes: ['lg', 'md'],
      positions: ['top-right', 'bottom-left'],
    },
    warm: {
      colors: ['character', 'vermillion'],
      sizes: ['lg', 'md'],
      positions: ['top-left', 'bottom-right'],
    },
    cool: {
      colors: ['accent', 'location'],
      sizes: ['lg', 'md'],
      positions: ['top-right', 'bottom-left'],
    },
    subtle: {
      colors: ['accent', 'outline'],
      sizes: ['md', 'sm'],
      positions: ['top-center', 'bottom-center'],
    },
  }

  const config = variants[variant]

  return (
    <AmbientLightGroup className={className}>
      {config.colors.map((color, i) => (
        <AmbientLight
          key={i}
          color={color}
          size={config.sizes[i]}
          position={config.positions[i]}
          animated
          opacity={0.6}
          blur="xl"
          gradient
        />
      ))}
    </AmbientLightGroup>
  )
}
