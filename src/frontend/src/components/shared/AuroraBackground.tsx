/**
 * AuroraBackground - 极光背景效果
 *
 * 模拟柔和极光的流动光带
 * 极低透明度，纯装饰性背景
 * 适合设定编辑器等需要氛围但不干扰阅读的界面
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'

export interface AuroraBackgroundProps {
  className?: string
  enabled?: boolean
  /** 极光色彩主题 */
  palette?: 'northern' | 'warm' | 'cool' | 'subtle'
  /** 流动速度 */
  speed?: 'slow' | 'normal' | 'fast'
}

interface AuroraBand {
  y: number
  amplitude: number
  frequency: number
  speed: number
  phase: number
  opacity: number
  colorStops: { offset: number; color: string }[]
  hueShift: number
  verticalSpeed: number
}

interface AuroraVeil {
  x: number
  y: number
  width: number
  height: number
  opacity: number
  hue: number
  drift: number
}

const paletteConfig = {
  northern: [
    { offset: 0, color: 'rgba(94, 106, 210, 0.04)' },
    { offset: 0.3, color: 'rgba(94, 181, 166, 0.035)' },
    { offset: 0.6, color: 'rgba(232, 184, 125, 0.025)' },
    { offset: 1, color: 'rgba(94, 106, 210, 0.02)' },
  ],
  warm: [
    { offset: 0, color: 'rgba(232, 184, 125, 0.035)' },
    { offset: 0.4, color: 'rgba(196, 92, 92, 0.025)' },
    { offset: 0.7, color: 'rgba(212, 93, 93, 0.02)' },
    { offset: 1, color: 'rgba(232, 184, 125, 0.015)' },
  ],
  cool: [
    { offset: 0, color: 'rgba(94, 106, 210, 0.035)' },
    { offset: 0.35, color: 'rgba(91, 142, 232, 0.03)' },
    { offset: 0.7, color: 'rgba(94, 181, 166, 0.025)' },
    { offset: 1, color: 'rgba(94, 106, 210, 0.015)' },
  ],
  subtle: [
    { offset: 0, color: 'rgba(94, 106, 210, 0.02)' },
    { offset: 0.5, color: 'rgba(94, 181, 166, 0.015)' },
    { offset: 1, color: 'rgba(232, 184, 125, 0.01)' },
  ],
}

const speedConfig = {
  slow: 0.4,
  normal: 0.7,
  fast: 1.2,
}

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function isLowPerformanceDevice(): boolean {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
  const isSmallScreen = window.innerWidth < 768
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  return isMobile || isSmallScreen || prefersReducedMotion
}

function initBands(_width: number, height: number, speed: number, palette: typeof paletteConfig.northern): AuroraBand[] {
  const rand = seededRandom(888)
  const bands: AuroraBand[] = []
  const bandCount = 4

  for (let i = 0; i < bandCount; i++) {
    bands.push({
      y: height * (0.1 + i * 0.25),
      amplitude: 40 + rand() * 60,
      frequency: 0.0008 + rand() * 0.002,
      speed: (0.00015 + rand() * 0.0003) * speed,
      phase: rand() * Math.PI * 2,
      opacity: 0.3 + rand() * 0.4,
      colorStops: palette,
      hueShift: rand() * 20 - 10,
      verticalSpeed: (rand() - 0.5) * 0.03,
    })
  }

  return bands
}

function initVeils(count: number, width: number, height: number): AuroraVeil[] {
  const rand = seededRandom(999)
  const veils: AuroraVeil[] = []

  for (let i = 0; i < count; i++) {
    veils.push({
      x: rand() * width,
      y: height * (0.2 + rand() * 0.6),
      width: width * (0.3 + rand() * 0.5),
      height: height * (0.15 + rand() * 0.25),
      opacity: 0.02 + rand() * 0.03,
      hue: 180 + rand() * 40, // cyan to blue range
      drift: (rand() - 0.5) * 0.1,
    })
  }

  return veils
}

