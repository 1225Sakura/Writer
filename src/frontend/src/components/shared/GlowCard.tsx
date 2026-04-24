/**
 * GlowCard - 光效卡片组件
 *
 * 带有发光效果的卡片，支持多种发光强度和颜色
 * 适用于突出显示、悬停效果、强调UI
 *
 * 设计规范（DESIGN_VISUAL.md）：
 * - glow-accent: 0 0 12px rgba(94, 106, 210, 0.25), 0 0 24px rgba(94, 106, 210, 0.1)
 * - glow-vermillion: 0 0 8px rgba(196, 92, 92, 0.25), 0 0 16px rgba(196, 92, 92, 0.1)
 *
 * 默认使用 subtle 强度，避免过度发光干扰写作
 */

import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type GlowIntensity = 'subtle' | 'soft' | 'medium' | 'strong'
export type GlowColor = 'accent' | 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'custom'

interface GlowCardProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** 发光强度 - 默认 subtle，避免过度发光 */
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
  /** 是否启用脉冲动画 - 默认关闭 */
  animated?: boolean
  /** 点击回调 */
  onClick?: () => void
}

const glowColorMap: Record<GlowColor, string> = {
  accent: 'rgba(94, 106, 210, 0.3)',
  character: 'rgba(232, 184, 125, 0.3)',
  item: 'rgba(155, 126, 217, 0.3)',
  location: 'rgba(94, 181, 166, 0.3)',
  faction: 'rgba(212, 93, 93, 0.3)',
  outline: 'rgba(91, 142, 232, 0.3)',
  ifline: 'rgba(126, 183, 74, 0.3)',
  custom: 'rgba(94, 106, 210, 0.3)',
}

const glowIntensityStyles: Record<GlowIntensity, { boxShadow: string; borderColor: string }> = {
  subtle: {
    boxShadow: '0 0 8px var(--glow-color, rgba(94, 106, 210, 0.18)), 0 2px 8px rgba(0, 0, 0, 0.08)',
    borderColor: 'rgba(94, 106, 210, 0.15)',
  },
  soft: {
    boxShadow: '0 0 14px var(--glow-color, rgba(94, 106, 210, 0.22)), 0 4px 12px rgba(0, 0, 0, 0.1)',
    borderColor: 'rgba(94, 106, 210, 0.2)',
  },
  medium: {
    boxShadow: '0 0 24px var(--glow-color, rgba(94, 106, 210, 0.3)), 0 6px 20px rgba(0, 0, 0, 0.12)',
    borderColor: 'rgba(94, 106, 210, 0.25)',
  },
  strong: {
    boxShadow: '0 0 36px var(--glow-color, rgba(94, 106, 210, 0.42)), 0 8px 28px rgba(0, 0, 0, 0.15)',
    borderColor: 'rgba(94, 106, 210, 0.32)',
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
 * - 多种发光强度（默认 subtle）
 * - 主题色支持
 * - 悬停/点击微动效（克制）
 * - 可选脉冲动画（默认关闭）
 */
export function GlowCard({
  children,
  className,
  style,
  intensity = 'subtle',
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
      whileHover={hover ? { y: -2, opacity: 0.96 } : undefined}
      whileTap={press ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Inner glow overlay - 仅在非 subtle 时显示 */}
      {intensity !== 'subtle' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`,
            opacity: 0.06,
          }}
        />
      )}

      {/* Animated pulse effect - 仅在显式启用时显示 */}
      {animated && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${glowColor} 0%, transparent 70%)`,
          }}
          animate={{
            opacity: [0.03, 0.08, 0.03],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 3,
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
 * 默认使用更柔和的发光
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
        boxShadow: `0 0 6px ${glowColor.replace(/[\d.]+\)$/, '0.15)')}`,
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
  intensity = 'subtle',
  direction = 'horizontal',
}: {
  className?: string
  color?: GlowColor
  intensity?: 'subtle' | 'soft' | 'medium'
  direction?: 'horizontal' | 'vertical'
}) {
  const glowColor = glowColorMap[color]
  const intensityOpacity = { subtle: 0.2, soft: 0.35, medium: 0.5 }[intensity]

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
