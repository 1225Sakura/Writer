/**
 * MaterialCard - Unified card component with multiple visual variants
 *
 * Replaces: GlowCard, PremiumCard, SpotlightCard, shared/GlassCard
 * All card effects unified into a single component with variant props.
 *
 * Uses material texture backgrounds instead of glassmorphism (no backdrop-filter).
 */

import * as React from 'react'
import { motion } from 'framer-motion'
import { useRef, useState, useCallback, type ReactNode, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { useTheme } from '@/hooks/useTheme'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import {
  entityColorMap,
  entityGlowMap,
  spotlightColorMap,
  glowColorMap,
  intensityStyles,
  lightIntensityStyles,
  borderStyles,
  lightBorderStyles,
  glowIntensityStyles,
  spotlightIntensityMap,
  premiumGlowIntensityMap,
  roundedMap,
  paddingMap,
  premiumRoundedMap,
  premiumPaddingMap,
} from '@/components/shared/CardPrimitives'
import type { GlowIntensity, SpotlightColor } from '@/components/shared/CardPrimitives'

// Re-export types from CardPrimitives for consumers
export type { GlowIntensity, SpotlightColor } from '@/components/shared/CardPrimitives'


// ============ Types ============

export type CardVariant = 'default' | 'elevated' | 'floating' | 'glow' | 'spotlight' | 'gradient-border'
export type CardIntensity = 'light' | 'medium' | 'strong'
export type EntityColor = 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'accent'
export type CardBorder = 'none' | 'subtle' | 'glow' | 'accent'

// ============ Variant Styles (unique to MaterialCard) ============

const variantStyles: Record<CardVariant, CSSProperties> = {
  default: {},
  elevated: {
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12), 0 8px 24px rgba(0, 0, 0, 0.08), inset 0 1px 0 var(--border-subtle)',
  },
  floating: {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15), 0 16px 40px rgba(0, 0, 0, 0.12), inset 0 1px 0 var(--border-subtle)',
    transform: 'translateY(0)',
  },
  glow: {
    position: 'relative' as const,
    overflow: 'hidden',
  },
  spotlight: {
    position: 'relative' as const,
    overflow: 'hidden',
  },
  'gradient-border': {
    position: 'relative' as const,
    overflow: 'hidden',
  },
}

const lightVariantStyles: Record<CardVariant, CSSProperties> = {
  default: {},
  elevated: {
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06), 0 8px 24px rgba(0, 0, 0, 0.04), inset 0 1px 0 var(--border-subtle)',
  },
  floating: {
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 16px 40px rgba(0, 0, 0, 0.06), inset 0 1px 0 var(--border-subtle)',
    transform: 'translateY(0)',
  },
  glow: {
    position: 'relative' as const,
    overflow: 'hidden',
  },
  spotlight: {
    position: 'relative' as const,
    overflow: 'hidden',
  },
  'gradient-border': {
    position: 'relative' as const,
    overflow: 'hidden',
  },
}

// ============ Helper Functions ============

// ============ Props Interface ============

export interface GlassCardProps {
  children: ReactNode
  className?: string
  /** Visual variant */
  variant?: CardVariant
  /** Glass effect intensity */
  intensity?: CardIntensity
  /** Entity color for accent borders and glows */
  entityColor?: EntityColor
  /** Border style */
  border?: CardBorder
  /** Glow intensity (for glow variant) */
  glowIntensity?: GlowIntensity
  /** Spotlight color (for spotlight variant) */
  spotlightColor?: SpotlightColor
  /** Custom spotlight color */
  spotlightCustomColor?: string
  /** Spotlight intensity */
  spotlightIntensity?: 'subtle' | 'soft' | 'medium' | 'strong'
  /** Gradient border colors */
  gradientFrom?: string
  gradientVia?: string
  gradientTo?: string
  gradientGlowColor?: string
  gradientGlowIntensity?: 'subtle' | 'medium' | 'strong'
  borderWidth?: number
  /** Hover glow for gradient-border */
  hoverGlow?: boolean
  /** Enable hover animation */
  hover?: boolean
  /** Enable press animation */
  press?: boolean
  /** Rounded corners */
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  /** Padding */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  /** Custom background color */
  bgColor?: string
  /** Custom border color */
  borderColor?: string
  /** Enable shimmer animation */
  shimmer?: boolean
  /** Enable pulse animation (glow variant) */
  animated?: boolean
  /** Opacity */
  opacity?: number
  /** Click handler */
  onClick?: () => void
  /** Framer Motion layout */
  layout?: boolean
  layoutId?: string
  /** Content className (spotlight variant) */
  contentClassName?: string
  /** Inline styles */
  style?: CSSProperties
}

// ============ Component ============

