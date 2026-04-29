/**
 * UnifiedBackground - Single background component replacing all legacy background components
 *
 * Modes:
 * - 'ambient': Subtle CSS gradient glow orbs
 * - 'particles': Canvas particle system with connections
 * - 'ink-wash': Soft ink wash gradient with subtle color accents (default for writing)
 * - 'noise': Subtle noise texture overlay with gradient accents
 * - 'minimal': Static CSS gradient only, no animation
 * - 'none': Transparent, no background effect
 *
 * Performance optimizations preserved:
 * - FPS throttling (30fps cap for low-end devices)
 * - DPR limiting (max 2x)
 * - Tab visibility pause
 * - IntersectionObserver pause
 * - prefers-reduced-motion CSS fallback
 * - Low-performance device auto-detection
 */

import { useEffect, useRef, useState, useMemo } from 'react'
import { cn } from '@/lib/utils'

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

// ============ Performance Detection ============

function isLowPerformanceDevice(): boolean {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  const isSmallScreen = window.innerWidth < 768
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // @ts-ignore
  const isLowMemory = navigator.deviceMemory !== undefined && navigator.deviceMemory < 4
  let isLowGPU = false
  try {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl')
    if (gl && gl instanceof WebGLRenderingContext) {
      const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
      if (debugInfo) {
        const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || ''
        const highPerformanceGPUs = ['NVIDIA', 'AMD', 'Apple M', 'Radeon', 'GeForce', 'RTX', 'GTX']
        isLowGPU = !highPerformanceGPUs.some(gpu => renderer.includes(gpu)) && renderer.length > 0
      }
    }
  } catch {
    isLowGPU = true
  }
  return isMobile || isSmallScreen || prefersReducedMotion || isLowMemory || isLowGPU
}

// ============ Theme Colors ============

function getThemeColors(): string[] {
  const root = getComputedStyle(document.documentElement)
  return [
    root.getPropertyValue('--accent-100').trim() || '#5e6ad2',
    root.getPropertyValue('--color-character').trim() || '#e8b87d',
    root.getPropertyValue('--color-location').trim() || '#5eb5a6',
    root.getPropertyValue('--color-item').trim() || '#9b7ed9',
    root.getPropertyValue('--vermillion-100').trim() || '#c45c5c',
  ]
}

function hexToRgba(hex: string, alpha: number): string {
  if (hex.startsWith('rgb') || hex.startsWith('rgba')) {
    return hex.replace(/rgba?\(([^)]+)\)/, `rgba($1, ${alpha})`).replace(/,\s*[^,]+\)$/, `, ${alpha})`)
  }
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

// ============ Seeded Random ============

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ============ Particle Mode ============

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  opacity: number
  pulsePhase: number
}

function initParticles(count: number, width: number, height: number, speed: number, colors: string[]): Particle[] {
  const rand = seededRandom(123)
  const particles: Particle[] = []
  for (let i = 0; i < count; i++) {
    particles.push({
      x: rand() * width,
      y: rand() * height,
      vx: (rand() - 0.5) * 0.3 * speed,
      vy: (rand() - 0.5) * 0.3 * speed,
      size: 1.5 + rand() * 2,
      color: colors[Math.floor(rand() * colors.length)],
      opacity: 0.04 + rand() * 0.08,
      pulsePhase: rand() * Math.PI * 2,
    })
  }
  return particles
}

function drawParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  width: number,
  height: number,
  time: number
) {
  ctx.clearRect(0, 0, width, height)
  particles.forEach((p) => {
    p.x += p.vx
    p.y += p.vy
    if (p.x < 0) p.x = width
    if (p.x > width) p.x = 0
    if (p.y < 0) p.y = height
    if (p.y > height) p.y = 0

    const pulse = Math.sin(time * 0.001 + p.pulsePhase) * 0.3 + 0.7
    const currentOpacity = p.opacity * pulse

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fillStyle = hexToRgba(p.color, currentOpacity)
    ctx.fill()
  })

  const connectionDist = 80
  const maxConnections = 20
  let connectionCount = 0
  for (let i = 0; i < particles.length && connectionCount < maxConnections; i++) {
    for (let j = i + 1; j < particles.length && connectionCount < maxConnections; j++) {
      const dx = particles[i].x - particles[j].x
      const dy = particles[i].y - particles[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < connectionDist) {
        const opacity = (1 - dist / connectionDist) * 0.012
        ctx.beginPath()
        ctx.moveTo(particles[i].x, particles[i].y)
        ctx.lineTo(particles[j].x, particles[j].y)
        ctx.strokeStyle = hexToRgba(particles[i].color, opacity)
        ctx.lineWidth = 0.3
        ctx.stroke()
        connectionCount++
      }
    }
  }
}

// ============ Ambient Mode (CSS-only glow orbs) ============

interface AmbientOrbConfig {
  id: number
  size: number
  top: string
  left: string
  colorVar: string
  opacity: number
  blur: number
  duration: number
  delay: number
  reverse: boolean
}

function getAmbientOrbs(interfaceType: string): AmbientOrbConfig[] {
  const colorMap: Record<string, string[]> = {
    chat: ['--accent-primary', '--color-character', '--accent-primary'],
    settings: ['--accent-primary', '--color-location', '--color-outline'],
    writing: ['--color-character', '--color-outline', '--accent-primary', '--color-ifline', '--color-item'],
  }
  const colors = colorMap[interfaceType] || colorMap.chat
  const configs: AmbientOrbConfig[] = []
  const positions = [
    { top: '-12%', left: '-8%', size: 28, opacity: 0.05, blur: 70, duration: 18, delay: 0 },
    { top: 'auto', left: '-5%', size: 22, opacity: 0.04, blur: 80, duration: 22, delay: 3 },
    { top: '45%', left: '50%', size: 20, opacity: 0.025, blur: 90, duration: 20, delay: 6 },
    { top: '10%', left: '-3%', size: 14, opacity: 0.025, blur: 60, duration: 15, delay: 3 },
    { top: 'auto', left: 'auto', size: 12, opacity: 0.025, blur: 60, duration: 17, delay: 8 },
  ]
  const bottomPositions = [1, 4]
  const rightPositions = [0, 3, 4]

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
    const style: React.CSSProperties = {}
    if (bottomPositions.includes(i)) style.bottom = '-10%'
    else if (pos.top !== 'auto') style.top = pos.top
    if (rightPositions.includes(i)) style.right = i === 0 ? '-8%' : i === 4 ? '-2%' : '-3%'
    else if (pos.left !== 'auto') style.left = pos.left
    if (pos.left === '50%') style.transform = 'translate(-50%, -50%)'

    configs.push({
      id: i,
      size: pos.size,
      top: pos.top,
      left: pos.left,
      colorVar: colors[i % colors.length],
      opacity: pos.opacity,
      blur: pos.blur,
      duration: pos.duration,
      delay: pos.delay,
      reverse: i % 2 === 1,
    })
  }
  return configs
}

// ============ Density / Speed Config ============

const densityConfig = {
  low: { particles: 6 },
  medium: { particles: 10 },
  high: { particles: 15 },
}

const lowPerformanceDensityConfig = {
  low: { particles: 4 },
  medium: { particles: 6 },
  high: { particles: 10 },
}

const speedConfig = {
  slow: 0.3,
  normal: 0.6,
  fast: 1.2,
}

// ============ CSS-Only Fallback Background ============

function CSSOnlyBackground({
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

function InkWashBackground({
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

function NoiseBackground({
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
