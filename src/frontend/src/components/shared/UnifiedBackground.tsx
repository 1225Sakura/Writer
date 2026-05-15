/**
 * UnifiedBackground - Single background component replacing all legacy background components.
 *
 * Modes: ambient, particles, ink-wash, noise, minimal, none.
 * Performance: FPS throttling, DPR limiting, tab/intersection pause, reduced-motion fallback.
 * Helpers in BackgroundHelpers.tsx, CSS modes in BackgroundModes.tsx.
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  isLowPerformanceDevice,
  getThemeColors,
  initParticles,
  drawParticles,
  getAmbientOrbs,
  densityConfig,
  lowPerformanceDensityConfig,
  speedConfig,
} from './BackgroundHelpers'

export { isLowPerformanceDevice } from './BackgroundHelpers'
import { CSSOnlyBackground, InkWashBackground, NoiseBackground } from './BackgroundModes'

export type UnifiedBackgroundMode = 'ambient' | 'particles' | 'minimal' | 'none' | 'ink-wash' | 'noise'

interface UnifiedBackgroundProps {
  className?: string
  mode?: UnifiedBackgroundMode
  enabled?: boolean
  /** Interface type affects color palette */
  interfaceType?: 'chat' | 'settings' | 'writing'
  /** Immersive mode reduces opacity */
  immersive?: boolean
  /** Density for particle mode */
  density?: 'low' | 'medium' | 'high'
  /** Animation speed */
  speed?: 'slow' | 'normal' | 'fast'
}

// ============ Main Component ============

