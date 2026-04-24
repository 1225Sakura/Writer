/**
 * StarfieldBackground - 星空背景效果
 *
 * 静谧的星空效果，带闪烁星光
 * 极低透明度，适合作为写作界面的背景装饰
 * 支持流星效果（可选）
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'

export interface StarfieldBackgroundProps {
  className?: string
  enabled?: boolean
  /** 星星密度 */
  density?: 'low' | 'medium' | 'high'
  /** 是否启用流星 */
  shootingStars?: boolean
  /** 流星频率 */
  shootingStarRate?: 'rare' | 'occasional' | 'frequent'
}

interface Star {
  x: number
  y: number
  size: number
  baseOpacity: number
  twinkleSpeed: number
  twinklePhase: number
  depth: number
}

interface ShootingStar {
  x: number
  y: number
  vx: number
  vy: number
  length: number
  opacity: number
  life: number
  maxLife: number
}

const densityConfig = {
  low: 30,
  medium: 50,
  high: 80,
}

const shootingStarRateConfig = {
  rare: 0.002,
  occasional: 0.005,
  frequent: 0.012,
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

function initStars(count: number, width: number, height: number): Star[] {
  const rand = seededRandom(1111)
  const stars: Star[] = []

  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * width,
      y: rand() * height,
      size: 0.3 + rand() * 1.5,
      baseOpacity: 0.05 + rand() * 0.25,
      twinkleSpeed: 0.2 + rand() * 1.2,
      twinklePhase: rand() * Math.PI * 2,
      depth: 0.2 + rand() * 0.8,
    })
  }

  return stars
}

export function StarfieldBackground({
  className,
  enabled = true,
  density = 'medium',
  shootingStars = false,
  shootingStarRate = 'rare',
}: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const starsRef = useRef<Star[]>([])
  const shootingStarsRef = useRef<ShootingStar[]>([])
  const animationRef = useRef<number>()
  const reducedMotionRef = useRef(false)
  const resizeTimeoutRef = useRef<number>()
  const lastFrameTimeRef = useRef(0)

  const isLowPerf = useMemo(() => isLowPerformanceDevice(), [])
  const starCount = isLowPerf ? Math.floor(densityConfig[density] * 0.4) : densityConfig[density]
  const shootingRate = shootingStarRateConfig[shootingStarRate]

  // 20fps for starfield
  const targetFrameInterval = isLowPerf ? 50 : 33.33

  const initStarsCallback = useCallback(
    (width: number, height: number) => {
      return initStars(starCount, width, height)
    },
    [starCount]
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
        starsRef.current = initStarsCallback(width, height)
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

      // Draw stars
      const stars = starsRef.current
      stars.forEach((star) => {
        const twinkle = Math.sin(time * 0.001 * star.twinkleSpeed + star.twinklePhase) * 0.5 + 0.5
        const currentOpacity = star.baseOpacity * twinkle * star.depth

        // Star glow for larger stars
        if (star.size > 0.8) {
          const glow = ctx.createRadialGradient(
            star.x, star.y, 0,
            star.x, star.y, star.size * 3
          )
          glow.addColorStop(0, `rgba(245, 240, 230, ${currentOpacity * 0.3})`)
          glow.addColorStop(1, 'transparent')
          ctx.beginPath()
          ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2)
          ctx.fillStyle = glow
          ctx.fill()
        }

        // Star body
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(245, 240, 230, ${currentOpacity})`
        ctx.fill()
      })

      // Handle shooting stars
      if (shootingStars && !isLowPerf) {
        // Spawn new shooting star
        if (Math.random() < shootingRate) {
          const rand = Math.random()
          shootingStarsRef.current.push({
            x: rand * width,
            y: rand * height * 0.3,
            vx: -3 - Math.random() * 4,
            vy: 2 + Math.random() * 3,
            length: 40 + Math.random() * 60,
            opacity: 0.3 + Math.random() * 0.3,
            life: 0,
            maxLife: 30 + Math.random() * 30,
          })
        }

        // Update and draw shooting stars
        shootingStarsRef.current = shootingStarsRef.current.filter((ss) => {
          ss.x += ss.vx
          ss.y += ss.vy
          ss.life++

          const lifeRatio = ss.life / ss.maxLife
          const fadeIn = Math.min(lifeRatio * 5, 1)
          const fadeOut = lifeRatio > 0.7 ? 1 - (lifeRatio - 0.7) / 0.3 : 1
          const currentOpacity = ss.opacity * fadeIn * fadeOut

          if (currentOpacity <= 0) return false

          // Draw trail
          const gradient = ctx.createLinearGradient(
            ss.x, ss.y,
            ss.x - ss.vx * ss.length * 0.1, ss.y - ss.vy * ss.length * 0.1
          )
          gradient.addColorStop(0, `rgba(245, 240, 230, ${currentOpacity})`)
          gradient.addColorStop(1, 'transparent')

          ctx.beginPath()
          ctx.moveTo(ss.x, ss.y)
          ctx.lineTo(
            ss.x - ss.vx * ss.length * 0.1,
            ss.y - ss.vy * ss.length * 0.1
          )
          ctx.strokeStyle = gradient
          ctx.lineWidth = 1.5
          ctx.stroke()

          return true
        })
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) cancelAnimationFrame(animationRef.current)
      if (resizeTimeoutRef.current) cancelAnimationFrame(resizeTimeoutRef.current)
    }
  }, [enabled, isVisible, initStarsCallback, targetFrameInterval, shootingStars, shootingRate, isLowPerf])

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
        style={{ opacity: 0.55 }}
      />
    </div>
  )
}
