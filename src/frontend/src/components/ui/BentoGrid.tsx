/**
 * BentoGrid - Bento 盒子风格网格布局
 *
 * 用于仪表板/信息展示，支持可变尺寸项目
 * 灵感来自 Apple Bento Grid 设计风格
 * 主题感知，支持悬停效果和动画
 */

import { motion } from 'framer-motion'
import type { ReactNode, CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'


export type BentoItemSize =
  | '1x1' // 标准单元格
  | '1x2' // 纵向双倍
  | '2x1' // 横向双倍
  | '2x2' // 四倍大
  | 'full' // 全宽

export type BentoItemColor =
  | 'default'
  | 'accent'
  | 'character'
  | 'item'
  | 'location'
  | 'faction'
  | 'outline'
  | 'ifline'
  | 'vermillion'

export interface BentoItemProps {
  children: ReactNode
  className?: string
  /** 尺寸 */
  size?: BentoItemSize
  /** 色彩主题 */
  color?: BentoItemColor
  /** 圆角 */
  rounded?: 'sm' | 'md' | 'lg' | 'xl'
  /** 内边距 */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  /** 悬停效果 */
  hover?: boolean
  /** 点击回调 */
  onClick?: () => void
  /** 自定义背景 */
  background?: string
  /** 是否启用光泽效果 */
  shimmer?: boolean
}

export interface BentoGridProps {
  children: ReactNode
  className?: string
  /** 列数 */
  columns?: number
  /** 间距 */
  gap?: string
  /** 最大宽度 */
  maxWidth?: string
}

const colorMap: Record<BentoItemColor, CSSProperties> = {
  default: {
    background: 'var(--elevation-2)',
    borderColor: 'var(--border-subtle)',
  },
  accent: {
    background: 'rgba(94, 106, 210, 0.08)',
    borderColor: 'rgba(94, 106, 210, 0.2)',
  },
  character: {
    background: 'rgba(232, 184, 125, 0.06)',
    borderColor: 'rgba(232, 184, 125, 0.18)',
  },
  item: {
    background: 'rgba(155, 126, 217, 0.06)',
    borderColor: 'rgba(155, 126, 217, 0.18)',
  },
  location: {
    background: 'rgba(94, 181, 166, 0.06)',
    borderColor: 'rgba(94, 181, 166, 0.18)',
  },
  faction: {
    background: 'rgba(212, 93, 93, 0.06)',
    borderColor: 'rgba(212, 93, 93, 0.18)',
  },
  outline: {
    background: 'rgba(91, 142, 232, 0.06)',
    borderColor: 'rgba(91, 142, 232, 0.18)',
  },
  ifline: {
    background: 'rgba(126, 183, 74, 0.06)',
    borderColor: 'rgba(126, 183, 74, 0.18)',
  },
  vermillion: {
    background: 'rgba(196, 92, 92, 0.06)',
    borderColor: 'rgba(196, 92, 92, 0.18)',
  },
}

const roundedMap = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
}

const paddingMap = {
  none: '0',
  sm: '12px',
  md: '16px',
  lg: '20px',
  xl: '28px',
}

/**
 * BentoItem - Bento 网格中的单个项目
 *
 * 特性：
 * - 多种尺寸预设（1x1, 1x2, 2x1, 2x2, full）
 * - 9种色彩主题
 * - 悬停微动效
 * - 可选光泽动画
 */
export function BentoItem({
  children,
  className,
  size = '1x1',
  color = 'default',
  rounded = 'lg',
  padding = 'md',
  hover = true,
  onClick,
  background,
  shimmer = false,
}: BentoItemProps) {
  const colorStyle = colorMap[color]
  const Component = onClick ? motion.button : motion.div

  const sizeStyles: Record<BentoItemSize, CSSProperties> = {
    '1x1': {},
    '1x2': { gridRow: 'span 2' },
    '2x1': { gridColumn: 'span 2' },
    '2x2': { gridColumn: 'span 2', gridRow: 'span 2' },
    full: { gridColumn: '1 / -1' },
  }

  return (
    <Component
      className={cn(
        'relative overflow-hidden text-left',
        hover && 'transition-shadow duration-300',
        onClick && 'cursor-pointer',
        className
      )}
      style={{
        borderRadius: roundedMap[rounded],
        padding: paddingMap[padding],
        background: background ?? colorStyle.background,
        border: `1px solid ${colorStyle.borderColor}`,
        ...sizeStyles[size],
      }}
      onClick={onClick}
      whileHover={
        hover
          ? {
              y: -1,
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
            }
          : undefined
      }
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    >
      {/* Shimmer overlay */}
      {shimmer && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0.03) 55%, transparent 60%)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
        />
      )}

      <div className="relative z-10 h-full">{children}</div>
    </Component>
  )
}

/**
 * BentoGrid - Bento 盒子网格容器
 *
 * 特性：
 * - 可配置列数
 * - 自动响应式（移动端单列）
 * - 支持自定义间距和最大宽度
 */
export function BentoGrid({
  children,
  className,
  columns = 3,
  gap = '12px',
  maxWidth = '1200px',
}: BentoGridProps) {
  return (
    <div
      className={cn(
        'grid w-full',
        'grid-cols-1',
        columns >= 2 && 'sm:grid-cols-2',
        columns >= 3 && 'lg:grid-cols-3',
        columns >= 4 && 'xl:grid-cols-4',
        className
      )}
      style={{
        gap,
        maxWidth,
        margin: '0 auto',
      }}
    >
      {children}
    </div>
  )
}

/**
 * BentoSection - Bento 区块标题
 */
export function BentoSection({
  title,
  description,
  className,
}: {
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn('mb-4', className)}>
      <h3
        className="text-base font-semibold"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-sm mt-1"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {description}
        </p>
      )}
    </div>
  )
}

/**
 * BentoStat - Bento 统计数字展示
 */
export function BentoStat({
  value,
  label,
  trend,
  color = 'accent',
}: {
  value: string | number
  label: string
  trend?: { value: number; positive: boolean }
  color?: BentoItemColor
}) {
  const colorHexMap: Record<string, string> = {
    accent: 'var(--accent-100)',
    character: 'var(--color-character)',
    item: 'var(--color-item)',
    location: 'var(--color-location)',
    faction: 'var(--color-faction)',
    outline: 'var(--color-outline)',
    ifline: 'var(--color-ifline)',
    vermillion: 'var(--vermillion-100)',
    default: 'var(--text-primary)',
  }

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        <div
          className="text-3xl font-bold tracking-tight"
          style={{ color: colorHexMap[color] ?? colorHexMap.accent }}
        >
          {value}
        </div>
        <div
          className="text-sm mt-1"
          style={{ color: 'var(--text-tertiary)' }}
        >
          {label}
        </div>
      </div>
      {trend && (
        <div className="flex items-center gap-1 mt-3">
          <span
            className="text-xs font-medium"
            style={{
              color: trend.positive ? 'var(--color-success)' : 'var(--color-danger)',
            }}
          >
            {trend.positive ? '+' : ''}{trend.value}%
          </span>
          <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            较上周
          </span>
        </div>
      )}
    </div>
  )
}
