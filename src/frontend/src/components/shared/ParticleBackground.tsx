/**
 * ParticleBackground - Enhanced CSS + JS hybrid floating particle background
 *
 * Uses absolutely positioned small elements (divs), each with different float animation
 * Supports multiple particle shapes: circles, diamonds, thin lines
 * Colors use semi-transparent theme colors, very lightweight, minimal JS thread usage
 * Supports theme color sync and performance optimization (CSS transform + will-change)
 *
 * Enhancements:
 * - Particle connection lines (lightweight JS, Canvas overlay)
 * - Mouse interaction (particles attracted/repelled by cursor)
 * - Dynamic color changes based on interface type
 * - Particle size random variation animation
 * - IntersectionObserver + tab visibility pause
 *
 * Performance optimizations:
 * - CSS animation for basic float (GPU accelerated)
 * - Canvas overlay only for connections (not per-frame DOM updates)
 * - requestAnimationFrame with visibility-aware pausing
 * - Reduced particle count on low-performance devices
 */

import { useMemo, useRef, useEffect, useState, useCallback } from 'react'

type ParticleShape = 'circle' | 'diamond' | 'line'

interface ParticleConfig {
  id: number
  size: number
  left: number
  top: number
  delay: string
  duration: string
  colorVar: string
  opacity: number
  shape: ParticleShape
  rotation: number
  scale: number
  baseSize: number
}

/**
 * Theme color mapping - synced with CSS variables
 * Interface-specific color palettes
 */
const themeColors: Record<string, string> = {
  accent: 'var(--accent-primary)',
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
}

const interfaceColorMap: Record<string, string[]> = {
  chat: ['accent', 'character', 'item'],
  settings: ['accent', 'location', 'item'],
  writing: ['accent', 'character', 'location'],
}

/**
 * Particle shape distribution weights
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
 * Generate particle configs using CSS variables for theme sync
 */
function useParticles(count: number, interfaceType: string = 'chat'): ParticleConfig[] {
  return useMemo(() => {
    const colorKeys = interfaceColorMap[interfaceType] || interfaceColorMap.chat
    const rand = seededRandom(42)
    const configs: ParticleConfig[] = []

    for (let i = 0; i < count; i++) {
      const colorKey = colorKeys[i % colorKeys.length]
      const shape = shapeWeights[Math.floor(rand() * shapeWeights.length)]
      const leftPct = 5 + (i * 90) / count + rand() * 6
      const topPct = 5 + rand() * 90
      const baseSize = 1.5 + Math.floor(rand() * 2.5)
      configs.push({
        id: i,
        size: baseSize,
        left: leftPct,
        top: topPct,
        delay: `${(i * 1.2) % 12}s`,
        duration: `${22 + rand() * 16}s`,
        colorVar: themeColors[colorKey] || themeColors.accent,
        opacity: 0.008 + rand() * 0.015,
        shape,
        rotation: Math.floor(rand() * 360),
        scale: 0.6 + rand() * 0.4,
        baseSize,
      })
    }

    return configs
  }, [count, interfaceType])
}

/**
 * Get CSS styles for particle shape
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
  /** Interface type affects particle personality and colors */
  interfaceType?: 'chat' | 'settings' | 'writing'
  /** Enable connection lines between nearby particles */
  showConnections?: boolean
  /** Enable mouse interaction (attract/repel) */
  mouseInteraction?: boolean
}

/**
 * CSS animation keyframes - defined outside component to avoid recreation
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

  @keyframes particle-pulse {
    0%, 100% {
      transform: scale(var(--particle-scale, 1));
    }
    50% {
      transform: scale(calc(var(--particle-scale, 1) * 1.3));
    }
  }

  .particle-background .particle {
    animation: particle-float linear infinite;
    animation-duration: var(--particle-duration, 20s);
    animation-delay: var(--particle-delay, 0s);
  }

  .particle-background .particle--circle {
    animation: particle-float linear infinite, particle-pulse ease-in-out infinite;
    animation-duration: var(--particle-duration, 20s), calc(var(--particle-duration, 20s) * 0.6);
    animation-delay: var(--particle-delay, 0s), calc(var(--particle-delay, 0s) + 2s);
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
 * ParticleBackground - Enhanced theme-aware particle background
 *
 * Performance optimizations:
 * - CSS animation for float + pulse (GPU accelerated)
 * - Optional Canvas overlay for connection lines
 * - IntersectionObserver: pause rendering when not in viewport
 * - Tab visibility: pause when tab hidden
 * - Pure CSS animation: minimal JS overhead
 * - CSS variable colors: auto-follow theme changes
 * - prefers-reduced-motion: respects user preference
 * - Low-performance devices auto-reduce particle count
 * - CSS containment for paint/layout isolation
 */
