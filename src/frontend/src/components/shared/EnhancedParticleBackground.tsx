/**
 * EnhancedParticleBackground - 增强版粒子背景
 *
 * 使用 Canvas 渲染，支持更多粒子形态和性能优化
 * 设计规范（DESIGN_VISUAL.md）：
 * - 粒子数量：20-30（默认20，减少视觉干扰）
 * - 粒子大小：2-3px
 * - 移动速度：0.2-0.5px/frame
 * - 透明度：0.05-0.15
 * - 颜色：#5e6ad2, #e8b87d, #5eb5a6
 *
 * 性能优化：
 * - 低性能设备自动降级（减少粒子数）
 * - 连接线数量限制
 * - 防抖 resize 处理
 * - prefers-reduced-motion 支持
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  opacity: number
}

interface EnhancedParticleBackgroundProps {
  className?: string
  particleCount?: number
  enabled?: boolean
  /** 粒子类型：circle | dot */
  particleType?: 'circle' | 'dot'
  /** 是否启用鼠标交互（默认关闭，减少干扰） */
  mouseInteractive?: boolean
  /** 鼠标影响半径 */
  mouseRadius?: number
  /** 是否显示连线（默认关闭，减少视觉噪音） */
  showConnections?: boolean
  /** 连接线最大距离 */
  connectionDistance?: number
  /** 动画速度因子 */
  speedFactor?: number
  /** 是否使用主题色 */
  useThemeColors?: boolean
  /** 自定义颜色数组 */
  colors?: string[]
}

/**
 * 检测低性能设备
 */
function isLowPerformanceDevice(): boolean {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
  const isSmallScreen = window.innerWidth < 768
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  // @ts-ignore - deviceMemory is not in all browsers
  const isLowMemory = navigator.deviceMemory !== undefined && navigator.deviceMemory < 4

  return isMobile || isSmallScreen || prefersReducedMotion || isLowMemory
}

/**
 * 设计规范颜色（墨韵色系）
 * - 紫辰 (Accent Purple) #5e6ad2
 * - 琥珀 (Amber) #e8b87d
 * - 翠岚 (Jade) #5eb5a6
 */
const designColors = [
  'rgba(94, 106, 210, 0.4)',
  'rgba(232, 184, 125, 0.35)',
  'rgba(94, 181, 166, 0.35)',
]

const defaultColors = [
  'rgba(94, 106, 210, 0.35)',
  'rgba(155, 126, 217, 0.3)',
  'rgba(232, 184, 125, 0.3)',
]

/**
 * EnhancedParticleBackground - 增强粒子背景
 *
 * 特性：
 * - Canvas 渲染，性能更优
 * - 简化粒子形态（仅 circle/dot）
 * - 默认关闭鼠标交互和连线，减少视觉干扰
 * - 主题色支持
 * - 支持 prefers-reduced-motion
 * - 低性能设备自动降级
 */
export function EnhancedParticleBackground({
  className,
  particleCount: propParticleCount,
  enabled = true,
  particleType = 'dot',
  mouseInteractive = false,
  mouseRadius = 100,
  showConnections = false,
  connectionDistance = 120,
  speedFactor = 0.6,
  useThemeColors = true,
  colors,
}: EnhancedParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const animationRef = useRef<number>()
  const reducedMotionRef = useRef(false)
  const resizeTimeoutRef = useRef<number>()

  // 低性能设备自动降级粒子数量
  const isLowPerf = useMemo(() => isLowPerformanceDevice(), [])
  const particleCount = useMemo(() => {
    if (propParticleCount) return propParticleCount
    return isLowPerf ? Math.floor(12) : 20
  }, [propParticleCount, isLowPerf])

  // Design spec colors as default palette
  const palette = colors ?? (useThemeColors ? designColors : defaultColors)

  // Initialize particles
  const initParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = []
    const rand = seededRandom(123)

    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: rand() * width,
        y: rand() * height,
        vx: (rand() - 0.5) * 0.25 * speedFactor,
        vy: (rand() - 0.5) * 0.25 * speedFactor,
        size: particleType === 'dot' ? 1.5 + rand() * 1.5 : 2 + rand() * 2,
        color: palette[Math.floor(rand() * palette.length)],
        opacity: 0.05 + rand() * 0.08,
      })
    }

    return particles
  }, [particleCount, particleType, palette, speedFactor])

  // Animation loop
  useEffect(() => {
    if (!enabled || !isVisible) return

    // Check prefers-reduced-motion
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    reducedMotionRef.current = mql.matches
    if (mql.matches) return

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 防抖 resize 处理
    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        cancelAnimationFrame(resizeTimeoutRef.current)
      }
      resizeTimeoutRef.current = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect()
        const dpr = Math.min(window.devicePixelRatio, 2)
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        particlesRef.current = initParticles(rect.width, rect.height)
      })
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    // Mouse tracking
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
    }

    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
    }

    if (mouseInteractive) {
      container.addEventListener('mousemove', handleMouseMove)
      container.addEventListener('mouseleave', handleMouseLeave)
    }

    // 限制最大连接数
    const maxConnections = 25
    let connectionCount = 0

    // Animation
    const animate = () => {
      const rect = container.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)

      const particles = particlesRef.current

      // Update and draw particles
      particles.forEach((p) => {
        // Mouse interaction
        if (mouseInteractive && mouseRef.current.x > 0) {
          const dx = mouseRef.current.x - p.x
          const dy = mouseRef.current.y - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < mouseRadius) {
            const force = (mouseRadius - dist) / mouseRadius
            const angle = Math.atan2(dy, dx)
            p.vx -= Math.cos(angle) * force * 0.015
            p.vy -= Math.sin(angle) * force * 0.015
          }
        }

        // Update position
        p.x += p.vx
        p.y += p.vy

        // Bounce off edges
        if (p.x < 0 || p.x > rect.width) p.vx *= -1
        if (p.y < 0 || p.y > rect.height) p.vy *= -1

        // Draw
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${p.opacity})`)
        ctx.fill()
      })

      // Draw connections with limit
      if (showConnections && connectionCount < maxConnections) {
        for (let i = 0; i < particles.length && connectionCount < maxConnections; i++) {
          for (let j = i + 1; j < particles.length && connectionCount < maxConnections; j++) {
            const dx = particles[i].x - particles[j].x
            const dy = particles[i].y - particles[j].y
            const distance = Math.sqrt(dx * dx + dy * dy)

            if (distance < connectionDistance) {
              const opacity = (1 - distance / connectionDistance) * 0.05
              ctx.beginPath()
              ctx.moveTo(particles[i].x, particles[i].y)
              ctx.lineTo(particles[j].x, particles[j].y)
              ctx.strokeStyle = `rgba(94, 106, 210, ${opacity})`
              ctx.lineWidth = 0.3
              ctx.stroke()
              connectionCount++
            }
          }
        }
      }

      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (mouseInteractive) {
        container.removeEventListener('mousemove', handleMouseMove)
        container.removeEventListener('mouseleave', handleMouseLeave)
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (resizeTimeoutRef.current) {
        cancelAnimationFrame(resizeTimeoutRef.current)
      }
    }
  }, [enabled, isVisible, mouseInteractive, mouseRadius, showConnections, connectionDistance, initParticles])

  // IntersectionObserver for visibility
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
        style={{ opacity: 0.5 }}
      />
    </div>
  )
}

/**
 * 基于种子生成伪随机数
 */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}