export function UnifiedBackground({
  className,
  mode = 'ambient',
  enabled = true,
  interfaceType = 'chat',
  immersive = false,
  density = 'medium',
  speed = 'normal',
}: UnifiedBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const animationRef = useRef<number>()
  const stateRef = useRef<any>(null)
  const resizeTimeoutRef = useRef<number>()
  const lastFrameTimeRef = useRef(0)
  const themeColorsRef = useRef<string[]>([])
  const modeRef = useRef(mode)

  const isLowPerf = useMemo(() => isLowPerformanceDevice(), [])
  const densityCfg = isLowPerf ? lowPerformanceDensityConfig : densityConfig
  const count = densityCfg[density].particles
  const speedFactor = speedConfig[speed]
  const targetFrameInterval = isLowPerf ? 33.33 : 16.67

  // Detect prefers-reduced-motion
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mql.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // Tab visibility
  useEffect(() => {
    const handleVisibilityChange = () => setIsTabVisible(!document.hidden)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // IntersectionObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0 })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Sync theme colors
  useEffect(() => {
    const updateColors = () => { themeColorsRef.current = getThemeColors() }
    updateColors()
    const observer = new MutationObserver(updateColors)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => observer.disconnect()
  }, [])

  // Canvas particle animation loop (particle mode only)
  useEffect(() => {
    if (mode !== 'particles' || !enabled || !isVisible || !isTabVisible || prefersReducedMotion) return

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const handleResize = () => {
      if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current)
      resizeTimeoutRef.current = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect()
        const dpr = Math.min(window.devicePixelRatio, 2)
        width = rect.width
        height = rect.height
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        stateRef.current = initParticles(count, width, height, speedFactor, themeColorsRef.current)
      })
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    const startTime = performance.now()

    const animate = (timestamp: number) => {
      const elapsed = timestamp - lastFrameTimeRef.current
      if (elapsed < targetFrameInterval) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      lastFrameTimeRef.current = timestamp - (elapsed % targetFrameInterval)
      const time = timestamp - startTime
      drawParticles(ctx, stateRef.current, width, height, time)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current)
    }
  }, [mode, enabled, isVisible, isTabVisible, prefersReducedMotion, count, speedFactor, targetFrameInterval])

  // Re-init when mode changes
  useEffect(() => {
    modeRef.current = mode
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    if (mode === 'particles') {
      stateRef.current = initParticles(count, rect.width, rect.height, speedFactor, themeColorsRef.current)
    }
  }, [mode, count, speedFactor])

  // Compute opacity — must be before any conditionals (Rules of Hooks)
  const containerOpacity = useMemo(() => {
    if (immersive) return 0.3
    return 1
  }, [immersive])

  // Pre-compute ambient orbs — must be before any conditionals (Rules of Hooks)
  const ambientOrbs = useMemo(() => getAmbientOrbs(interfaceType), [interfaceType])

  // CSS-only fallback for reduced motion or minimal/none modes
  if (prefersReducedMotion || mode === 'minimal' || mode === 'none') {
    if (mode === 'none') {
      return <div ref={containerRef} className={className} aria-hidden="true" />
    }
    return <CSSOnlyBackground interfaceType={interfaceType} className={className} immersive={immersive} />
  }

  // Ink wash mode
  if (mode === 'ink-wash') {
    return <InkWashBackground className={className} immersive={immersive} />
  }

  // Noise texture mode
  if (mode === 'noise') {
    return <NoiseBackground className={className} immersive={immersive} />
  }

  if (!enabled) {
    return <div ref={containerRef} className={className} aria-hidden="true" />
  }

  // Ambient mode: CSS glow orbs
  if (mode === 'ambient') {
    return (
      <div
        ref={containerRef}
        className={cn('fixed inset-0 pointer-events-none overflow-hidden', className)}
        aria-hidden="true"
        style={{ opacity: containerOpacity, zIndex: 0 }}
      >
        {ambientOrbs.map((orb) => (
          <div
            key={orb.id}
            className="absolute rounded-full"
            style={{
              width: `${orb.size}rem`,
              height: `${orb.size}rem`,
              top: orb.id === 1 || orb.id === 4 ? undefined : orb.top === 'auto' ? undefined : orb.top,
              bottom: orb.id === 1 || orb.id === 4 ? '-10%' : undefined,
              left: orb.id === 0 ? '-8%' : orb.id === 3 ? '-3%' : orb.left === 'auto' ? undefined : orb.left,
              right: orb.id === 0 ? '-8%' : orb.id === 4 ? '-2%' : undefined,
              transform: orb.left === '50%' ? 'translate(-50%, -50%)' : undefined,
              background: `radial-gradient(circle, color-mix(in srgb, var(${orb.colorVar}) ${orb.opacity * 100}%, transparent) 0%, transparent 70%)`,
              filter: `blur(${orb.blur}px)`,
              animation: prefersReducedMotion ? 'none' : `ambient-orb-float ${orb.duration}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite ${orb.reverse ? 'reverse' : ''}`,
              animationDelay: prefersReducedMotion ? '0s' : `-${orb.delay}s`,
            }}
          />
        ))}
      </div>
    )
  }

  // Particle mode: Canvas renderer
  return (
    <div
      ref={containerRef}
      className={cn('fixed inset-0 pointer-events-none overflow-hidden', className)}
      aria-hidden="true"
      style={{ opacity: containerOpacity, zIndex: 0 }}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ willChange: 'transform' }}
      />
    </div>
  )
}

/**
 * Background mode mapping per interface type
 */
export function getBackgroundModeForInterface(interfaceType: string): UnifiedBackgroundMode {
  switch (interfaceType) {
    case 'chat':
      return 'ambient'
    case 'settings':
      return 'particles'
    case 'writing':
      return 'ink-wash'
    default:
      return 'ambient'
  }
}

/**
 * Background density mapping per interface
 */
export function getBackgroundDensity(interfaceType: string): 'low' | 'medium' | 'high' {
  switch (interfaceType) {
    case 'chat':
      return 'medium'
    case 'settings':
      return 'medium'
    case 'writing':
      return 'low'
    default:
      return 'medium'
  }
}

/**
 * Background speed mapping per interface
 */
export function getBackgroundSpeed(interfaceType: string): 'slow' | 'normal' | 'fast' {
  switch (interfaceType) {
    case 'chat':
      return 'normal'
    case 'settings':
      return 'slow'
    case 'writing':
      return 'slow'
    default:
      return 'normal'
  }
}
