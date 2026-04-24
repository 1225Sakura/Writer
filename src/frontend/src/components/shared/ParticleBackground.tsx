/**
 * ParticleBackground - Pure CSS floating particle background (ultra-lightweight)
 *
 * Uses absolutely positioned small elements (divs), each with different float animation
 * Supports multiple particle shapes: circles, diamonds, thin lines
 * Colors use semi-transparent theme colors, very lightweight, no JS thread usage
 * Supports theme color sync and performance optimization (CSS transform + will-change)
 *
 * Note: This component uses pure CSS keyframes, no JS animation calculations
 * Zero impact on writing performance
 *
 * Simplification strategy:
 * - Reduced particle count (default 8)
 * - Removed cross shape (box-shadow overhead)
 * - Removed connection SVG layer
 * - Removed trail effect layer
 * - Better coordination with Canvas background (lower opacity, simpler animations)
 * - CSS containment for performance isolation
 */

import { useMemo, useRef, useEffect, useState } from 'react'

type ParticleShape = 'circle' | 'diamond' | 'line'

interface ParticleConfig {
  size: number
  left: string
  top: string
  delay: string
  duration: string
  colorVar: string
  opacity: number
  shape: ParticleShape
  rotation: number
  scale: number
}

/**
 * Theme color mapping - synced with CSS variables
 */
const themeColors: Record<string, string> = {
  accent: 'var(--accent-primary)',
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
}

/**
 * Particle shape distribution weights - simplified: only lightweight shapes
 * Increased circle ratio for cleaner, more subtle appearance
 */
const shapeWeights: ParticleShape[] = [
  'circle', 'circle', 'circle', 'circle', 'circle', 'circle',
  'diamond',
  'line',
]

/**
 * Seed-based pseudo-random number generator for consistent renders
 */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * Detect low-performance devices (mobile or small screen)
 */
function isLowPerformanceDevice(): boolean {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
  const isSmallScreen = window.innerWidth < 768
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return isMobile || isSmallScreen || prefersReducedMotion
}

/**
 * Predefined particle configs using CSS variables for theme sync
 * Colors reference CSS variables, auto-follow theme changes
 */
function useParticles(count: number = 8): ParticleConfig[] {
  return useMemo(() => {
    const colorKeys = Object.keys(themeColors)
    const rand = seededRandom(42) // Fixed seed for consistency
    const configs: ParticleConfig[] = []

    for (let i = 0; i < count; i++) {
      const colorKey = colorKeys[i % colorKeys.length]
      const shape = shapeWeights[Math.floor(rand() * shapeWeights.length)]
      const leftPct = 5 + (i * 90) / count + rand() * 6
      const topPct = 5 + rand() * 90
      configs.push({
        size: 1.5 + Math.floor(rand() * 2.5),
        left: `${leftPct}%`,
        top: `${topPct}%`,
        delay: `${(i * 1.2) % 12}s`,
        duration: `${22 + rand() * 16}s`,
        colorVar: themeColors[colorKey],
        opacity: 0.008 + rand() * 0.015,
        shape,
        rotation: Math.floor(rand() * 360),
        scale: 0.6 + rand() * 0.4,
      })
    }

    return configs
  }, [count])
}

/**
 * Get CSS styles for particle shape
 * Simplified: removed cross shape
 */
function getParticleShapeStyle(shape: ParticleShape, size: number): React.CSSProperties {
  switch (shape) {
    case 'circle':
      return {
        borderRadius: '50%',
        width: size,
        height: size,
      }
    case 'diamond':
      return {
        borderRadius: '1px',
        width: size,
        height: size,
        transform: `rotate(45deg) scale(var(--particle-scale, 1))`,
      }
    case 'line':
      return {
        borderRadius: '1px',
        width: size * 3,
        height: Math.max(1, size * 0.25),
        transform: `rotate(var(--particle-rotation, 0deg)) scale(var(--particle-scale, 1))`,
      }
    default:
      return {
        borderRadius: '50%',
        width: size,
        height: size,
      }
  }
}

