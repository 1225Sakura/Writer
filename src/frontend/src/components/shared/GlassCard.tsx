/**
 * GlassCard - 毛玻璃效果卡片
 *
 * 支持多种玻璃效果强度、渐变边框、悬停动画
 * 自动适配当前主题（深色/浅色）
 *
 * 设计规范（DESIGN_VISUAL.md）：
 * - 深色模式：background rgba(26, 26, 46, 0.8), blur(12px)
 * - 浅色模式：background rgba(255, 255, 255, 0.85)
 * - 边框：rgba(255, 255, 255, 0.1) 深色 / rgba(255, 255, 255, 0.5) 浅色
 */

import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'

export type GlassIntensity = 'light' | 'medium' | 'strong' | 'heavy' | 'subtle' | 'ultra'
export type GlassBorder = 'none' | 'subtle' | 'glow' | 'gradient' | 'accent'
export type GlassVariant = 'default' | 'elevated' | 'floating' | 'outlined' | 'filled'

interface GlassCardProps {
  children: ReactNode
  className?: string
  /** 玻璃效果强度 */
  intensity?: GlassIntensity
  /** 边框样式 */
  border?: GlassBorder
  /** 卡片变体 */
  variant?: GlassVariant
  /** 是否启用悬停效果 */
  hover?: boolean
  /** 是否启用点击效果 */
  press?: boolean
  /** 圆角大小 */
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  /** 内边距 */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  /** 阴影 */
  shadow?: boolean
  /** 自定义背景色覆盖 */
  bgColor?: string
  /** 自定义边框色覆盖 */
  borderColor?: string
  /** 点击回调 */
  onClick?: () => void
  /** 作为 motion.div 的额外属性 */
  layout?: boolean
  layoutId?: string
  /** 是否启用光泽效果 */
  shimmer?: boolean
  /** 透明度 */
  opacity?: number
}

const intensityStyles: Record<GlassIntensity, CSSProperties> = {
  light: {
    background: 'rgba(15, 16, 17, 0.5)',
    backdropFilter: 'blur(8px) saturate(1.1)',
    WebkitBackdropFilter: 'blur(8px) saturate(1.1)',
  },
  subtle: {
    background: 'rgba(15, 16, 17, 0.55)',
    backdropFilter: 'blur(12px) saturate(1.15)',
    WebkitBackdropFilter: 'blur(12px) saturate(1.15)',
  },
  medium: {
    background: 'rgba(15, 16, 17, 0.65)',
    backdropFilter: 'blur(16px) saturate(1.2)',
    WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
  },
  strong: {
    background: 'rgba(15, 16, 17, 0.8)',
    backdropFilter: 'blur(24px) saturate(1.3)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
  },
  heavy: {
    background: 'rgba(15, 16, 17, 0.9)',
    backdropFilter: 'blur(32px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(32px) saturate(1.4)',
  },
  ultra: {
    background: 'rgba(15, 16, 17, 0.95)',
    backdropFilter: 'blur(48px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(48px) saturate(1.5)',
  },
}

const borderStyles: Record<GlassBorder, CSSProperties> = {
  none: { border: '1px solid transparent' },
  subtle: { border: '1px solid rgba(255, 255, 255, 0.06)' },
  glow: {
    border: '1px solid rgba(94, 106, 210, 0.2)',
    boxShadow: '0 0 12px rgba(94, 106, 210, 0.1), inset 0 0 12px rgba(94, 106, 210, 0.05)',
  },
  gradient: {
    border: '1px solid transparent',
    backgroundClip: 'padding-box',
    position: 'relative' as const,
  },
  accent: {
    border: '1px solid rgba(94, 106, 210, 0.3)',
    boxShadow: '0 0 16px rgba(94, 106, 210, 0.15)',
  },
}

