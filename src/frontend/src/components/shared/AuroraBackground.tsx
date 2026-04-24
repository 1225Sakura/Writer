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
  const bandCount = 3

  for (let i = 0; i < bandCount; i++) {
    bands.push({
      y: height * (0.15 + i * 0.35),
      amplitude: 30 + rand() * 50,
      frequency: 0.001 + rand() * 0.002,
      speed: (0.0002 + rand() * 0.0003) * speed,
      phase: rand() * Math.PI * 2,
      opacity: 0.4 + rand() * 0.3,
      colorStops: palette,
    })
  }

  return bands
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

  // 20fps for aurora - smooth but efficient
  const targetFrameInterval = isLowPerf ? 50 : 33.33

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

      const bands = bandsRef.current

      bands.forEach((band) => {
        // Create gradient for this band
        const gradient = ctx.createLinearGradient(0, 0, width, 0)
        band.colorStops.forEach((stop) => {
          gradient.addColorStop(stop.offset, stop.color)
        })

        // Draw flowing aurora band
        ctx.beginPath()
        ctx.moveTo(0, band.y)

        for (let x = 0; x <= width; x += 4) {
          const wave1 = Math.sin(x * band.frequency + time * band.speed + band.phase) * band.amplitude
          const wave2 = Math.sin(x * band.frequency * 2.3 + time * band.speed * 1.5 + band.phase + 1) * band.amplitude * 0.3
          const y = band.y + wave1 + wave2
          ctx.lineTo(x, y)
        }

        // Close the shape for fill
        ctx.lineTo(width, band.y + band.amplitude * 3)
        ctx.lineTo(0, band.y + band.amplitude * 3)
        ctx.closePath()

        ctx.fillStyle = gradient
        ctx.globalAlpha = band.opacity * 0.5
        ctx.fill()
        ctx.globalAlpha = 1

        // Draw upper glow
        ctx.beginPath()
        ctx.moveTo(0, band.y)

        for (let x = 0; x <= width; x += 4) {
          const wave1 = Math.sin(x * band.frequency + time * band.speed + band.phase) * band.amplitude
          const wave2 = Math.sin(x * band.frequency * 2.3 + time * band.speed * 1.5 + band.phase + 1) * band.amplitude * 0.3
          const y = band.y + wave1 + wave2
          ctx.lineTo(x, y)
        }

        ctx.lineTo(width, band.y - band.amplitude * 2)
        ctx.lineTo(0, band.y - band.amplitude * 2)
        ctx.closePath()

        const upperGradient = ctx.createLinearGradient(0, band.y - band.amplitude * 2, 0, band.y)
        upperGradient.addColorStop(0, 'transparent')
        upperGradient.addColorStop(1, band.colorStops[0].color.replace(/[\d.]+\)$/, '0.015)'))

        ctx.fillStyle = upperGradient
        ctx.fill()
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
