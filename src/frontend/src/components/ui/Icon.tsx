import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import {
  Globe,
  Users,
  Box,
  MapPinned,
  Shield,
  Scale,
  ListTree,
  GitFork,
  Hash,
  UserCircle,
  Gem,
  Navigation,
  ShieldAlert,
  Gavel,
  NotebookText,
  ArrowLeftRight,
  Network,
  type LucideIcon,
} from 'lucide-react'

// ============================================================
// ICON SIZE SYSTEM
// Standard 4-tier size system for all icons:
//   xs:  14px — small labels, tags, inline text
//   sm:  16px — standard buttons, lists, navigation
//   md:  20px — large buttons, section headers
//   lg:  24px — empty states, hero icons
// ============================================================

export type IconSize = 'xs' | 'sm' | 'md' | 'lg'

const sizeMap: Record<IconSize, number> = {
  xs: 14,
  sm: 16,
  md: 20,
  lg: 24,
}

const sizeClassMap: Record<IconSize, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

// ============================================================
// ICON COLOR SYSTEM
// Use CSS design tokens for consistent icon coloring
//   primary:   main interactive icons
//   secondary: supporting icons in lists/cards
//   muted:     disabled or low-priority icons
//   accent:    brand-colored highlight icons
//   danger:    error/warning state icons
//   success:   success/confirm state icons
// ============================================================

export type IconColor =
  | 'primary'
  | 'secondary'
  | 'muted'
  | 'accent'
  | 'danger'
  | 'success'
  | 'warning'
  | 'inherit'

const colorClassMap: Record<IconColor, string> = {
  primary:   'text-[var(--icon-primary)]',
  secondary: 'text-[var(--icon-secondary)]',
  muted:     'text-[var(--icon-muted)]',
  accent:    'text-[var(--accent-primary)]',
  danger:    'text-[var(--icon-danger)]',
  success:   'text-[var(--icon-success)]',
  warning:   'text-[var(--icon-warning)]',
  inherit:   'text-current',
}

const colorStyleMap: Record<IconColor, React.CSSProperties['color']> = {
  primary:   'var(--icon-primary)',
  secondary: 'var(--icon-secondary)',
  muted:     'var(--icon-muted)',
  accent:    'var(--accent-primary)',
  danger:    'var(--icon-danger)',
  success:   'var(--icon-success)',
  warning:   'var(--icon-warning)',
  inherit:   undefined,
}

// ============================================================
// ENTITY TYPE ICONS
// Optimized for Chinese novel writing software context
// ============================================================

export type EntityIconType =
  | 'world'
  | 'character'
  | 'item'
  | 'location'
  | 'faction'
  | 'rule'
  | 'outline'
  | 'ifline'
  | 'graph'

const entityIconMap: Record<EntityIconType, LucideIcon> = {
  world: Globe,        // 世界观 - Globe (地球/世界)
  character: UserCircle, // 角色 - UserCircle (个人身份)
  item: Gem,           // 物品 - Gem (宝物/珍品)
  location: MapPinned, // 地点 - MapPinned (标记的地点)
  faction: ShieldAlert, // 势力 - ShieldAlert (阵营/势力)
  rule: Scale,         // 规则 - Scale (天平/法则)
  outline: ListTree,   // 大纲 - ListTree (层级结构)
  ifline: GitFork,     // IF线 - GitFork (分支)
  graph: Network,      // 关系图谱 - Network (网络/图谱)
}

export interface EntityIconProps {
  type: EntityIconType
  size?: IconSize
  color?: IconColor
  className?: string
  style?: React.CSSProperties
}

export function EntityIcon({ type, size = 'sm', color = 'inherit', className, style }: EntityIconProps) {
  const Icon = entityIconMap[type]
  const colorClass = colorClassMap[color]
  return (
    <Icon
      className={twMerge(clsx(sizeClassMap[size], colorClass, 'flex-shrink-0', className))}
      style={style}
    />
  )
}

// ============================================================
// PLOT THREAD ICON
// Replaces Unicode ❶ with proper icon
// ============================================================

export interface PlotThreadIconProps {
  size?: IconSize
  color?: IconColor
  className?: string
  style?: React.CSSProperties
}

export function PlotThreadIcon({ size = 'sm', color = 'inherit', className, style }: PlotThreadIconProps) {
  const colorClass = colorClassMap[color]
  return (
    <Hash
      className={twMerge(clsx(sizeClassMap[size], colorClass, 'flex-shrink-0', className))}
      style={style}
    />
  )
}

// ============================================================
// GENERIC ICON WRAPPER
// Standardized size + color props for all lucide icons
// Usage: <Icon icon={SomeLucideIcon} size="md" color="accent" />
// ============================================================

export interface IconProps {
  icon: LucideIcon
  size?: IconSize
  color?: IconColor
  className?: string
  style?: React.CSSProperties
  strokeWidth?: number
}

export function Icon({
  icon: LucideIconComponent,
  size = 'sm',
  color = 'inherit',
  className,
  style,
  strokeWidth = 2,
}: IconProps) {
  const colorClass = colorClassMap[color]
  return (
    <LucideIconComponent
      size={sizeMap[size]}
      strokeWidth={strokeWidth}
      className={twMerge(clsx('flex-shrink-0', colorClass, className))}
      style={style}
    />
  )
}

// ============================================================
// UTILITY: Get color style for inline usage
// Use when you need the color as a style prop (e.g. framer-motion)
// ============================================================

export function getIconColor(color: IconColor): React.CSSProperties['color'] {
  return colorStyleMap[color]
}

// ============================================================
// ICON CONFIG EXPORTS
// For use in maps/configs where you need the icon component reference
// ============================================================

export const entityIcons = entityIconMap

export { sizeMap, sizeClassMap, colorClassMap, colorStyleMap }

// Re-export optimized icons for direct use
export {
  Globe,
  Users,
  Box,
  MapPinned,
  Shield,
  Scale,
  ListTree,
  GitFork,
  Hash,
  UserCircle,
  Gem,
  Navigation,
  ShieldAlert,
  Gavel,
  NotebookText,
  ArrowLeftRight,
}
