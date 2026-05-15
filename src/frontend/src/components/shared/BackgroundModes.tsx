/**
 * BackgroundModes - CSS-only background mode components
 *
 * Used by UnifiedBackground for reduced-motion, ink-wash, noise, and minimal modes.
 */

import { useMemo } from 'react'

// ============ CSS-Only Fallback Background ============

export function CSSOnlyBackground({
  interfaceType,
  className,
  immersive,
}: {
  interfaceType: string
  className?: string
  immersive?: boolean
}) {
  const gradient = useMemo(() => {
    const baseColor = 'var(--ink-90)'
    const accentColor = 'var(--accent-100)'
    switch (interfaceType) {
      case 'chat':
        return `radial-gradient(ellipse at 20% 80%, ${accentColor}08 0%, transparent 50%), radial-gradient(ellipse at 80% 20%, ${baseColor} 0%, transparent 50%)`
      case 'settings':
        return `linear-gradient(135deg, ${baseColor} 0%, ${accentColor}05 100%)`
      case 'writing':
        return `radial-gradient(ellipse at center, ${baseColor}40 0%, transparent 70%)`
      default:
        return `radial-gradient(ellipse at center, ${baseColor}40 0%, transparent 70%)`
    }
  }, [interfaceType])

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        background: gradient,
        opacity: immersive ? 0.5 : 1,
        pointerEvents: 'none',
      }}
    />
  )
}

// ============ Ink Wash Background ============

export function InkWashBackground({
  className,
  immersive,
}: {
  className?: string
  immersive?: boolean
}) {
  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        opacity: immersive ? 0.4 : 0.7,
        background: `
          radial-gradient(ellipse at 30% 20%, color-mix(in srgb, var(--accent-100) 4%, transparent) 0%, transparent 60%),
          radial-gradient(ellipse at 70% 80%, color-mix(in srgb, var(--vermillion-100) 3%, transparent) 0%, transparent 55%),
          radial-gradient(ellipse at 50% 50%, color-mix(in srgb, var(--color-outline) 2%, transparent) 0%, transparent 70%),
          linear-gradient(180deg, var(--ink-95) 0%, var(--ink-90) 50%, var(--ink-95) 100%)
        `,
      }}
    />
  )
}

// ============ Noise Texture Background ============

export function NoiseBackground({
  className,
  immersive,
}: {
  className?: string
  immersive?: boolean
}) {
  const noiseSvg = useMemo(() => {
    return `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
  }, [])

  return (
    <div
      className={className}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        opacity: immersive ? 0.5 : 1,
        background: `
          ${noiseSvg},
          radial-gradient(ellipse at 25% 25%, color-mix(in srgb, var(--accent-100) 3%, transparent) 0%, transparent 50%),
          radial-gradient(ellipse at 75% 75%, color-mix(in srgb, var(--color-character) 2%, transparent) 0%, transparent 50%),
          var(--ink-90)
        `,
        backgroundRepeat: 'repeat, no-repeat, no-repeat, no-repeat',
        backgroundSize: '200px 200px, cover, cover, cover',
      }}
    />
  )
}
