/**
 * GlassCard - 统一装饰卡片组件
 *
 * 支持两种主要效果模式：
 * - glass: 毛玻璃效果 (backdrop-filter blur)
 * - glow: 发光效果 (box-shadow glow)
 *
 * 设计规范（DESIGN_SYSTEM_TOKENS.md 第5节）：
 * - 统一 glass blur: 16px
 * - 统一 border: 1px solid rgba(255,255,255,0.08)
 * - 变体：default, elevated, floating, outlined, filled, writing
 *
 * 特性：
 * - 多种玻璃强度可选（light, subtle, medium, strong, heavy, ultra, writing）
 * - 多种边框样式（none, subtle, soft, glow, gradient, accent, entity）
 * - 多种变体（default, elevated, floating, outlined, filled, writing）
 * - 悬停/点击微动效
 * - 自动适配主题（深色/浅色）
 * - 支持 Framer Motion layout
 * - 可选光泽动画
 */

import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'

export type GlassIntensity = 'light' | 'medium' | 'strong' | 'heavy' | 'subtle' | 'ultra' | 'writing'
export type GlassBorder = 'none' | 'subtle' | 'glow' | 'gradient' | 'accent' | 'soft' | 'entity'
export type GlassVariant = 'default' | 'elevated' | 'floating' | 'outlined' | 'filled' | 'writing'
export type GlassEffect = 'glass' | 'glow'  // 效果模式：毛玻璃 或 发光
export type GlowIntensity = 'subtle' | 'soft' | 'medium' | 'strong'
export type GlowColor = 'accent' | 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'custom'

interface GlassCardProps {
  children: ReactNode
  className?: string
  /** 玻璃效果强度 */
  intensity?: GlassIntensity
  /** 边框样式 */
  border?: GlassBorder
  /** 卡片变体 */
  variant?: GlassVariant
  /** 效果模式：glass(毛玻璃) 或 glow(发光) - 统一设计系统 */
  effect?: GlassEffect
  /** 发光强度（仅 effect="glow" 时有效） */
  glowIntensity?: GlowIntensity
  /** 发光颜色（仅 effect="glow" 时有效） */
  glowColor?: GlowColor
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
  /** 实体颜色编码（用于 entity 边框） */
  entityColor?: 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'accent'
  /** 是否启用脉冲动画 - 仅 glow 模式 */
  animated?: boolean
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
  writing: {
    background: 'rgba(13, 13, 18, 0.92)',
    backdropFilter: 'blur(20px) saturate(1.1)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.1)',
  },
}

const lightIntensityStyles: Record<GlassIntensity, CSSProperties> = {
  light: {
    background: 'rgba(255, 255, 255, 0.55)',
    backdropFilter: 'blur(8px) saturate(1.1)',
    WebkitBackdropFilter: 'blur(8px) saturate(1.1)',
  },
  subtle: {
    background: 'rgba(255, 255, 255, 0.65)',
    backdropFilter: 'blur(12px) saturate(1.15)',
    WebkitBackdropFilter: 'blur(12px) saturate(1.15)',
  },
  medium: {
    background: 'rgba(255, 255, 255, 0.72)',
    backdropFilter: 'blur(16px) saturate(1.2)',
    WebkitBackdropFilter: 'blur(16px) saturate(1.2)',
  },
  strong: {
    background: 'rgba(255, 255, 255, 0.82)',
    backdropFilter: 'blur(24px) saturate(1.3)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.3)',
  },
  heavy: {
    background: 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(32px) saturate(1.4)',
    WebkitBackdropFilter: 'blur(32px) saturate(1.4)',
  },
  ultra: {
    background: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(48px) saturate(1.5)',
    WebkitBackdropFilter: 'blur(48px) saturate(1.5)',
  },
  writing: {
    background: 'rgba(250, 248, 245, 0.92)',
    backdropFilter: 'blur(20px) saturate(1.1)',
    WebkitBackdropFilter: 'blur(20px) saturate(1.1)',
  },
}

