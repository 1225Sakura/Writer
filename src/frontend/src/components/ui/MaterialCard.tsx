/**
 * MaterialCard - Unified card component with multiple visual variants
 *
 * Replaces: GlowCard, PremiumCard, SpotlightCard, shared/GlassCard
 * All card effects unified into a single component with variant props.
 *
 * Uses material texture backgrounds instead of glassmorphism (no backdrop-filter).
 * Variant renderers and sub-components are in MaterialCardVariants.tsx.
 */

import { type CSSProperties } from 'react'
import { useTheme } from '@/hooks/useTheme'
import {
  glowColorMap,
  glowIntensityStyles,
  intensityStyles,
  lightIntensityStyles,
  borderStyles,
  lightBorderStyles,
  roundedMap,
  paddingMap,
  premiumRoundedMap,
} from '@/components/shared/CardPrimitives'
import type { GlowIntensity, SpotlightColor } from '@/components/shared/CardPrimitives'
import {
  SpotlightRenderer,
  GradientBorderRenderer,
  DefaultCardRenderer,
  GlassCardHeader,
  GlassCardContent,
  GlassCardFooter,
  type GlassCardProps,
  type GlassCardHeaderProps,
  type GlassCardContentProps,
  type GlassCardFooterProps,
  type CardVariant,
  type CardIntensity,
  type EntityColor,
  type CardBorder,
} from './MaterialCardVariants'

// Re-export types and sub-components for consumers
export type { GlassCardProps, GlassCardHeaderProps, GlassCardContentProps, GlassCardFooterProps, CardVariant, CardIntensity, EntityColor, CardBorder }
export type { GlowIntensity, SpotlightColor }
export { GlassCardHeader, GlassCardContent, GlassCardFooter }

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
  glow: { position: 'relative' as const, overflow: 'hidden' },
  spotlight: { position: 'relative' as const, overflow: 'hidden' },
  'gradient-border': { position: 'relative' as const, overflow: 'hidden' },
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
  glow: { position: 'relative' as const, overflow: 'hidden' },
  spotlight: { position: 'relative' as const, overflow: 'hidden' },
  'gradient-border': { position: 'relative' as const, overflow: 'hidden' },
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

  const glowColorValue = glowColorMap[entityColor] || glowColorMap.accent
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
    ...style,
    // Glow variant base
    ...(variant === 'glow' && {
      '--glow-color': glowColorValue,
      background: 'var(--elevation-2)',
      border: `1px solid ${glowStyle.borderColor}`,
      boxShadow: glowStyle.boxShadow,
      position: 'relative' as const,
      overflow: 'hidden',
    }),
    // Gradient-border variant base
    ...(variant === 'gradient-border' && {
      borderRadius: premiumRoundedMap[rounded],
      padding: `${borderWidth}px`,
      background: `linear-gradient(135deg, ${gradientFrom}, ${gradientVia}, ${gradientTo})`,
    }),
  }

  // ============ Spotlight Variant ============
  if (variant === 'spotlight') {
    return (
      <SpotlightRenderer
        className={className}
        baseStyle={baseStyle}
        onClick={onClick}
        hover={hover}
        press={press}
        layout={layout}
        layoutId={layoutId}
        contentClassName={contentClassName}
        padding={padding}
        rounded={rounded}
        spotlightColor={spotlightColor}
        spotlightCustomColor={spotlightCustomColor}
        spotlightIntensity={spotlightIntensity}
        border={border}
      >
        {children}
      </SpotlightRenderer>
    )
  }

  // ============ Gradient-Border Variant ============
  if (variant === 'gradient-border') {
    return (
      <GradientBorderRenderer
        className={className}
        baseStyle={baseStyle}
        onClick={onClick}
        hoverGlow={hoverGlow}
        hover={hover}
        press={press}
        layout={layout}
        layoutId={layoutId}
        shimmer={shimmer}
        bgColor={bgColor}
        gradientGlowColor={gradientGlowColor}
        gradientGlowIntensity={gradientGlowIntensity}
        borderWidth={borderWidth}
        rounded={rounded}
        padding={padding}
      >
        {children}
      </GradientBorderRenderer>
    )
  }

  // ============ Default / Elevated / Floating / Glow Variants ============
  return (
    <DefaultCardRenderer
      className={className}
      baseStyle={baseStyle}
      onClick={onClick}
      hover={hover}
      press={press}
      layout={layout}
      layoutId={layoutId}
      shimmer={shimmer}
      animated={animated}
      variant={variant}
      border={border}
      entityColor={entityColor}
      glowIntensity={glowIntensity}
      glowColorValue={glowColorValue}
      isLight={isLight}
    >
      {children}
    </DefaultCardRenderer>
  )
}

// ============ Backward-compatible alias ============

export const GlassCard = MaterialCard

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
