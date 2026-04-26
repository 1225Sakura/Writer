/**
 * InkFlowBackground - 墨流背景效果
 *
 * 模拟水墨在水中流动的视觉效果
 * 使用 Canvas 渲染，低透明度确保不干扰内容阅读
 * 适合写作界面的沉浸式背景
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'

export interface InkFlowBackgroundProps {
  className?: string
  enabled?: boolean
  /** 墨流密度 */
  density?: 'low' | 'medium' | 'high'
  /** 流动速度 */
  speed?: 'slow' | 'normal' | 'fast'
  /** 主色调 */
  color?: 'ink' | 'warm' | 'cool' | 'mixed'
}

interface InkBlob {
  x: number
  y: number
  radius: number
  maxRadius: number
  vx: number
  vy: number
  opacity: number
  baseOpacity: number
  phase: number
  color: string
  growthSpeed: number
  maxGrowth: number
  pulsePhase: number
  edgeVariation: number[]
}

const densityConfig = {
  low: 3,
  medium: 5,
  high: 8,
}

const speedConfig = {
  slow: 0.3,
  normal: 0.6,
  fast: 1.0,
}

const colorPalettes = {
  ink: ['rgba(26, 26, 46, 0.04)', 'rgba(45, 45, 65, 0.03)', 'rgba(60, 60, 80, 0.025)'],
  warm: ['rgba(196, 92, 92, 0.025)', 'rgba(232, 184, 125, 0.02)', 'rgba(212, 93, 93, 0.02)'],
  cool: ['rgba(94, 106, 210, 0.025)', 'rgba(91, 142, 232, 0.02)', 'rgba(94, 181, 166, 0.02)'],
  mixed: [
    'rgba(94, 106, 210, 0.02)',
    'rgba(232, 184, 125, 0.018)',
    'rgba(94, 181, 166, 0.018)',
    'rgba(196, 92, 92, 0.015)',
  ],
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
        const isHighPerformance = highPerformanceGPUs.some(gpu => renderer.includes(gpu))
        isLowGPU = !isHighPerformance && renderer.length > 0
      }
    }
  } catch {
    isLowGPU = true
  }
  return isMobile || isSmallScreen || prefersReducedMotion || isLowMemory || isLowGPU
}

function initBlobs(count: number, width: number, height: number, speed: number, colors: string[]): InkBlob[] {
  const rand = seededRandom(777)
  const blobs: InkBlob[] = []

  for (let i = 0; i < count; i++) {
    const baseRadius = 80 + rand() * 200
    const maxRadius = baseRadius * (1.2 + rand() * 0.8)
    const edgeCount = 6 + Math.floor(rand() * 8)
    const edgeVariation: number[] = []
    for (let e = 0; e < edgeCount; e++) {
      edgeVariation.push(0.7 + rand() * 0.5)
    }
    blobs.push({
      x: rand() * width,
      y: rand() * height,
      radius: baseRadius,
      maxRadius,
      vx: (rand() - 0.5) * 0.15 * speed,
      vy: (rand() - 0.5) * 0.1 * speed,
      opacity: 0.3 + rand() * 0.5,
      baseOpacity: 0.3 + rand() * 0.5,
      phase: rand() * Math.PI * 2,
      color: colors[Math.floor(rand() * colors.length)],
      growthSpeed: 0.0001 + rand() * 0.0002,
      maxGrowth: 0.15 + rand() * 0.2,
      pulsePhase: rand() * Math.PI * 2,
      edgeVariation,
    })
  }

  return blobs
}