const borderStyles: Record<GlassBorder, CSSProperties> = {
  none: { border: '1px solid transparent' },
  subtle: { border: '1px solid rgba(255, 255, 255, 0.08)' },
  soft: {
    border: '1px solid rgba(255, 255, 255, 0.12)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.06)',
  },
  glow: {
    border: '1px solid rgba(94, 106, 210, 0.25)',
    boxShadow: '0 0 16px rgba(94, 106, 210, 0.12), inset 0 0 16px rgba(94, 106, 210, 0.06)',
  },
  gradient: {
    border: '1px solid transparent',
    backgroundClip: 'padding-box',
    position: 'relative' as const,
  },
  accent: {
    border: '1px solid rgba(94, 106, 210, 0.35)',
    boxShadow: '0 0 20px rgba(94, 106, 210, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
  },
  entity: {
    border: '1px solid transparent',
    backgroundClip: 'padding-box',
    position: 'relative' as const,
  },
}

const lightBorderStyles: Record<GlassBorder, CSSProperties> = {
  none: { border: '1px solid transparent' },
  subtle: { border: '1px solid rgba(0, 0, 0, 0.06)' },
  soft: {
    border: '1px solid rgba(0, 0, 0, 0.1)',
    boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.5)',
  },
  glow: {
    border: '1px solid rgba(94, 106, 210, 0.2)',
    boxShadow: '0 0 16px rgba(94, 106, 210, 0.08), inset 0 0 16px rgba(94, 106, 210, 0.04)',
  },
  gradient: {
    border: '1px solid transparent',
    backgroundClip: 'padding-box',
    position: 'relative' as const,
  },
  accent: {
    border: '1px solid rgba(94, 106, 210, 0.25)',
    boxShadow: '0 0 20px rgba(94, 106, 210, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.3)',
  },
  entity: {
    border: '1px solid transparent',
    backgroundClip: 'padding-box',
    position: 'relative' as const,
  },
}

const variantStyles: Record<GlassVariant, CSSProperties> = {
  default: {},
  elevated: {
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.05)',
  },
  floating: {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 16px 40px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
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
  writing: {
    background: 'rgba(13, 13, 18, 0.94)',
    backdropFilter: 'blur(24px) saturate(1.05)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.05)',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.03)',
  },
}

