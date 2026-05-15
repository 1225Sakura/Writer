/**
 * BackgroundHelpers - Utility functions and types for UnifiedBackground
 *
 * Contains: performance detection, color helpers, particle system, ambient orb config, density/speed config.
 */

// ============ Performance Detection ============

export function isLowPerformanceDevice(): boolean {
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

export function getThemeColors(): string[] {
  const root = getComputedStyle(document.documentElement)
  return [
    root.getPropertyValue('--accent-100').trim() || 'var(--accent-100)',
    root.getPropertyValue('--color-character').trim() || 'var(--color-character)',
    root.getPropertyValue('--color-location').trim() || 'var(--color-location)',
    root.getPropertyValue('--color-item').trim() || 'var(--color-item)',
    root.getPropertyValue('--vermillion-100').trim() || 'var(--vermillion-100)',
  ]
}

export function hexToRgba(hex: string, alpha: number): string {
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

export function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

// ============ Particle System ============

export interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  opacity: number
  pulsePhase: number
}

export function initParticles(count: number, width: number, height: number, speed: number, colors: string[]): Particle[] {
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

export function drawParticles(
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

// ============ Ambient Mode Config ============

export interface AmbientOrbConfig {
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

export function getAmbientOrbs(interfaceType: string): AmbientOrbConfig[] {
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
  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]
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

export const densityConfig = {
  low: { particles: 6 },
  medium: { particles: 10 },
  high: { particles: 15 },
}

export const lowPerformanceDensityConfig = {
  low: { particles: 4 },
  medium: { particles: 6 },
  high: { particles: 10 },
}

export const speedConfig = {
  slow: 0.3,
  normal: 0.6,
  fast: 1.2,
}
