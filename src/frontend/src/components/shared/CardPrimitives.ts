/**
 * CardPrimitives - Shared style constants and type definitions for card components
 *
 * Extracted from GlassCard, SpotlightCard, PremiumCard, and GlowCard
 * to provide a single source of truth for card styling primitives.
 */

import type { CSSProperties } from 'react'

// ============ Types ============

export type GlassIntensity = 'light' | 'medium' | 'strong' | 'heavy' | 'subtle' | 'ultra' | 'writing'
export type GlassBorder = 'none' | 'subtle' | 'glow' | 'gradient' | 'accent' | 'soft' | 'entity'
export type GlassVariant = 'default' | 'elevated' | 'floating' | 'outlined' | 'filled' | 'writing'
export type GlassEffect = 'glass' | 'glow' | 'spotlight' | 'gradientBorder'
export type GlowIntensity = 'subtle' | 'soft' | 'medium' | 'strong'
export type GlowColor = 'accent' | 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'custom'
export type SpotlightColor =
  | 'accent'
  | 'character'
  | 'item'
  | 'location'
  | 'faction'
  | 'outline'
  | 'ifline'
  | 'vermillion'
  | 'white'

// ============ Color Maps ============

export const glowColorMap: Record<GlowColor, string> = {
  accent: 'var(--accent-muted)',
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
  custom: 'var(--accent-muted)',
}

export const spotlightColorMap: Record<SpotlightColor, string> = {
  accent: '201, 169, 110',
  character: '232, 184, 125',
  item: '155, 126, 217',
  location: '94, 181, 166',
  faction: '212, 93, 93',
  outline: '91, 142, 232',
  ifline: '126, 183, 74',
  vermillion: '196, 92, 92',
  white: '245, 240, 230',
}

export const entityColorMap: Record<string, string> = {
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
  accent: 'var(--accent-100)',
}

export const entityGlowMap: Record<string, string> = {
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
  accent: 'var(--accent-100)',
}

// ============ Intensity Styles ============

export const intensityStyles: Record<GlassIntensity, CSSProperties> = {
  light: {
    background: 'var(--glass-bg-subtle)',
  },
  subtle: {
    background: 'var(--glass-bg-subtle)',
  },
  medium: {
    background: 'var(--glass-bg)',
  },
  strong: {
    background: 'var(--glass-bg-strong)',
  },
  heavy: {
    background: 'var(--glass-bg-strong)',
  },
  ultra: {
    background: 'var(--glass-bg-strong)',
  },
  writing: {
    background: 'var(--glass-bg-medium)',
  },
}

export const lightIntensityStyles: Record<GlassIntensity, CSSProperties> = {
  light: {
    background: 'var(--glass-bg-subtle)',
  },
  subtle: {
    background: 'var(--glass-bg-subtle)',
  },
  medium: {
    background: 'var(--glass-bg)',
  },
  strong: {
    background: 'var(--glass-bg-strong)',
  },
  heavy: {
    background: 'var(--glass-bg-strong)',
  },
  ultra: {
    background: 'var(--glass-bg-strong)',
  },
  writing: {
    background: 'var(--glass-bg-medium)',
  },
}

// ============ Border Styles ============

export const borderStyles: Record<GlassBorder, CSSProperties> = {
  none: { border: '1px solid transparent' },
  subtle: { border: '1px solid var(--glass-border)' },
  soft: {
    border: '1px solid var(--border-strong)',
    boxShadow: 'inset 0 1px 0 var(--border-subtle)',
  },
  glow: {
    border: '1px solid var(--accent-muted)',
    boxShadow: '0 0 16px var(--accent-muted), inset 0 0 16px var(--accent-muted)',
  },
  gradient: {
    border: '1px solid transparent',
    backgroundClip: 'padding-box',
    position: 'relative' as const,
  },
  accent: {
    border: '1px solid var(--accent-100)',
    boxShadow: '0 0 20px var(--accent-muted), inset 0 1px 0 var(--border-subtle)',
  },
  entity: {
    border: '1px solid transparent',
    backgroundClip: 'padding-box',
    position: 'relative' as const,
  },
}