const variantStyles: Record<GlassVariant, CSSProperties> = {
  default: {},
  elevated: {
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25), 0 2px 8px rgba(0, 0, 0, 0.15)',
  },
  floating: {
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.3), 0 4px 16px rgba(0, 0, 0, 0.2)',
    transform: 'translateY(0)',
  },
  outlined: {
    background: 'transparent',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    border: '1px solid var(--border-default)',
  },
  filled: {
    background: 'var(--elevation-2)',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  },
}

const roundedMap: Record<string, string> = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
}

const paddingMap: Record<string, string> = {
  none: '0',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
}

/**
 * GlassCard - 毛玻璃效果卡片
 *
 * 特性：
 * - 多种玻璃强度可选（light, subtle, medium, strong, heavy, ultra）
 * - 多种边框样式（none, subtle, glow, gradient, accent）
 * - 多种变体（default, elevated, floating, outlined, filled）
 * - 悬停/点击微动效
 * - 自动适配主题
 * - 支持 Framer Motion layout
 * - 可选光泽动画
 */
export function GlassCard({
  children,
  className,
  intensity = 'medium',
  border = 'subtle',
  variant = 'default',
  hover = true,
  press = false,
  rounded = 'lg',
  padding = 'md',
  shadow = false,
  bgColor,
  borderColor,
  onClick,
  layout,
  layoutId,
  shimmer = false,
  opacity,
}: GlassCardProps) {
  const baseStyle: CSSProperties = {
    ...intensityStyles[intensity],
    ...borderStyles[border],
    ...variantStyles[variant],
    borderRadius: roundedMap[rounded],
    padding: paddingMap[padding],
    ...(bgColor && { background: bgColor }),
    ...(borderColor && { border: `1px solid ${borderColor}` }),
    ...(opacity !== undefined && { opacity }),
    ...(variant !== 'elevated' && variant !== 'floating' && shadow && {
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1)',
    }),
  }

  const Component = layout || layoutId ? motion.div : 'div'

  return (
    <Component
      layout={layout}
      layoutId={layoutId}
      className={cn(
        'relative overflow-hidden',
        hover && 'transition-all duration-150 cursor-pointer',
        hover && 'hover:shadow-md hover:shadow-black/15',
        press && 'active:scale-[0.99]',
        onClick && 'cursor-pointer',
        className
      )}
      style={baseStyle}
      onClick={onClick}
      whileHover={hover ? { opacity: 0.97 } : undefined}
      transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Gradient border overlay - 降低透明度 */}
      {border === 'gradient' && (
        <div
          className="absolute inset-0 rounded-inherit pointer-events-none"
          style={{
            padding: '1px',
            background: 'linear-gradient(135deg, rgba(94, 106, 210, 0.25), rgba(94, 181, 166, 0.2), rgba(232, 184, 125, 0.22))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            borderRadius: 'inherit',
          }}
        />
      )}

      {/* Shimmer animation overlay - 仅在显式启用时显示，降低透明度 */}
      {shimmer && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-inherit"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.03), transparent)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {children}
    </Component>
  )
}

/**
 * GlassPanel - 全宽玻璃面板（用于侧边栏、抽屉等）
 */
export function GlassPanel({
  children,
  className,
  intensity = 'strong',
  border = 'subtle',
  variant = 'default',
}: {
  children: ReactNode
  className?: string
  intensity?: GlassIntensity
  border?: GlassBorder
  variant?: GlassVariant
}) {
  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        ...intensityStyles[intensity],
        ...borderStyles[border],
        ...variantStyles[variant],
        height: '100%',
      }}
    >
      {children}
    </div>
  )
}

/**
 * GlassBadge - 小型玻璃标签
 */
