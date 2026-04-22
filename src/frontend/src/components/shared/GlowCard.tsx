/**
 * GlowCard - 光效卡片组件
 *
 * 带有发光效果的卡片，支持多种发光强度和颜色
 * 适用于突出显示、悬停效果、强调UI
 *
 * 设计规范（DESIGN_VISUAL.md）：
 * - glow-accent: 0 0 16px rgba(94, 106, 210, 0.4), 0 0 32px rgba(94, 106, 210, 0.2)
 * - glow-vermillion: 0 0 12px rgba(196, 92, 92, 0.4), 0 0 24px rgba(196, 92, 92, 0.2)
 */

import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type GlowIntensity = 'subtle' | 'soft' | 'medium' | 'strong' | 'pulse'
export type GlowColor = 'accent' | 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'custom'

interface GlowCardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** 发光强度 */
  intensity?: GlowIntensity
  /** 发光颜色 */
  color?: GlowColor
  /** 自定义颜色值（当 color 为 custom 时使用） */
  customColor?: string
  /** 是否启用悬停效果 */
  hover?: boolean
  /** 是否启用点击效果 */
  press?: boolean
  /** 卡片圆角 */
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** 卡片内边距 */
  padding?: 'none' | 'sm' | 'md' | 'lg'
  /** 是否显示边框 */
  border?: boolean
  /** 是否启用动画 */
  animated?: boolean
  /** 点击回调 */
  onClick?: () => void
}

const glowColorMap: Record<GlowColor, string> = {
  accent: 'rgba(94, 106, 210, 0.4)',
  character: 'rgba(232, 184, 125, 0.4)',
  item: 'rgba(155, 126, 217, 0.4)',
  location: 'rgba(94, 181, 166, 0.4)',
  faction: 'rgba(212, 93, 93, 0.4)',
  outline: 'rgba(91, 142, 232, 0.4)',
  ifline: 'rgba(126, 183, 74, 0.4)',
  custom: 'rgba(94, 106, 210, 0.4)',
}

const glowIntensityStyles: Record<GlowIntensity, { boxShadow: string; borderColor: string }> = {
  subtle: {
    boxShadow: '0 0 8px var(--glow-color, rgba(94, 106, 210, 0.2))',
    borderColor: 'rgba(94, 106, 210, 0.15)',
  },
  soft: {
    boxShadow: '0 0 16px var(--glow-color, rgba(94, 106, 210, 0.25))',
    borderColor: 'rgba(94, 106, 210, 0.2)',
  },
  medium: {
    boxShadow: '0 0 24px var(--glow-color, rgba(94, 106, 210, 0.35))',
    borderColor: 'rgba(94, 106, 210, 0.25)',
  },
  strong: {
    boxShadow: '0 0 40px var(--glow-color, rgba(94, 106, 210, 0.5))',
    borderColor: 'rgba(94, 106, 210, 0.35)',
  },
  pulse: {
    boxShadow: '0 0 24px var(--glow-color, rgba(94, 106, 210, 0.4))',
    borderColor: 'rgba(94, 106, 210, 0.3)',
  },
}

const roundedMap = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
}

const paddingMap = {
  none: '0',
  sm: '12px',
  md: '16px',
  lg: '24px',
}

/**
 * GlowCard - 发光效果卡片
 *
 * 特性：
 * - 多种发光强度
 * - 主题色支持
 * - 悬停/点击微动效
 * - 可选脉冲动画
 */
export function GlowCard({
  children,
  className,
  style,
  intensity = 'medium',
  color = 'accent',
  customColor,
  hover = true,
  press = true,
  rounded = 'lg',
  padding = 'md',
  border = true,
  animated = false,
  onClick,
}: GlowCardProps) {
  const glowColor = color === 'custom' ? customColor ?? glowColorMap.accent : glowColorMap[color]
  const glowStyle = glowIntensityStyles[intensity]

  const baseStyles = {
    ...style,
    '--glow-color': glowColor,
    borderRadius: roundedMap[rounded],
    padding: paddingMap[padding],
    background: 'var(--elevation-2)',
    border: border ? `1px solid ${glowStyle.borderColor}` : '1px solid transparent',
    boxShadow: glowStyle.boxShadow,
    position: 'relative' as const,
    overflow: 'hidden',
  } as CSSProperties

  const Component = onClick ? motion.button : motion.div

  return (
    <Component
      className={cn('cursor-pointer', className)}
      style={baseStyles}
      onClick={onClick}
      whileHover={hover ? { scale: 1.02, y: -2 } : undefined}
      whileTap={press ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Inner glow overlay */}
      {intensity !== 'subtle' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`,
            opacity: 0.1,
          }}
        />
      )}

      {/* Animated pulse effect */}
      {animated && intensity === 'pulse' && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`,
          }}
          animate={{
            opacity: [0.05, 0.15, 0.05],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      <div className="relative z-10">{children}</div>
    </Component>
  )
}

/**
 * GlowBadge - 发光标签
 */
export function GlowBadge({
  children,
  className,
  color = 'accent',
  size = 'md',
}: {
  children: ReactNode
  className?: string
  color?: GlowColor
  size?: 'sm' | 'md' | 'lg'
}) {
  const glowColor = glowColorMap[color]
  const sizeStyles = {
    sm: { padding: '2px 8px', fontSize: '11px' },
    md: { padding: '4px 10px', fontSize: '12px' },
    lg: { padding: '6px 14px', fontSize: '13px' },
  }

  return (
    <span
      className={cn('inline-flex items-center font-medium rounded-full', className)}
      style={{
        ...sizeStyles[size],
        background: `rgba(${color === 'accent' ? '94, 106, 210' : color === 'character' ? '232, 184, 125' : color === 'ifline' ? '126, 183, 74' : '94, 106, 210'}, 0.1)`,
        border: `1px solid ${glowColor}`,
        boxShadow: `0 0 8px ${glowColor}`,
        color: glowColor.replace(/[\d.]+\)$/, '1)').replace('rgba', 'rgb'),
      }}
    >
      {children}
    </span>
  )
}

/**
 * GlowDivider - 发光分割线
 */
export function GlowDivider({
  className,
  color = 'accent',
  intensity = 'soft',
  direction = 'horizontal',
}: {
  className?: string
  color?: GlowColor
  intensity?: 'subtle' | 'soft' | 'medium'
  direction?: 'horizontal' | 'vertical'
}) {
  const glowColor = glowColorMap[color]
  const intensityOpacity = { subtle: 0.3, soft: 0.5, medium: 0.7 }[intensity]

  return (
    <div
      className={cn('pointer-events-none', className)}
      style={{
        background: `linear-gradient(${direction === 'vertical' ? '90deg' : '180deg'}, transparent, ${glowColor}, transparent)`,
        opacity: intensityOpacity,
        width: direction === 'vertical' ? '1px' : '100%',
        height: direction === 'vertical' ? '100%' : '1px',
      }}
    />
  )
}