export const lightBorderStyles: Record<GlassBorder, CSSProperties> = {
  none: { border: '1px solid transparent' },
  subtle: { border: '1px solid var(--glass-border)' },
  soft: {
    border: '1px solid var(--border-strong)',
    boxShadow: 'inset 0 1px 0 var(--border-subtle)',
  },
  glow: {
    border: '1px solid var(--accent-muted)',
    boxShadow: '0 0 16px var(--accent-muted), inset 0 0 16px var(--accent-muted)',
  },
  gradient: {
    border: '1px solid transparent',
    backgroundClip: 'padding-box',
    position: 'relative' as const,
  },
  accent: {
    border: '1px solid var(--accent-100)',
    boxShadow: '0 0 20px var(--accent-muted), inset 0 1px 0 var(--border-subtle)',
  },
  entity: {
    border: '1px solid transparent',
    backgroundClip: 'padding-box',
    position: 'relative' as const,
  },
}

// ============ Variant Styles ============

export const variantStyles: Record<GlassVariant, CSSProperties> = {
  default: {},
  elevated: {
    boxShadow: 'var(--shadow-elevated), inset 0 1px 0 var(--border-subtle)',
  },
  floating: {
    boxShadow: 'var(--shadow-float), inset 0 1px 0 var(--border-subtle)',
    transform: 'translateY(0)',
  },
  outlined: {
    background: 'transparent',
    border: '1px solid var(--border-default)',
  },
  filled: {
    background: 'var(--color-surface-raised)',
  },
  writing: {
    background: 'var(--glass-bg-medium)',
    border: '1px solid var(--glass-border)',
    boxShadow: 'var(--shadow-drawer), inset 0 1px 0 var(--border-subtle)',
  },
}

export const lightVariantStyles: Record<GlassVariant, CSSProperties> = {
  default: {},
  elevated: {
    boxShadow: 'var(--shadow-elevated), inset 0 1px 0 var(--border-subtle)',
  },
  floating: {
    boxShadow: 'var(--shadow-float), inset 0 1px 0 var(--border-subtle)',
    transform: 'translateY(0)',
  },
  outlined: {
    background: 'transparent',
    border: '1px solid var(--border-default)',
  },
  filled: {
    background: 'var(--color-surface-raised)',
  },
  writing: {
    background: 'var(--glass-bg-medium)',
    border: '1px solid var(--glass-border)',
    boxShadow: 'var(--shadow-drawer), inset 0 1px 0 var(--border-subtle)',
  },
}

// ============ Glow Intensity Styles ============

export const glowIntensityStyles: Record<GlowIntensity, { boxShadow: string; borderColor: string }> = {
  subtle: {
    boxShadow: '0 0 8px var(--glow-color, var(--accent-muted)), 0 2px 8px rgba(0, 0, 0, 0.08)',
    borderColor: 'var(--accent-muted)',
  },
  soft: {
    boxShadow: '0 0 14px var(--glow-color, var(--accent-muted)), 0 4px 12px rgba(0, 0, 0, 0.1)',
    borderColor: 'var(--accent-muted)',
  },
  medium: {
    boxShadow: '0 0 24px var(--glow-color, var(--accent-muted)), 0 6px 20px rgba(0, 0, 0, 0.12)',
    borderColor: 'var(--accent-muted)',
  },
  strong: {
    boxShadow: '0 0 36px var(--glow-color, var(--accent-muted)), 0 8px 28px rgba(0, 0, 0, 0.15)',
    borderColor: 'var(--accent-muted)',
  },
}

// ============ Spotlight Intensity ============

