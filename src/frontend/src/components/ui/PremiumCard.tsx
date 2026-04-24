/**
 * PremiumCard - 高级卡片组件
 *
 * 带有渐变边框和微妙光晕效果的高级卡片，
 * 用于重要功能区块的展示。
 *
 * 特性：
 * - 渐变边框（可自定义颜色）
 * - Hover 时光晕扩散效果
 * - 支持 Framer Motion 动画
 * - 自动适配深色/浅色主题
 * - 可选 shimmer 光泽动画
 */

import * as React from 'react'
import { motion } from 'framer-motion'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface PremiumCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 卡片内容 */
  children: React.ReactNode
  /** 自定义类名 */
  className?: string
  /** 边框渐变起始色 */
  gradientFrom?: string
  /** 边框渐变中间色 */
  gradientVia?: string
  /** 边框渐变结束色 */
  gradientTo?: string
  /** 光晕颜色 */
  glowColor?: string
  /** 光晕强度 */
  glowIntensity?: 'subtle' | 'medium' | 'strong'
  /** 是否启用 hover 光晕扩散 */
  hoverGlow?: boolean
  /** 是否启用 shimmer 动画 */
  shimmer?: boolean
  /** 圆角大小 */
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** 内边距 */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  /** 背景色（默认使用主题 surface） */
  bgColor?: string
  /** 边框宽度 */
  borderWidth?: number
  /** 是否启用点击效果 */
  pressable?: boolean
  /** 点击回调 */
  onClick?: () => void
}

const glowIntensityMap = {
  subtle: { spread: 12, opacity: 0.15 },
  medium: { spread: 20, opacity: 0.25 },
  strong: { spread: 32, opacity: 0.4 },
}

const roundedMap: Record<string, string> = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
}

const paddingMap: Record<string, string> = {
  none: '0',
  sm: '16px',
  md: '24px',
  lg: '32px',
  xl: '40px',
}

export const PremiumCard = React.forwardRef<HTMLDivElement, PremiumCardProps>(
  (
    {
      children,
      className,
      gradientFrom = 'rgba(94, 106, 210, 0.6)',
      gradientVia = 'rgba(94, 181, 166, 0.4)',
      gradientTo = 'rgba(232, 184, 125, 0.5)',
      glowColor = '94, 106, 210',
      glowIntensity = 'medium',
      hoverGlow = true,
      shimmer = false,
      rounded = 'lg',
      padding = 'md',
      bgColor,
      borderWidth = 1.5,
      pressable = false,
      onClick,
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = React.useState(false)
    const glowConfig = glowIntensityMap[glowIntensity]
    const radius = roundedMap[rounded]
    const pad = paddingMap[padding]

    const innerRadius = React.useMemo(() => {
      const r = parseInt(radius)
      return `${Math.max(r - borderWidth, 0)}px`
    }, [radius, borderWidth])

    return (
      <motion.div
        ref={ref}
        className={twMerge(
          clsx(
            'relative overflow-hidden',
            pressable && 'cursor-pointer',
            className
          )
        )}
        style={{
          borderRadius: radius,
          padding: `${borderWidth}px`,
          background: `linear-gradient(135deg, ${gradientFrom}, ${gradientVia}, ${gradientTo})`,
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
        whileHover={hoverGlow ? {
          boxShadow: `0 0 ${glowConfig.spread}px rgba(${glowColor}, ${glowConfig.opacity}), 0 0 ${glowConfig.spread * 2}px rgba(${glowColor}, ${glowConfig.opacity * 0.5})`,
        } : undefined}
        whileTap={pressable ? { scale: 0.98 } : undefined}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Glow扩散效果层 */}
        {hoverGlow && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ borderRadius: radius }}
            animate={{
              boxShadow: isHovered
                ? `inset 0 0 ${glowConfig.spread * 0.8}px rgba(${glowColor}, ${glowConfig.opacity * 0.3})`
                : `inset 0 0 0px rgba(${glowColor}, 0)`,
            }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          />
        )}

        {/* 内部背景容器 */}
        <div
          className="relative overflow-hidden w-full h-full"
          style={{
            borderRadius: innerRadius,
            background: bgColor || 'var(--color-surface-raised)',
            padding: pad,
          }}
        >
          {/* Shimmer 光泽动画 */}
          {shimmer && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, rgba(94, 106, 210, 0.04), rgba(94, 181, 166, 0.03), transparent)',
                backgroundSize: '300% 100%',
              }}
              animate={{ backgroundPosition: ['300% 0', '-300% 0'] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
            />
          )}

          {/* Hover 时的内部光晕 */}
          {hoverGlow && (
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 50% 0%, rgba(${glowColor}, 0.06) 0%, transparent 60%)`,
              }}
              animate={{ opacity: isHovered ? 1 : 0 }}
              transition={{ duration: 0.3 }}
            />
          )}

          {/* 内容 */}
          <div className="relative z-10">{children}</div>
        </div>
      </motion.div>
    )
  }
)
PremiumCard.displayName = 'PremiumCard'

/**
 * PremiumCardHeader - 高级卡片头部
 */
export interface PremiumCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title?: string
  subtitle?: string
}

export const PremiumCardHeader = React.forwardRef<HTMLDivElement, PremiumCardHeaderProps>(
  ({ className, icon, title, subtitle, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(clsx('flex items-start gap-3 mb-4'), className)}
        {...props}
      >
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-[var(--accent-muted)] flex items-center justify-center text-[var(--accent-primary)]">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="text-base font-semibold text-[var(--text-primary)] leading-tight">{title}</h3>
          )}
          {subtitle && (
            <p className="text-sm text-[var(--text-secondary)] mt-0.5">{subtitle}</p>
          )}
          {children}
        </div>
      </div>
    )
  }
)
PremiumCardHeader.displayName = 'PremiumCardHeader'

/**
 * PremiumCardContent - 高级卡片内容区
 */
export interface PremiumCardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PremiumCardContent = React.forwardRef<HTMLDivElement, PremiumCardContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(clsx('text-[var(--text-secondary)] text-sm leading-relaxed'), className)}
        {...props}
      />
    )
  }
)
PremiumCardContent.displayName = 'PremiumCardContent'

/**
 * PremiumCardFooter - 高级卡片底部
 */
export interface PremiumCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const PremiumCardFooter = React.forwardRef<HTMLDivElement, PremiumCardFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={twMerge(clsx('flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-subtle)]'), className)}
        {...props}
      />
    )
  }
)
PremiumCardFooter.displayName = 'PremiumCardFooter'