export function InkFlowBackground({
  className,
  enabled = true,
  density = 'medium',
  speed = 'slow',
  color = 'ink',
}: InkFlowBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const blobsRef = useRef<InkBlob[]>([])
  const animationRef = useRef<number>()
  const reducedMotionRef = useRef(false)
  const resizeTimeoutRef = useRef<number>()
  const lastFrameTimeRef = useRef(0)

  const isLowPerf = useMemo(() => isLowPerformanceDevice(), [])
  const blobCount = isLowPerf ? Math.floor(densityConfig[density] * 0.5) : densityConfig[density]
  const speedFactor = speedConfig[speed]
  const colors = colorPalettes[color]

  // FPS cap: 24fps for ink flow (slower is more natural)
  const targetFrameInterval = isLowPerf ? 41.67 : 33.33

  const initBlobsCallback = useCallback(
    (width: number, height: number) => {
      return initBlobs(blobCount, width, height, speedFactor, colors)
    },
    [blobCount, speedFactor, colors]
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
        blobsRef.current = initBlobsCallback(width, height)
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

      const blobs = blobsRef.current

      blobs.forEach((blob) => {
        // Gentle drift
        blob.x += blob.vx
        blob.y += blob.vy

        // Wrap around edges
        if (blob.x < -blob.maxRadius) blob.x = width + blob.maxRadius
        if (blob.x > width + blob.maxRadius) blob.x = -blob.maxRadius
        if (blob.y < -blob.maxRadius) blob.y = height + blob.maxRadius
        if (blob.y > height + blob.maxRadius) blob.y = -blob.maxRadius

        // Breathing effect with pulsing
        const breath = Math.sin(time * 0.0002 + blob.phase) * 0.15 + 1
        const pulse = Math.sin(time * 0.0005 + blob.pulsePhase) * 0.05 + 1
        const currentRadius = blob.radius * breath * pulse

        // Growth cycle for organic feel
        const growthCycle = (Math.sin(time * blob.growthSpeed + blob.phase * 2) + 1) * 0.5
        const expandedRadius = currentRadius * (1 + blob.maxGrowth * growthCycle)

        // Draw soft ink blob with layered gradients for depth
        const gradient = ctx.createRadialGradient(
          blob.x, blob.y, 0,
          blob.x, blob.y, expandedRadius
        )

        const baseOpacity = blob.baseOpacity * 0.6
        gradient.addColorStop(0, blob.color.replace(/[\d.]+\)$/, `${baseOpacity})`))
        gradient.addColorStop(0.25, blob.color.replace(/[\d.]+\)$/, `${baseOpacity * 0.7})`))
        gradient.addColorStop(0.5, blob.color.replace(/[\d.]+\)$/, `${baseOpacity * 0.4})`))
        gradient.addColorStop(0.75, blob.color.replace(/[\d.]+\)$/, `${baseOpacity * 0.15})`))
        gradient.addColorStop(1, 'transparent')

        ctx.beginPath()
        ctx.arc(blob.x, blob.y, expandedRadius, 0, Math.PI * 2)
        ctx.fillStyle = gradient
        ctx.fill()

        // Draw irregular ink edges for organic water-ink feel
        const edgeCount = blob.edgeVariation.length
        ctx.beginPath()
        for (let i = 0; i <= edgeCount; i++) {
          const idx = i % edgeCount
          const angle = (i / edgeCount) * Math.PI * 2
          const edgeVar = blob.edgeVariation[idx]
          const waveOffset = Math.sin(angle * 3 + time * 0.0003 + blob.phase) * 0.15 + 1
          const edgeRadius = expandedRadius * edgeVar * waveOffset
          const ex = blob.x + Math.cos(angle) * edgeRadius
          const ey = blob.y + Math.sin(angle) * edgeRadius
          if (i === 0) {
            ctx.moveTo(ex, ey)
          } else {
            ctx.lineTo(ex, ey)
          }
        }
        ctx.closePath()
        const edgeGradient = ctx.createRadialGradient(
          blob.x, blob.y, expandedRadius * 0.5,
          blob.x, blob.y, expandedRadius * 1.2
        )
        edgeGradient.addColorStop(0, 'transparent')
        edgeGradient.addColorStop(0.6, blob.color.replace(/[\d.]+\)$/, `${baseOpacity * 0.1})`))
        edgeGradient.addColorStop(1, 'transparent')
        ctx.fillStyle = edgeGradient
        ctx.fill()

        // Add subtle inner highlight for depth
        const highlightGradient = ctx.createRadialGradient(
          blob.x - expandedRadius * 0.2, blob.y - expandedRadius * 0.2, 0,
          blob.x, blob.y, expandedRadius * 0.5
        )
        highlightGradient.addColorStop(0, blob.color.replace(/[\d.]+\)$/, `${baseOpacity * 0.15})`))
        highlightGradient.addColorStop(1, 'transparent')
        ctx.beginPath()
        ctx.arc(blob.x, blob.y, expandedRadius * 0.5, 0, Math.PI * 2)
        ctx.fillStyle = highlightGradient
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
  }, [enabled, isVisible, initBlobsCallback, targetFrameInterval])

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
        style={{ opacity: 0.6 }}
      />
    </div>
  )
}
