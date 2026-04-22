/**
 * EnhancedParticleBackground - 增强版粒子背景
 *
 * 支持更多粒子形态、交互效果和性能优化
 * 使用 Canvas 而非 CSS 以支持更复杂的动画
 *
 * 设计规范（DESIGN_VISUAL.md）：
 * - 粒子数量：30-50
 * - 粒子大小：2-4px
 * - 移动速度：0.3-0.8px/frame
 * - 透明度：0.1-0.3
 * - 颜色：#5e6ad2, #e8b87d, #5eb5a6
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  opacity: number
  life: number
  maxLife: number
  type: 'circle' | 'dot' | 'sparkle'
}

interface EnhancedParticleBackgroundProps {
  className?: string
  particleCount?: number
  enabled?: boolean
  /** 粒子类型：circle | dot | sparkle | mixed */
  particleType?: 'circle' | 'dot' | 'sparkle' | 'mixed'
  /** 是否启用鼠标交互 */
  mouseInteractive?: boolean
  /** 鼠标影响半径 */
  mouseRadius?: number
  /** 是否显示连线 */
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
 * 设计规范颜色（墨韵色系）
 * - 紫辰 (Accent Purple) #5e6ad2
 * - 琥珀 (Amber) #e8b87d
 * - 翠岚 (Jade) #5eb5a6
 */
const designColors = [
  'rgba(94, 106, 210, 0.6)',   // accent #5e6ad2
  'rgba(232, 184, 125, 0.5)',   // character #e8b87d
  'rgba(94, 181, 166, 0.5)',    // location #5eb5a6
]

const defaultColors = [
  'rgba(94, 106, 210, 0.5)',
  'rgba(155, 126, 217, 0.4)',
  'rgba(232, 184, 125, 0.4)',
  'rgba(126, 183, 74, 0.4)',
]

/**
 * EnhancedParticleBackground - 增强粒子背景
 *
 * 特性：
 * - Canvas 渲染，性能更优
 * - 多种粒子形态
 * - 鼠标交互效果
 * - 粒子间连线
 * - 主题色支持
 */
export function EnhancedParticleBackground({
  className,
  particleCount = 30,
  enabled = true,
  particleType = 'mixed',
  mouseInteractive = true,
  mouseRadius = 120,
  showConnections = true,
  connectionDistance = 150,
  speedFactor = 1,
  useThemeColors = true,
  colors,
}: EnhancedParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const particlesRef = useRef<Particle[]>([])
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const animationRef = useRef<number>()

  // Design spec colors as default palette
  const palette = colors ?? (useThemeColors ? designColors : defaultColors)

  // Initialize particles
  const initParticles = useCallback((width: number, height: number) => {
    const particles: Particle[] = []
    const types: Array<'circle' | 'dot' | 'sparkle'> = ['circle', 'dot', 'sparkle']

    for (let i = 0; i < particleCount; i++) {
      const type = particleType === 'mixed' ? types[i % 3] : particleType as 'circle' | 'dot' | 'sparkle'
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3 * speedFactor,
        vy: (Math.random() - 0.5) * 0.3 * speedFactor,
        size: type === 'sparkle' ? 2 + Math.random() * 3 : 2 + Math.random() * 4,
        color: palette[Math.floor(Math.random() * palette.length)],
        opacity: 0.2 + Math.random() * 0.4,
        life: 0,
        maxLife: 200 + Math.random() * 300,
        type,
      })
    }

    return particles
  }, [particleCount, particleType, palette, speedFactor])

  // Draw particle based on type
  const drawParticle = useCallback((ctx: CanvasRenderingContext2D, p: Particle) => {
    ctx.save()

    if (p.type === 'circle') {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
      ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${p.opacity})`)
      ctx.fill()
    } else if (p.type === 'dot') {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2)
      ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${p.opacity})`)
      ctx.fill()
    } else if (p.type === 'sparkle') {
      // Draw sparkle as a 4-point star
      const spikes = 4
      const outerRadius = p.size
      const innerRadius = p.size * 0.4

      ctx.beginPath()
      for (let i = 0; i < spikes * 2; i++) {
        const radius = i % 2 === 0 ? outerRadius : innerRadius
        const angle = (i * Math.PI) / spikes - Math.PI / 2
        const x = p.x + Math.cos(angle) * radius
        const y = p.y + Math.sin(angle) * radius

        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `${p.opacity})`)
      ctx.fill()

      // Add glow
      ctx.shadowBlur = 8
      ctx.shadowColor = p.color
    }

    ctx.restore()
  }, [])

  // Draw connections between particles
  const drawConnections = useCallback((ctx: CanvasRenderingContext2D, particles: Particle[]) => {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const distance = Math.sqrt(dx * dx + dy * dy)

        if (distance < connectionDistance) {
          const opacity = (1 - distance / connectionDistance) * 0.15
          ctx.beginPath()
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.strokeStyle = `rgba(94, 106, 210, ${opacity})`
          ctx.lineWidth = 0.5
          ctx.stroke()
        }
      }
    }
  }, [connectionDistance])

  // Animation loop
  useEffect(() => {
    if (!enabled || !isVisible) return

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Handle resize
    const handleResize = () => {
      const rect = container.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      particlesRef.current = initParticles(rect.width, rect.height)
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

    // Animation
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const particles = particlesRef.current

      // Update and draw particles
      particles.forEach((p) => {
        // Update life
        p.life++

        // Mouse interaction
        if (mouseInteractive && mouseRef.current.x > 0) {
          const dx = mouseRef.current.x - p.x
          const dy = mouseRef.current.y - p.y
          const dist = Math.sqrt(dx * dx + dy * dy)

          if (dist < mouseRadius) {
            const force = (mouseRadius - dist) / mouseRadius
            const angle = Math.atan2(dy, dx)
            p.vx -= Math.cos(angle) * force * 0.02
            p.vy -= Math.sin(angle) * force * 0.02
          }
        }

        // Update position
        p.x += p.vx * speedFactor
        p.y += p.vy * speedFactor

        // Bounce off edges
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        // Draw
        drawParticle(ctx, p)
      })

      // Draw connections
      if (showConnections) {
        drawConnections(ctx, particles)
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
    }
  }, [enabled, isVisible, mouseInteractive, mouseRadius, showConnections, speedFactor, initParticles, drawParticle, drawConnections])

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
        style={{ opacity: 0.6 }}
      />
    </div>
  )
}

/**
 * FloatingParticle - 浮动单粒子（用于装饰）
 */
export function FloatingParticle({
  size = 4,
  color = 'var(--accent-primary)',
  duration = 6,
  delay = 0,
  className,
}: {
  size?: number
  color?: string
  duration?: number
  delay?: number
  className?: string
}) {
  return (
    <motion.div
      className={cn('absolute rounded-full pointer-events-none', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: color,
        boxShadow: `0 0 ${size * 2}px ${color}`,
      }}
      animate={{
        y: [0, -20, 0],
        x: [0, 10, 0],
        opacity: [0.3, 0.6, 0.3],
        scale: [1, 1.2, 1],
      }}
      transition={{
        duration,
        repeat: Infinity,
        delay,
        ease: 'easeInOut',
      }}
    />
  )
}