export function GlassBadge({
  children,
  className,
  color = 'accent',
  size = 'md',
}: {
  children: ReactNode
  className?: string
  color?: 'accent' | 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline'
  size?: 'sm' | 'md' | 'lg'
}) {
  const colorMap: Record<string, string> = {
    accent: 'rgba(94, 106, 210, 0.15)',
    character: 'rgba(232, 184, 125, 0.15)',
    item: 'rgba(155, 126, 217, 0.15)',
    location: 'rgba(94, 181, 166, 0.15)',
    faction: 'rgba(212, 93, 93, 0.15)',
    outline: 'rgba(91, 142, 232, 0.15)',
    ifline: 'rgba(126, 183, 74, 0.15)',
  }

  const borderColorMap: Record<string, string> = {
    accent: 'rgba(94, 106, 210, 0.3)',
    character: 'rgba(232, 184, 125, 0.3)',
    item: 'rgba(155, 126, 217, 0.3)',
    location: 'rgba(94, 181, 166, 0.3)',
    faction: 'rgba(212, 93, 93, 0.3)',
    outline: 'rgba(91, 142, 232, 0.3)',
    ifline: 'rgba(126, 183, 74, 0.3)',
  }

  const sizeMap = {
    sm: { padding: '2px 6px', fontSize: '10px' },
    md: { padding: '4px 10px', fontSize: '12px' },
    lg: { padding: '6px 14px', fontSize: '13px' },
  }

  return (
    <span
      className={cn('inline-flex items-center font-medium rounded-md', className)}
      style={{
        background: colorMap[color],
        border: `1px solid ${borderColorMap[color]}`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        ...sizeMap[size],
      }}
    >
      {children}
    </span>
  )
}

/**
 * GlassButton - 玻璃风格按钮
 */
export function GlassButton({
  children,
  className,
  variant = 'subtle',
  size = 'md',
  icon,
  isActive = false,
  shimmer = false,
  onClick,
}: {
  children: ReactNode
  className?: string
  variant?: 'ghost' | 'subtle' | 'accent' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  icon?: ReactNode
  isActive?: boolean
  shimmer?: boolean
  onClick?: () => void
}) {
  const variantStyles: Record<string, CSSProperties> = {
    ghost: {
      background: 'transparent',
      border: '1px solid transparent',
      color: 'var(--text-secondary)',
    },
    subtle: {
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid var(--border-default)',
      color: 'var(--text-primary)',
    },
    accent: {
      background: 'var(--accent-muted)',
      border: '1px solid rgba(94, 106, 210, 0.3)',
      color: 'var(--accent-primary)',
    },
    danger: {
      background: 'rgba(217, 58, 58, 0.1)',
      border: '1px solid rgba(217, 58, 58, 0.3)',
      color: 'var(--color-danger)',
    },
  }

  const sizeMap = {
    sm: { padding: '4px 10px', fontSize: '12px', gap: '4px' },
    md: { padding: '8px 16px', fontSize: '13px', gap: '8px' },
    lg: { padding: '12px 24px', fontSize: '14px', gap: '10px' },
  }

  const activeStyle: CSSProperties = isActive
    ? {
        background: 'var(--accent-muted)',
        borderColor: 'var(--accent-primary)',
        color: 'var(--accent-primary)',
      }
    : {}

  return (
    <motion.button
      className={cn('relative inline-flex items-center justify-center rounded-lg font-medium', className)}
      style={{
        ...variantStyles[variant],
        ...activeStyle,
        ...sizeMap[size],
      }}
      onClick={onClick}
      whileHover={{ scale: 1.02, opacity: 0.9 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.15 }}
    >
      {shimmer && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-inherit"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.1), transparent)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        />
      )}
      {icon && <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>}
      <span className="relative z-10">{children}</span>
    </motion.button>
  )
}

/**
 * GlassDivider - 玻璃风格分割线
 */
export function GlassDivider({
  className,
  vertical = false,
  intensity = 'subtle',
}: {
  className?: string
  vertical?: boolean
  intensity?: 'subtle' | 'medium' | 'strong'
}) {
  const opacityMap = { subtle: 0.15, medium: 0.25, strong: 0.4 }

  return (
    <div
      className={cn('pointer-events-none', className)}
      style={{
        background: 'linear-gradient(90deg, transparent, var(--border-strong), transparent)',
        opacity: opacityMap[intensity],
        width: vertical ? '1px' : '100%',
        height: vertical ? '100%' : '1px',
      }}
    />
  )
}