export function MaterialCard({
  children,
  className,
  variant = 'default',
  intensity = 'medium',
  entityColor = 'accent',
  border = 'subtle',
  glowIntensity = 'subtle',
  spotlightColor = 'accent',
  spotlightCustomColor,
  spotlightIntensity = 'soft',
  gradientFrom = 'rgba(201, 169, 110, 0.6)',
  gradientVia = 'rgba(94, 181, 166, 0.4)',
  gradientTo = 'rgba(232, 184, 125, 0.5)',
  gradientGlowColor = '201, 169, 110',
  gradientGlowIntensity = 'medium',
  borderWidth = 1.5,
  hoverGlow = true,
  hover = true,
  press = false,
  rounded = 'lg',
  padding = 'md',
  bgColor,
  borderColor,
  shimmer = false,
  animated = false,
  opacity,
  onClick,
  layout,
  layoutId,
  contentClassName,
  style,
}: GlassCardProps) {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const currentIntensity = isLight ? lightIntensityStyles : intensityStyles
  const currentBorder = isLight ? lightBorderStyles : borderStyles
  const currentVariant = isLight ? lightVariantStyles : variantStyles

  // Spotlight state
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }, [])

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
  }, [])

  // Glow effect styles
  const glowColorValue = glowColorMap[entityColor] || glowColorMap.accent
  const glowStyle = glowIntensityStyles[glowIntensity]

  // Spotlight config
  const rgbValue = spotlightCustomColor ?? spotlightColorMap[spotlightColor]
  const spotlightConfig = spotlightIntensityMap[spotlightIntensity]

  // GradientBorder config
  const glowConfig = premiumGlowIntensityMap[gradientGlowIntensity]
  const radius = variant === 'gradient-border' ? premiumRoundedMap[rounded] : roundedMap[rounded]
  const pad = variant === 'gradient-border' ? premiumPaddingMap[padding] : paddingMap[padding]

  const innerRadius = React.useMemo(() => {
    if (variant !== 'gradient-border') return radius
    const r = parseInt(radius)
    return `${Math.max(r - borderWidth, 0)}px`
  }, [variant, radius, borderWidth])

  const baseStyle: CSSProperties = {
    ...currentIntensity[intensity],
    ...currentBorder[border],
    ...currentVariant[variant],
    borderRadius: roundedMap[rounded],
    padding: paddingMap[padding],
    ...(bgColor && { background: bgColor }),
    ...(borderColor && { border: `1px solid ${borderColor}` }),
    ...(opacity !== undefined && { opacity }),
    ...style,
    // Glow variant
    ...(variant === 'glow' && {
      '--glow-color': glowColorValue,
      background: 'var(--elevation-2)',
      border: `1px solid ${glowStyle.borderColor}`,
      boxShadow: glowStyle.boxShadow,
      position: 'relative' as const,
      overflow: 'hidden',
    }),
    // Spotlight variant
    ...(variant === 'spotlight' && {
      '--spotlight-x': `${mousePosition.x}px`,
      '--spotlight-y': `${mousePosition.y}px`,
      '--spotlight-color': rgbValue,
      '--spotlight-size': `${spotlightConfig.size}px`,
      '--spotlight-opacity': spotlightConfig.opacity,
      borderRadius: roundedMap[rounded],
      background: bgColor || 'var(--elevation-2)',
      border: border === 'none' ? '1px solid transparent' : '1px solid var(--border-subtle)',
      position: 'relative' as const,
      overflow: 'hidden',
    }),
    // Gradient-border variant
    ...(variant === 'gradient-border' && {
      borderRadius: radius,
      padding: `${borderWidth}px`,
      background: `linear-gradient(135deg, ${gradientFrom}, ${gradientVia}, ${gradientTo})`,
    }),
  }

  // ============ Spotlight Variant ============
  if (variant === 'spotlight') {
    const Wrapper = onClick ? motion.button : motion.div
    const wrapperProps = onClick
      ? { onClick, whileTap: { scale: 0.98 } }
      : {}

    return (
      <Wrapper
        ref={cardRef as any}
        layout={layout}
        layoutId={layoutId}
        className={cn(
          'relative text-left',
          onClick && 'cursor-pointer',
          className
        )}
        style={baseStyle}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        whileHover={hover ? { y: -2 } : undefined}
        transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
        {...wrapperProps}
      >
        {/* Spotlight overlay */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: isHovering ? 1 : 0,
            background: `radial-gradient(${spotlightConfig.size}px circle at var(--spotlight-x) var(--spotlight-y), rgba(var(--spotlight-color), var(--spotlight-opacity)), transparent 60%)`,
          }}
        />

        {/* Subtle border glow on hover */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300 rounded-inherit"
          style={{
            opacity: isHovering ? 0.5 : 0,
            borderRadius: 'inherit',
            boxShadow: `inset 0 0 0 1px rgba(${rgbValue}, 0.15)`,
          }}
        />

        {/* Content */}
        <div
          className={cn('relative z-10', contentClassName)}
          style={{ padding: paddingMap[padding] }}
        >
          {children}
        </div>
      </Wrapper>
    )
  }

  // ============ Gradient-Border Variant ============
  if (variant === 'gradient-border') {
    return (
      <motion.div
        layout={layout}
        layoutId={layoutId}
        className={cn(
          'relative overflow-hidden',
          onClick && 'cursor-pointer',
          className
        )}
        style={baseStyle}
        onClick={onClick}
        whileHover={hoverGlow ? {
          boxShadow: `0 0 ${glowConfig.spread}px rgba(${gradientGlowColor}, ${glowConfig.opacity}), 0 0 ${glowConfig.spread * 2}px rgba(${gradientGlowColor}, ${glowConfig.opacity * 0.5})`,
        } : undefined}
        whileTap={press ? { scale: 0.98 } : undefined}
        transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
      >
        {/* Glow扩散效果层 */}
        {hoverGlow && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{ borderRadius: radius }}
            animate={{
              boxShadow: isHovering
                ? `inset 0 0 ${glowConfig.spread * 0.8}px rgba(${gradientGlowColor}, ${glowConfig.opacity * 0.3})`
                : `inset 0 0 0px rgba(${gradientGlowColor}, 0)`,
            }}
            transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
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
                background: 'linear-gradient(90deg, transparent, rgba(201, 169, 110, 0.04), rgba(94, 181, 166, 0.03), transparent)',
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
                background: `radial-gradient(ellipse at 50% 0%, rgba(${gradientGlowColor}, 0.06) 0%, transparent 60%)`,
              }}
              animate={{ opacity: isHovering ? 1 : 0 }}
              transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
            />
          )}

          {/* 内容 */}
          <div className="relative z-10">{children}</div>
        </div>
      </motion.div>
    )
  }

  // ============ Default / Elevated / Floating / Glow Variants ============
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
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    >
      {/* Entity color border overlay */}
      {border === 'glow' && (
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
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
          style={{
            background: isLight
              ? 'radial-gradient(ellipse at 50% 0%, rgba(201, 169, 110, 0.06) 0%, transparent 60%)'
              : 'radial-gradient(ellipse at 50% 0%, rgba(201, 169, 110, 0.08) 0%, transparent 60%)',
          }}
        />
      )}

      {/* Shimmer animation overlay */}
      {shimmer && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-inherit"
          style={{
            background: isLight
              ? 'linear-gradient(90deg, transparent, rgba(201, 169, 110, 0.04), transparent)'
              : 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.03), transparent)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Glow variant inner glow overlay - 仅在非 subtle 时显示 */}
      {variant === 'glow' && glowIntensity !== 'subtle' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${glowColorValue} 0%, transparent 70%)`,
            opacity: 0.06,
          }}
        />
      )}

      {/* Glow variant animated pulse - 仅在显式启用时显示 */}
      {variant === 'glow' && animated && (
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

// ============ Backward-compatible alias ============

export const GlassCard = MaterialCard

// ============ Sub-components ============

export interface GlassCardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode
  title?: string
  subtitle?: string
}

export const GlassCardHeader = React.forwardRef<HTMLDivElement, GlassCardHeaderProps>(
  ({ className, icon, title, subtitle, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-start gap-3 mb-4', className)}
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
GlassCardHeader.displayName = 'GlassCardHeader'

export interface GlassCardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

export const GlassCardContent = React.forwardRef<HTMLDivElement, GlassCardContentProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('text-[var(--text-secondary)] text-sm leading-relaxed', className)}
        {...props}
      />
    )
  }
)
GlassCardContent.displayName = 'GlassCardContent'

export interface GlassCardFooterProps extends React.HTMLAttributes<HTMLDivElement> {}

export const GlassCardFooter = React.forwardRef<HTMLDivElement, GlassCardFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex items-center justify-between mt-4 pt-4 border-t border-[var(--border-subtle)]', className)}
        {...props}
      />
    )
  }
)
GlassCardFooter.displayName = 'GlassCardFooter'

// ============ Legacy compatibility exports ============

/** @deprecated Use MaterialCard with variant="glow" instead */
export function GlowCard(props: GlassCardProps) {
  return <MaterialCard {...props} variant="glow" />
}

/** @deprecated Use MaterialCard with variant="spotlight" instead */
export function SpotlightCard(props: GlassCardProps) {
  return <MaterialCard {...props} variant="spotlight" />
}

/** @deprecated Use MaterialCard with variant="gradient-border" instead */
export function PremiumCard(props: GlassCardProps) {
  return <MaterialCard {...props} variant="gradient-border" />
}

// Re-export types for backward compatibility
export type { GlassCardProps as GlowCardProps }
export type { GlassCardProps as PremiumCardProps }
export type { GlassCardProps as SpotlightCardProps }