export function AuroraBackground({
  className,
  enabled = true,
  palette = 'subtle',
  speed = 'slow',
}: AuroraBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const bandsRef = useRef<AuroraBand[]>([])
  const animationRef = useRef<number>()
  const reducedMotionRef = useRef(false)
  const resizeTimeoutRef = useRef<number>()
  const lastFrameTimeRef = useRef(0)

  const isLowPerf = useMemo(() => isLowPerformanceDevice(), [])
  const speedFactor = speedConfig[speed]
  const colorStops = paletteConfig[palette]
  const veilsRef = useRef<AuroraVeil[]>([])

  // 18fps for aurora - smooth but efficient
  const targetFrameInterval = isLowPerf ? 55 : 36

  const initBandsCallback = useCallback(
    (width: number, height: number) => {
      return initBands(width, height, speedFactor, colorStops)
    },
    [speedFactor, colorStops]
  )

  useEffect(() => {
    if (!enabled || !isVisible) return

    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = mql.matches
    if (mql.matches) return

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let width = 0
    let height = 0

    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        cancelAnimationFrame(resizeTimeoutRef.current)
      }
      resizeTimeoutRef.current = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect()
        const dpr = Math.min(window.devicePixelRatio, 1.5)
        width = rect.width
        height = rect.height
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        bandsRef.current = initBandsCallback(width, height)
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
      ctx.clearRect(0, 0, width, height)

      // Draw soft background veil layer
      if (veilsRef.current.length === 0) {
        veilsRef.current = initVeils(2, width, height)
      }

      veilsRef.current.forEach((veil) => {
        veil.x += veil.drift
        if (veil.x > width + veil.width) veil.x = -veil.width
        if (veil.x < -veil.width) veil.x = width + veil.width

        const veilGradient = ctx.createRadialGradient(
          veil.x + veil.width / 2, veil.y, 0,
          veil.x + veil.width / 2, veil.y, veil.width / 2
        )
        const veilPulse = Math.sin(time * 0.0002 + veil.hue) * 0.3 + 0.7
        veilGradient.addColorStop(0, `hsla(${veil.hue}, 60%, 70%, ${veil.opacity * veilPulse})`)
        veilGradient.addColorStop(0.5, `hsla(${veil.hue + 20}, 50%, 60%, ${veil.opacity * veilPulse * 0.5})`)
        veilGradient.addColorStop(1, 'transparent')

        ctx.fillStyle = veilGradient
        ctx.fillRect(veil.x, veil.y - veil.height / 2, veil.width, veil.height)
      })

      const bands = bandsRef.current

      bands.forEach((band) => {
        // Vertical drift for organic feel
        band.y += band.verticalSpeed
        if (band.y < height * 0.08) band.y = height * 0.08
        if (band.y > height * 0.85) band.y = height * 0.85

        // Create gradient for this band
        const gradient = ctx.createLinearGradient(0, 0, width, 0)
        band.colorStops.forEach((stop) => {
          gradient.addColorStop(stop.offset, stop.color)
        })

        // Draw flowing aurora band with multiple waves
        ctx.beginPath()
        ctx.moveTo(0, band.y)

        for (let x = 0; x <= width; x += 3) {
          const wave1 = Math.sin(x * band.frequency + time * band.speed + band.phase) * band.amplitude
          const wave2 = Math.sin(x * band.frequency * 2.1 + time * band.speed * 1.3 + band.phase + 1) * band.amplitude * 0.35
          const wave3 = Math.sin(x * band.frequency * 0.5 + time * band.speed * 0.7 + band.phase + 2) * band.amplitude * 0.2
          const y = band.y + wave1 + wave2 + wave3
          ctx.lineTo(x, y)
        }

        // Close the shape for fill
        ctx.lineTo(width, band.y + band.amplitude * 3.5)
        ctx.lineTo(0, band.y + band.amplitude * 3.5)
        ctx.closePath()

        ctx.fillStyle = gradient
        ctx.globalAlpha = band.opacity * 0.45
        ctx.fill()
        ctx.globalAlpha = 1

        // Draw upper glow with softer falloff
        ctx.beginPath()
        ctx.moveTo(0, band.y)

        for (let x = 0; x <= width; x += 3) {
          const wave1 = Math.sin(x * band.frequency + time * band.speed + band.phase) * band.amplitude
          const wave2 = Math.sin(x * band.frequency * 2.1 + time * band.speed * 1.3 + band.phase + 1) * band.amplitude * 0.35
          const y = band.y + wave1 + wave2
          ctx.lineTo(x, y)
        }

        ctx.lineTo(width, band.y - band.amplitude * 2.5)
        ctx.lineTo(0, band.y - band.amplitude * 2.5)
        ctx.closePath()

        const upperGradient = ctx.createLinearGradient(0, band.y - band.amplitude * 2.5, 0, band.y)
        upperGradient.addColorStop(0, 'transparent')
        upperGradient.addColorStop(0.5, band.colorStops[0].color.replace(/[\d.]+\)$/, '0.01)'))
        upperGradient.addColorStop(1, band.colorStops[0].color.replace(/[\d.]+\)$/, '0.02)'))

        ctx.fillStyle = upperGradient
        ctx.fill()

        // Add shimmer highlights
        for (let x = 0; x <= width; x += 60) {
          const shimmer = Math.sin(time * 0.002 + x * 0.01 + band.phase) * 0.5 + 0.5
          if (shimmer > 0.85) {
            const waveY = band.y + Math.sin(x * band.frequency + time * band.speed + band.phase) * band.amplitude
            const shimmerGlow = ctx.createRadialGradient(x, waveY, 0, x, waveY, 15)
            shimmerGlow.addColorStop(0, `hsla(${200 + band.hueShift}, 70%, 85%, ${(shimmer - 0.85) * 0.1})`)
            shimmerGlow.addColorStop(1, 'transparent')
            ctx.beginPath()
            ctx.arc(x, waveY, 15, 0, Math.PI * 2)
            ctx.fillStyle = shimmerGlow
            ctx.fill()
          }
        }
      })

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current)
    }
  }, [enabled, isVisible, initBandsCallback, targetFrameInterval])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0 }
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  if (!enabled) {
    return <div ref={containerRef} className={className} aria-hidden="true" />
  }

  return (
    <div
      ref={containerRef}
      className={cn('absolute inset-0 overflow-hidden pointer-events-none', className)}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.7 }}
      />
    </div>
  )
}