export const spotlightIntensityMap: Record<string, { size: number; opacity: number }> = {
  subtle: { size: 180, opacity: 0.06 },
  soft: { size: 220, opacity: 0.1 },
  medium: { size: 280, opacity: 0.14 },
  strong: { size: 350, opacity: 0.2 },
}

// ============ Premium Gradient Border ============

export const premiumGlowIntensityMap: Record<string, { spread: number; opacity: number }> = {
  subtle: { spread: 12, opacity: 0.15 },
  medium: { spread: 20, opacity: 0.25 },
  strong: { spread: 32, opacity: 0.4 },
}

// ============ Utility Maps ============

export const roundedMap: Record<string, string> = {
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '12px',
  '2xl': '16px',
  full: '9999px',
}

export const paddingMap: Record<string, string> = {
  none: '0',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
}

export const premiumRoundedMap: Record<string, string> = {
  sm: '8px',
  md: '12px',
  lg: '16px',
  xl: '20px',
  '2xl': '24px',
}

export const premiumPaddingMap: Record<string, string> = {
  none: '0',
  sm: '16px',
  md: '24px',
  lg: '32px',
  xl: '40px',
}

// ============ Badge Maps ============

export const glassBadgeColorMap: Record<string, string> = {
  accent: 'var(--accent-muted)',
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
}

export const glassBadgeBorderColorMap: Record<string, string> = {
  accent: 'var(--accent-100)',
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
}

export const glassBadgeSizeMap = {
  sm: { padding: '2px 6px', fontSize: '10px' },
  md: { padding: '4px 10px', fontSize: '12px' },
  lg: { padding: '6px 14px', fontSize: '13px' },
}

// ============ Button Maps ============

export const glassButtonVariantStyles: Record<string, CSSProperties> = {
  ghost: {
    background: 'transparent',
    border: '1px solid transparent',
    color: 'var(--text-secondary)',
  },
  subtle: {
    background: 'var(--glass-bg-subtle)',
    border: '1px solid var(--border-default)',
    color: 'var(--text-primary)',
  },
  accent: {
    background: 'var(--accent-muted)',
    border: '1px solid var(--accent-100)',
    color: 'var(--accent-primary)',
  },
  danger: {
    background: 'var(--vermillion-muted)',
    border: '1px solid var(--vermillion-100)',
    color: 'var(--color-danger)',
  },
}

export const glassButtonSizeMap = {
  sm: { padding: '4px 10px', fontSize: '12px', gap: '4px' },
  md: { padding: '8px 16px', fontSize: '13px', gap: '8px' },
  lg: { padding: '12px 24px', fontSize: '14px', gap: '10px' },
}

// ============ Divider ============

export const dividerOpacityMap = { subtle: 0.15, medium: 0.25, strong: 0.4 }

// ============ Legacy GlowCard (ui/GlowCard) intensity map ============

export const legacyGlowIntensityMap = {
  low: {
    shadow: '0 0 12px',
    hoverShadow: '0 0 20px',
    opacity: 0.15,
    hoverOpacity: 0.25,
  },
  medium: {
    shadow: '0 0 20px',
    hoverShadow: '0 0 32px',
    opacity: 0.2,
    hoverOpacity: 0.35,
  },
  high: {
    shadow: '0 0 32px',
    hoverShadow: '0 0 48px',
    opacity: 0.3,
    hoverOpacity: 0.45,
  },
}

// ============ Helper Functions ============

/**
 * Get spotlight RGB triplet — prefers CSS variable for theme-awareness,
 * falls back to spotlightColorMap hardcoded values.
 */
export const getSpotlightRGB = (entity: string): string => {
  if (typeof document !== 'undefined') {
    const style = getComputedStyle(document.documentElement)
    const cssVar = style.getPropertyValue(`--spotlight-${entity}`).trim()
    if (cssVar) return cssVar
  }
  return spotlightColorMap[entity as SpotlightColor] || '201, 169, 110'
}

export function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '')
  const bigint = parseInt(sanitized, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
