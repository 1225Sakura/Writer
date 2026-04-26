/**
 * GlowCard - 发光卡片组件（已废弃，请使用 GlassCard with effect="glow"）
 *
 * @deprecated Use GlassCard with effect="glow" prop instead
 *
 * 此组件保留用于向后兼容，新代码应使用：
 * <GlassCard effect="glow" glowIntensity="subtle" glowColor="accent">
 *
 * 设计规范（DESIGN_SYSTEM_TOKENS.md 第5节）：
 * - 发光强度：subtle(默认), soft, medium, strong
 * - 发光颜色：accent, character, item, location, faction, outline, ifline
 * - 默认使用 subtle 强度，避免过度发光干扰写作
 */

import type { ReactNode } from 'react'
import { GlassCard, type GlowIntensity, type GlowColor } from './GlassCard'

export type { GlowIntensity, GlowColor }

interface GlowCardProps {
  children: ReactNode
  className?: string
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

/**
 * GlowCard - 发光效果卡片（已废弃）
 *
 * @deprecated Use GlassCard with effect="glow" instead
 */
export function GlowCard({
  children,
  className,
  intensity = 'subtle',
  color = 'accent',
  hover = true,
  press = true,
  rounded = 'lg',
  padding = 'md',
  animated = false,
  onClick,
}: GlowCardProps) {
  return (
    <GlassCard
      effect="glow"
      glowIntensity={intensity}
      glowColor={color}
      hover={hover}
      press={press}
      rounded={rounded}
      padding={padding}
      onClick={onClick}
      className={className}
      animated={animated}
    >
      {children}
    </GlassCard>
  )
}

/**
 * GlowBadge - 发光标签（已废弃，请使用 GlassBadge）
 * @deprecated Use GlassBadge instead
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
  const sizePadding: 'none' | 'sm' | 'md' | 'lg' = size === 'sm' ? 'none' : size === 'md' ? 'sm' : 'md'
  return (
    <GlassCard
      className={className}
      effect="glow"
      glowIntensity="subtle"
      glowColor={color}
      rounded="full"
      padding={sizePadding}
    >
      {children}
    </GlassCard>
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
  const glowColor = glowColorMap[color]
  const intensityOpacity = { subtle: 0.2, soft: 0.35, medium: 0.5 }[intensity]

  return (
    <div
      className={className}
      style={{
        background: `linear-gradient(${direction === 'vertical' ? '90deg' : '180deg'}, transparent, ${glowColor}, transparent)`,
        opacity: intensityOpacity,
        width: direction === 'vertical' ? '1px' : '100%',
        height: direction === 'vertical' ? '100%' : '1px',
      }}
    />
  )
}