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
  width: number
  opacity: number
  life: number
  maxLife: number
  hue: number
}

interface MeteorTrail {
  x: number
  y: number
  size: number
  opacity: number
  decay: number
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
  const trailsRef = useRef<MeteorTrail[]>([])

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

      // Handle shooting stars with improved effects
      if (shootingStars && !isLowPerf) {
        // Spawn new shooting star
        if (Math.random() < shootingRate) {
          const rand = Math.random()
          shootingStarsRef.current.push({
            x: rand * width,
            y: rand * height * 0.3,
            vx: -(3 + Math.random() * 5),
            vy: 2 + Math.random() * 3.5,
            length: 50 + Math.random() * 80,
            width: 1 + Math.random() * 1.5,
            opacity: 0.4 + Math.random() * 0.4,
            life: 0,
            maxLife: 35 + Math.random() * 40,
            hue: 40 + Math.random() * 20, // warm golden hue
          })
        }

        // Update and draw shooting stars with trails
        shootingStarsRef.current = shootingStarsRef.current.filter((ss) => {
          ss.x += ss.vx
          ss.y += ss.vy
          ss.life++

          const lifeRatio = ss.life / ss.maxLife
          const fadeIn = Math.min(lifeRatio * 6, 1)
          const fadeOut = lifeRatio > 0.6 ? 1 - (lifeRatio - 0.6) / 0.4 : 1
          const currentOpacity = ss.opacity * fadeIn * fadeOut

          if (currentOpacity <= 0) return false

          // Add trail particles
          if (ss.life % 2 === 0 && ss.length > 40) {
            const trailCount = Math.floor(ss.length / 15)
            for (let t = 0; t < trailCount; t++) {
              const trailProgress = t / trailCount
              trailsRef.current.push({
                x: ss.x - ss.vx * trailProgress * 3 + (Math.random() - 0.5) * 10,
                y: ss.y - ss.vy * trailProgress * 3 + (Math.random() - 0.5) * 10,
                size: 0.5 + Math.random() * 1.5 * (1 - trailProgress),
                opacity: (0.1 + Math.random() * 0.15) * (1 - trailProgress * 0.7),
                decay: 0.92 + Math.random() * 0.06,
              })
            }
          }

          // Draw main trail with gradient
          const gradient = ctx.createLinearGradient(
            ss.x, ss.y,
            ss.x - ss.vx * ss.length * 0.12, ss.y - ss.vy * ss.length * 0.12
          )
          gradient.addColorStop(0, `hsla(${ss.hue}, 80%, 85%, ${currentOpacity})`)
          gradient.addColorStop(0.3, `hsla(${ss.hue}, 70%, 75%, ${currentOpacity * 0.7})`)
          gradient.addColorStop(1, 'transparent')

          ctx.beginPath()
          ctx.moveTo(ss.x, ss.y)
          ctx.lineTo(
            ss.x - ss.vx * ss.length * 0.12,
            ss.y - ss.vy * ss.length * 0.12
          )
          ctx.strokeStyle = gradient
          ctx.lineWidth = ss.width
          ctx.lineCap = 'round'
          ctx.stroke()

          // Bright head glow
          const headGlow = ctx.createRadialGradient(
            ss.x, ss.y, 0,
            ss.x, ss.y, 8
          )
          headGlow.addColorStop(0, `hsla(${ss.hue}, 90%, 95%, ${currentOpacity * 0.8})`)
          headGlow.addColorStop(0.3, `hsla(${ss.hue}, 80%, 85%, ${currentOpacity * 0.4})`)
          headGlow.addColorStop(1, 'transparent')
          ctx.beginPath()
          ctx.arc(ss.x, ss.y, 8, 0, Math.PI * 2)
          ctx.fillStyle = headGlow
          ctx.fill()

          return true
        })

        // Draw and update trailing particles
        trailsRef.current = trailsRef.current.filter((trail) => {
          trail.opacity *= trail.decay
          trail.size *= 0.98
          if (trail.opacity < 0.005 || trail.size < 0.1) return false
          ctx.beginPath()
          ctx.arc(trail.x, trail.y, trail.size, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(40, 60%, 80%, ${trail.opacity})`
          ctx.fill()
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
