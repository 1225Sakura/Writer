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
  type LucideIcon,
} from 'lucide-react'

// ============================================================
// ICON SIZE SYSTEM
// Default 3 sizes: sm(16px), md(20px), lg(24px)
// All icons should use these standard sizes for consistency
// ============================================================

export type IconSize = 'sm' | 'md' | 'lg' | 'xs'

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

const entityIconMap: Record<EntityIconType, LucideIcon> = {
  world: Globe,        // 世界观 - Globe (地球/世界)
  character: UserCircle, // 角色 - UserCircle (个人身份)
  item: Gem,           // 物品 - Gem (宝物/珍品)
  location: MapPinned, // 地点 - MapPinned (标记的地点)
  faction: ShieldAlert, // 势力 - ShieldAlert (阵营/势力)
  rule: Scale,         // 规则 - Scale (天平/法则)
  outline: ListTree,   // 大纲 - ListTree (层级结构)
  ifline: GitFork,     // IF线 - GitFork (分支)
}

export interface EntityIconProps {
  type: EntityIconType
  size?: IconSize
  className?: string
  style?: React.CSSProperties
}

export function EntityIcon({ type, size = 'sm', className, style }: EntityIconProps) {
  const Icon = entityIconMap[type]
  return (
    <Icon
      className={twMerge(clsx(sizeClassMap[size], className))}
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
  className?: string
  style?: React.CSSProperties
}

export function PlotThreadIcon({ size = 'sm', className, style }: PlotThreadIconProps) {
  return (
    <Hash
      className={twMerge(clsx(sizeClassMap[size], className))}
      style={style}
    />
  )
}

// ============================================================
// GENERIC ICON WRAPPER
// Standardized size prop for all icons
// Usage: <Icon icon={SomeLucideIcon} size="md" />
// ============================================================

export interface IconProps {
  icon: LucideIcon
  size?: IconSize
  className?: string
  style?: React.CSSProperties
  strokeWidth?: number
}

export function Icon({
  icon: LucideIconComponent,
  size = 'sm',
  className,
  style,
  strokeWidth = 2,
}: IconProps) {
  return (
    <LucideIconComponent
      size={sizeMap[size]}
      strokeWidth={strokeWidth}
      className={twMerge(clsx('flex-shrink-0', className))}
      style={style}
    />
  )
}

// ============================================================
// ICON CONFIG EXPORTS
// For use in maps/configs where you need the icon component reference
// ============================================================

export const entityIcons = entityIconMap

export { sizeMap, sizeClassMap }

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