interface ParticleBackgroundProps {
  particleCount?: number
  enabled?: boolean
  /** Deprecated, always false for performance */
  showConnections?: boolean
  /** Interface type affects particle personality */
  interfaceType?: 'chat' | 'settings' | 'writing'
}

/**
 * CSS animation keyframes - defined outside component to avoid recreation
 * Simplified animation: smaller movement range, longer cycle
 */
const particleStyles = `
  @keyframes particle-float {
    0%, 100% {
      transform: translateY(0) rotate(var(--particle-rotation, 0deg)) scale(var(--particle-scale, 1));
    }
    25% {
      transform: translateY(-4px) rotate(calc(var(--particle-rotation, 0deg) + 4deg)) scale(var(--particle-scale, 1));
    }
    50% {
      transform: translateY(-2px) rotate(calc(var(--particle-rotation, 0deg) - 2deg)) scale(var(--particle-scale, 1));
    }
    75% {
      transform: translateY(-3px) rotate(calc(var(--particle-rotation, 0deg) + 3deg)) scale(var(--particle-scale, 1));
    }
  }

  .particle-background .particle {
    animation: particle-float linear infinite;
    animation-duration: var(--particle-duration, 20s);
    animation-delay: var(--particle-delay, 0s);
  }
`

/**
 * Inject CSS styles (only when needed)
 */
function useParticleStyles() {
  useEffect(() => {
    if (document.getElementById('particle-background-styles')) return

    const styleEl = document.createElement('style')
    styleEl.id = 'particle-background-styles'
    styleEl.textContent = particleStyles
    document.head.appendChild(styleEl)

    return () => {
      const existing = document.getElementById('particle-background-styles')
      if (existing) existing.remove()
    }
  }, [])
}

/**
 * ParticleBackground - Theme-aware particle background (ultra-lightweight)
 *
 * Performance optimizations:
 * - Reduced particle count (default 8)
 * - Removed cross shape and box-shadow
 * - Removed connection SVG layer
 * - Removed trail effect layer
 * - IntersectionObserver: pause rendering when not in viewport
 * - Pure CSS animation: zero JS overhead
 * - CSS variable colors: auto-follow theme changes
 * - Lower opacity: doesn't interfere with text reading
 * - prefers-reduced-motion: respects user preference
 * - CSS transform instead of top/left: GPU accelerated
 * - will-change hints browser optimization
 * - Low-performance devices auto-reduce particle count
 * - CSS containment for paint/layout isolation
 */
export function ParticleBackground({
  particleCount: propParticleCount,
  enabled = true,
  showConnections: _showConnections,
  interfaceType = 'chat',
}: ParticleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Adjust particle count based on device performance and interface type
  const particleCount = useMemo(() => {
    if (propParticleCount) return propParticleCount
    const baseCount = isLowPerformanceDevice() ? 4 : 8
    // Writing interface uses fewer particles for focus
    if (interfaceType === 'writing') return Math.floor(baseCount * 0.5)
    return baseCount
  }, [propParticleCount, interfaceType])

  const particles = useParticles(particleCount)

  // Inject CSS animation styles
  useParticleStyles()

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mql.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // IntersectionObserver for visibility
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0 }
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  if (!enabled || !isVisible || prefersReducedMotion) {
    return <div ref={containerRef} aria-hidden="true" />
  }

  return (
    <div
      ref={containerRef}
      className="particle-background"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
        contain: 'paint layout',
      }}
      aria-hidden="true"
    >
      {/* Particle layer - simplified: only particles, no connections, no trails */}
      {particles.map((p, i) => {
        const shapeStyle = getParticleShapeStyle(p.shape, p.size)

        return (
          <div
            key={i}
            className={`particle particle--${p.shape}`}
            style={{
              position: 'absolute',
              left: p.left,
              top: p.top,
              backgroundColor: p.colorVar,
              opacity: p.opacity,
              willChange: 'transform',
              // CSS variable pass animation params
              ['--particle-rotation' as string]: `${p.rotation}deg`,
              ['--particle-scale' as string]: p.scale,
              ['--particle-delay' as string]: p.delay,
              ['--particle-duration' as string]: p.duration,
              ...shapeStyle,
            }}
          />
        )
      })}
    </div>
  )
}
