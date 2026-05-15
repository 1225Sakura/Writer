/**
 * CardSubComponents - Header, Content, Footer sub-components for MaterialCard
 */

import * as React from 'react'
import { type ReactNode, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'

// ============ Types ============

export type CardVariant = 'default' | 'elevated' | 'floating' | 'glow' | 'spotlight' | 'gradient-border'
export type CardIntensity = 'light' | 'medium' | 'strong'
export type EntityColor = 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'accent'
export type CardBorder = 'none' | 'subtle' | 'glow' | 'accent'

export interface GlassCardProps {
  children: ReactNode
  className?: string
  variant?: CardVariant
  intensity?: CardIntensity
  entityColor?: EntityColor
  border?: CardBorder
  glowIntensity?: import('@/components/shared/CardPrimitives').GlowIntensity
  spotlightColor?: import('@/components/shared/CardPrimitives').SpotlightColor
  spotlightCustomColor?: string
  spotlightIntensity?: 'subtle' | 'soft' | 'medium' | 'strong'
  gradientFrom?: string
  gradientVia?: string
  gradientTo?: string
  gradientGlowColor?: string
  gradientGlowIntensity?: 'subtle' | 'medium' | 'strong'
  borderWidth?: number
  hoverGlow?: boolean
  hover?: boolean
  press?: boolean
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full'
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  bgColor?: string
  borderColor?: string
  shimmer?: boolean
  animated?: boolean
  opacity?: number
  onClick?: () => void
  layout?: boolean
  layoutId?: string
  contentClassName?: string
  style?: CSSProperties
}

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