export function ParticleBackground({
  particleCount: propParticleCount,
  enabled = true,
  interfaceType = 'chat',
  showConnections = true,
  mouseInteraction = true,
}: ParticleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const animationRef = useRef<number>()
  const particlesRef = useRef<ParticleConfig[]>([])
  const particlePositionsRef = useRef<{ x: number; y: number; vx: number; vy: number }[]>([])

  // Adjust particle count based on device performance and interface type
  const particleCount = useMemo(() => {
    if (propParticleCount) return propParticleCount
    const baseCount = isLowPerformanceDevice() ? 4 : 8
    // Writing interface uses fewer particles for focus
    if (interfaceType === 'writing') return Math.floor(baseCount * 0.5)
    return baseCount
  }, [propParticleCount, interfaceType])

  const particles = useParticles(particleCount, interfaceType)
  particlesRef.current = particles

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

  // Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
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

  // Initialize particle positions for JS interaction
  const initPositions = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    particlePositionsRef.current = particles.map((p) => ({
      x: (p.left / 100) * rect.width,
      y: (p.top / 100) * rect.height,
      vx: 0,
      vy: 0,
    }))
  }, [particles])

  // Mouse tracking
  useEffect(() => {
    if (!mouseInteraction) return

    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    window.addEventListener('mousemove', handleMouseMove)
    const container = containerRef.current
    if (container) {
      container.addEventListener('mouseleave', handleMouseLeave)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (container) {
        container.removeEventListener('mouseleave', handleMouseLeave)
      }
    }
  }, [mouseInteraction])

  // Canvas connection lines + mouse interaction loop
  useEffect(() => {
    if (!showConnections || !enabled || !isVisible || !isTabVisible || prefersReducedMotion) return

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    initPositions()

    let width = 0
    let height = 0

    const handleResize = () => {
      const rect = container.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio, 2)
      width = rect.width
      height = rect.height
      canvas.width = width * dpr
      canvas.height = height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      initPositions()
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    const connectionDist = 100
    const maxConnections = 15
    const mouseInfluenceDist = 150

    const animate = () => {
      ctx.clearRect(0, 0, width, height)

      const positions = particlePositionsRef.current
      const mouse = mouseRef.current

      // Update positions with mouse interaction
      if (mouseInteraction && mouse.x >= 0) {
        positions.forEach((pos) => {
          const dx = mouse.x - pos.x
          const dy = mouse.y - pos.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < mouseInfluenceDist && dist > 5) {
            const force = (mouseInfluenceDist - dist) / mouseInfluenceDist * 0.3
            pos.vx += (dx / dist) * force
            pos.vy += (dy / dist) * force
          }

          // Damping
          pos.vx *= 0.95
          pos.vy *= 0.95
          pos.x += pos.vx
          pos.y += pos.vy

          // Keep within bounds (soft)
          if (pos.x < 0) { pos.x = 0; pos.vx *= -0.5 }
          if (pos.x > width) { pos.x = width; pos.vx *= -0.5 }
          if (pos.y < 0) { pos.y = 0; pos.vy *= -0.5 }
          if (pos.y > height) { pos.y = height; pos.vy *= -0.5 }
        })
      }

      // Draw connections
      let connectionCount = 0
      for (let i = 0; i < positions.length && connectionCount < maxConnections; i++) {
        for (let j = i + 1; j < positions.length && connectionCount < maxConnections; j++) {
          const dx = positions[i].x - positions[j].x
          const dy = positions[i].y - positions[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < connectionDist) {
            const opacity = (1 - dist / connectionDist) * 0.015
            ctx.beginPath()
            ctx.moveTo(positions[i].x, positions[i].y)
            ctx.lineTo(positions[j].x, positions[j].y)
            ctx.strokeStyle = `rgba(94, 106, 210, ${opacity})`
            ctx.lineWidth = 0.3
            ctx.stroke()
            connectionCount++
          }
        }

        // Mouse connections
        if (mouse.x >= 0) {
          const mdx = mouse.x - positions[i].x
          const mdy = mouse.y - positions[i].y
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
          if (mDist < connectionDist * 0.8) {
            const opacity = (1 - mDist / (connectionDist * 0.8)) * 0.02
            ctx.beginPath()
            ctx.moveTo(positions[i].x, positions[i].y)
            ctx.lineTo(mouse.x, mouse.y)
            ctx.strokeStyle = `rgba(232, 184, 125, ${opacity})`
            ctx.lineWidth = 0.3
            ctx.stroke()
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [showConnections, enabled, isVisible, isTabVisible, prefersReducedMotion, mouseInteraction, initPositions])

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
      {/* Particle layer */}
      {particles.map((p) => {
        const shapeStyle = getParticleShapeStyle(p.shape, p.size)

        return (
          <div
            key={p.id}
            className={`particle particle--${p.shape}`}
            style={{
              position: 'absolute',
              left: `${p.left}%`,
              top: `${p.top}%`,
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

      {/* Connection lines canvas overlay */}
      {showConnections && !isLowPerformanceDevice() && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}