const lightVariantStyles: Record<GlassVariant, CSSProperties> = {
  default: {},
  elevated: {
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.8)',
  },
  floating: {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 16px 40px rgba(0, 0, 0, 0.06), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
    transform: 'translateY(0)',
  },
  outlined: {
    background: 'transparent',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
    border: '1px solid rgba(0, 0, 0, 0.1)',
  },
  filled: {
    background: 'rgba(0, 0, 0, 0.04)',
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  },
  writing: {
    background: 'rgba(250, 248, 245, 0.94)',
    backdropFilter: 'blur(24px) saturate(1.05)',
    WebkitBackdropFilter: 'blur(24px) saturate(1.05)',
    border: '1px solid rgba(0, 0, 0, 0.06)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.5)',
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

const entityColorMap: Record<string, string> = {
  character: 'rgba(232, 184, 125, 0.5)',
  item: 'rgba(155, 126, 217, 0.5)',
  location: 'rgba(94, 181, 166, 0.5)',
  faction: 'rgba(212, 93, 93, 0.5)',
  outline: 'rgba(91, 142, 232, 0.5)',
  ifline: 'rgba(126, 183, 74, 0.5)',
  accent: 'rgba(94, 106, 210, 0.5)',
}

const entityGlowMap: Record<string, string> = {
  character: 'rgba(232, 184, 125, 0.15)',
  item: 'rgba(155, 126, 217, 0.15)',
  location: 'rgba(94, 181, 166, 0.15)',
  faction: 'rgba(212, 93, 93, 0.15)',
  outline: 'rgba(91, 142, 232, 0.15)',
  ifline: 'rgba(126, 183, 74, 0.15)',
  accent: 'rgba(94, 106, 210, 0.15)',
}

/* GlassBadge static maps */
const glassBadgeColorMap: Record<string, string> = {
  accent: 'rgba(94, 106, 210, 0.15)',
  character: 'rgba(232, 184, 125, 0.15)',
  item: 'rgba(155, 126, 217, 0.15)',
  location: 'rgba(94, 181, 166, 0.15)',
  faction: 'rgba(212, 93, 93, 0.15)',
  outline: 'rgba(91, 142, 232, 0.15)',
  ifline: 'rgba(126, 183, 74, 0.15)',
}

const glassBadgeBorderColorMap: Record<string, string> = {
  accent: 'rgba(94, 106, 210, 0.3)',
  character: 'rgba(232, 184, 125, 0.3)',
  item: 'rgba(155, 126, 217, 0.3)',
  location: 'rgba(94, 181, 166, 0.3)',
  faction: 'rgba(212, 93, 93, 0.3)',
  outline: 'rgba(91, 142, 232, 0.3)',
  ifline: 'rgba(126, 183, 74, 0.3)',
}

const glassBadgeSizeMap = {
  sm: { padding: '2px 6px', fontSize: '10px' },
  md: { padding: '4px 10px', fontSize: '12px' },
  lg: { padding: '6px 14px', fontSize: '13px' },
}

// ============ Glow Effect Constants (统一设计系统) ============
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

/* GlassButton static maps */
const glassButtonVariantStyles: Record<string, CSSProperties> = {
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

const glassButtonSizeMap = {
  sm: { padding: '4px 10px', fontSize: '12px', gap: '4px' },
  md: { padding: '8px 16px', fontSize: '13px', gap: '8px' },
  lg: { padding: '12px 24px', fontSize: '14px', gap: '10px' },
}

/**
 * GlassCard - 统一装饰卡片组件
 *
 * 特性：
 * - 多种玻璃强度可选（light, subtle, medium, strong, heavy, ultra, writing）
 * - 多种边框样式（none, subtle, soft, glow, gradient, accent, entity）
 * - 多种变体（default, elevated, floating, outlined, filled, writing）
 * - 悬停/点击微动效
 * - 自动适配主题（深色/浅色）
 * - 支持 Framer Motion layout
 * - 可选光泽动画
 * - 统一效果模式：glass(毛玻璃) / glow(发光)
 */
export function GlassCard({
  children,
  className,
  intensity = 'medium',
  border = 'subtle',
  variant = 'default',
  effect = 'glass',
  glowIntensity = 'subtle',
  glowColor = 'accent',
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
  entityColor = 'accent',
  animated = false,
}: GlassCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const currentIntensity = isLight ? lightIntensityStyles : intensityStyles
  const currentBorder = isLight ? lightBorderStyles : borderStyles
  const currentVariant = isLight ? lightVariantStyles : variantStyles

  // Glow effect styles
  const glowColorValue = glowColorMap[glowColor]
  const glowStyle = glowIntensityStyles[glowIntensity]

  const baseStyle: CSSProperties = {
    ...currentIntensity[intensity],
    ...currentBorder[border],
    ...currentVariant[variant],
    borderRadius: roundedMap[rounded],
    padding: paddingMap[padding],
    ...(bgColor && { background: bgColor }),
    ...(borderColor && { border: `1px solid ${borderColor}` }),
    ...(opacity !== undefined && { opacity }),
    ...(variant !== 'elevated' && variant !== 'floating' && shadow && {
      boxShadow: isLight
        ? '0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.06)'
        : '0 4px 24px rgba(0, 0, 0, 0.15), 0 1px 2px rgba(0, 0, 0, 0.1)',
    }),
    // Glow effect mode
    ...(effect === 'glow' && {
      '--glow-color': glowColorValue,
      background: 'var(--elevation-2)',
      border: `1px solid ${glowStyle.borderColor}`,
      boxShadow: glowStyle.boxShadow,
      position: 'relative' as const,
      overflow: 'hidden',
    }),
  }

  const Component = layout || layoutId ? motion.div : 'div'

  return (
    <Component
      layout={layout}
      layoutId={layoutId}
      className={cn(
        'relative overflow-hidden',
        hover && 'cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
      style={baseStyle}
      onClick={onClick}
      whileHover={hover ? {
        y: -2,
        boxShadow: isLight
          ? '0 8px 24px rgba(0, 0, 0, 0.1), 0 2px 6px rgba(0, 0, 0, 0.06)'
          : '0 8px 24px rgba(0, 0, 0, 0.2), 0 2px 6px rgba(0, 0, 0, 0.1)',
      } : undefined}
      whileTap={press ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Gradient border overlay */}
      {border === 'gradient' && (
        <div
          className="absolute inset-0 rounded-inherit pointer-events-none"
          style={{
            padding: '1px',
            background: isLight
              ? 'linear-gradient(135deg, rgba(94, 106, 210, 0.35), rgba(94, 181, 166, 0.25), rgba(232, 184, 125, 0.3))'
              : 'linear-gradient(135deg, rgba(94, 106, 210, 0.35), rgba(94, 181, 166, 0.25), rgba(232, 184, 125, 0.3))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            borderRadius: 'inherit',
          }}
        />
      )}

      {/* Entity color border overlay */}
      {border === 'entity' && (
        <motion.div
          className="absolute inset-0 rounded-inherit pointer-events-none"
          style={{
            padding: '1.5px',
            background: `linear-gradient(135deg, ${entityColorMap[entityColor]}, ${entityGlowMap[entityColor]})`,
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            borderRadius: 'inherit',
          }}
        />
      )}

      {/* Hover glow overlay for glow/accent borders */}
      {(border === 'glow' || border === 'accent') && hover && (
        <motion.div
          className="absolute inset-0 rounded-inherit pointer-events-none"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          style={{
            background: isLight
              ? 'radial-gradient(ellipse at 50% 0%, rgba(94, 106, 210, 0.06) 0%, transparent 60%)'
              : 'radial-gradient(ellipse at 50% 0%, rgba(94, 106, 210, 0.08) 0%, transparent 60%)',
          }}
        />
      )}

      {/* Shimmer animation overlay */}
      {shimmer && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-inherit"
          style={{
            background: isLight
              ? 'linear-gradient(90deg, transparent, rgba(94, 106, 210, 0.04), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.03), transparent)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Glow effect inner glow overlay - 仅在非 subtle 时显示 */}
      {effect === 'glow' && glowIntensity !== 'subtle' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${glowColorValue} 0%, transparent 70%)`,
            opacity: 0.06,
          }}
        />
      )}

      {/* Glow effect animated pulse - 仅在显式启用时显示 */}
      {effect === 'glow' && animated && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${glowColorValue} 0%, transparent 70%)`,
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
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const currentIntensity = isLight ? lightIntensityStyles : intensityStyles
  const currentBorder = isLight ? lightBorderStyles : borderStyles
  const currentVariant = isLight ? lightVariantStyles : variantStyles

  return (
    <div
      className={cn('relative overflow-hidden', className)}
      style={{
        ...currentIntensity[intensity],
        ...currentBorder[border],
        ...currentVariant[variant],
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
  return (
    <span
      className={cn('inline-flex items-center font-medium rounded-md', className)}
      style={{
        background: glassBadgeColorMap[color],
        border: `1px solid ${glassBadgeBorderColorMap[color]}`,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        ...glassBadgeSizeMap[size],
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
        ...glassButtonVariantStyles[variant],
        ...activeStyle,
        ...glassButtonSizeMap[size],
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
