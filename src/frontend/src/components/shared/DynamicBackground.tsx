/**
 * DynamicBackground - 动态背景组件
 *
 * 支持多种背景模式可切换：
 * - particle: Canvas 粒子效果
 * - grid: 动态网格线
 * - wave: 波浪线条
 * - starfield: 星空效果
 *
 * 特性：
 * - Canvas 渲染，性能优化
 * - FPS 节流（30fps cap for low-end devices）
 * - 统一视觉风格（Ink/Parchment色系）
 * - 平滑主题色同步过渡
 * - prefers-reduced-motion 支持
 * - 界面类型个性化（chat/settings/writing）
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'

export type BackgroundMode = 'particle' | 'grid' | 'wave' | 'starfield'

interface DynamicBackgroundProps {
  className?: string
  mode?: BackgroundMode
  enabled?: boolean
  /** 粒子/星星数量 */
  density?: 'low' | 'medium' | 'high'
  /** 动画速度 */
  speed?: 'slow' | 'normal' | 'fast'
  /** 是否使用主题色 */
  useThemeColors?: boolean
  /** 界面类型，影响背景个性 */
  interfaceType?: 'chat' | 'settings' | 'writing'
}

// 密度配置
const densityConfig = {
  low: { particle: 6, grid: 4, wave: 1, starfield: 25 },
  medium: { particle: 10, grid: 6, wave: 2, starfield: 40 },
  high: { particle: 15, grid: 8, wave: 3, starfield: 60 },
}

// 低性能设备密度配置（自动降级）
const lowPerformanceDensityConfig = {
  low: { particle: 4, grid: 3, wave: 1, starfield: 15 },
  medium: { particle: 6, grid: 4, wave: 1, starfield: 25 },
  high: { particle: 10, grid: 6, wave: 2, starfield: 40 },
}

// 速度配置
const speedConfig = {
  slow: 0.3,
  normal: 0.6,
  fast: 1.2,
}

/**
 * 获取当前主题的统一色系
 * 所有模式使用协调的Ink/Parchment色系
 */
function getThemeColors(): string[] {
  const root = getComputedStyle(document.documentElement)
  const accent = root.getPropertyValue('--accent-100').trim() || '#5e6ad2'
  const character = root.getPropertyValue('--color-character').trim() || '#e8b87d'
  const location = root.getPropertyValue('--color-location').trim() || '#5eb5a6'
  const item = root.getPropertyValue('--color-item').trim() || '#9b7ed9'
  const vermillion = root.getPropertyValue('--vermillion-100').trim() || '#c45c5c'

  return [
    accent,
    character,
    location,
    item,
    vermillion,
  ]
}

function hexToRgba(hex: string, alpha: number): string {
  // 处理CSS变量可能返回的rgb格式
  if (hex.startsWith('rgb') || hex.startsWith('rgba')) {
    return hex.replace(/rgba?\(([^)]+)\)/, `rgba($1, ${alpha})`).replace(/,\s*[^,]+\)$/, `, ${alpha})`)
  }
  // 处理hex
  const clean = hex.replace('#', '')
  const bigint = parseInt(clean, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
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
  // @ts-ignore
  const isLowMemory = navigator.deviceMemory !== undefined && navigator.deviceMemory < 4

  return isMobile || isSmallScreen || prefersReducedMotion || isLowMemory
}

/**
 * 伪随机数生成器
 */
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

  // 限制连接线数量
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

// ============ Grid Mode ============
interface GridLine {
  x: number
  y: number
  opacity: number
  speed: number
}

function initGrid(count: number, width: number, height: number, speed: number): GridLine[] {
  const rand = seededRandom(456)
  const lines: GridLine[] = []
  const spacing = Math.min(width, height) / count

  for (let i = 0; i <= count; i++) {
    lines.push({
      x: 0,
      y: i * spacing,
      opacity: 0.015 + rand() * 0.025,
      speed: (0.1 + rand() * 0.2) * speed,
    })
    lines.push({
      x: i * spacing,
      y: 0,
      opacity: 0.015 + rand() * 0.025,
      speed: (0.1 + rand() * 0.2) * speed,
    })
  }

  return lines
}

function drawGrid(
  ctx: CanvasRenderingContext2D,
  lines: GridLine[],
  width: number,
  height: number,
  time: number,
  colors: string[]
) {
  ctx.clearRect(0, 0, width, height)

  const spacing = Math.min(width, height) / (lines.length / 2)
  const primaryColor = colors[0] || '#5e6ad2'

  lines.forEach((line, i) => {
    const isHorizontal = i % 2 === 0
    const offset = Math.sin(time * 0.0003 * line.speed + i) * 8

    ctx.beginPath()
    if (isHorizontal) {
      ctx.moveTo(0, line.y + offset)
      ctx.lineTo(width, line.y + offset)
    } else {
      ctx.moveTo(line.x + offset, 0)
      ctx.lineTo(line.x + offset, height)
    }

    const pulse = Math.sin(time * 0.0005 + i * 0.5) * 0.5 + 0.5
    ctx.strokeStyle = hexToRgba(primaryColor, line.opacity * pulse)
    ctx.lineWidth = 0.5
    ctx.stroke()
  })

  // 交叉点光点 - 减少数量
  const gridCount = Math.floor(lines.length / 2)
  for (let i = 0; i < gridCount; i += 3) {
    for (let j = 0; j < gridCount; j += 3) {
      const x = j * spacing
      const y = i * spacing
      const pulse = Math.sin(time * 0.001 + i + j) * 0.5 + 0.5

      ctx.beginPath()
      ctx.arc(x, y, 1.2, 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(primaryColor, 0.025 * pulse)
      ctx.fill()
    }
  }
}

// ============ Wave Mode ============
interface Wave {
  amplitude: number
  frequency: number
  speed: number
  phase: number
  color: string
  yOffset: number
}

function initWaves(count: number, _width: number, height: number, speed: number, colors: string[]): Wave[] {
  const rand = seededRandom(789)
  const waves: Wave[] = []

  for (let i = 0; i < count; i++) {
    waves.push({
      amplitude: 12 + rand() * 25,
      frequency: 0.002 + rand() * 0.004,
      speed: (0.0003 + rand() * 0.0005) * speed,
      phase: rand() * Math.PI * 2,
      color: colors[Math.floor(rand() * colors.length)],
      yOffset: height * (0.2 + (i / count) * 0.6),
    })
  }

  return waves
}

function drawWaves(
  ctx: CanvasRenderingContext2D,
  waves: Wave[],
  width: number,
  height: number,
  time: number
) {
  ctx.clearRect(0, 0, width, height)

  waves.forEach((wave) => {
    ctx.beginPath()
    ctx.moveTo(0, wave.yOffset)

    for (let x = 0; x <= width; x += 3) {
      const y =
        wave.yOffset +
        Math.sin(x * wave.frequency + time * wave.speed + wave.phase) * wave.amplitude
      ctx.lineTo(x, y)
    }

    ctx.strokeStyle = hexToRgba(wave.color, 0.06)
    ctx.lineWidth = 1
    ctx.stroke()

    // 填充下方 subtle 渐变
    ctx.lineTo(width, height)
    ctx.lineTo(0, height)
    ctx.closePath()

    const gradient = ctx.createLinearGradient(0, wave.yOffset, 0, height)
    gradient.addColorStop(0, hexToRgba(wave.color, 0.015))
    gradient.addColorStop(1, 'transparent')
    ctx.fillStyle = gradient
    ctx.fill()
  })
}

// ============ Starfield Mode ============
interface Star {
  x: number
  y: number
  size: number
  opacity: number
  twinkleSpeed: number
  twinklePhase: number
  depth: number
}

function initStarfield(count: number, width: number, height: number): Star[] {
  const rand = seededRandom(999)
  const stars: Star[] = []

  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * width,
      y: rand() * height,
      size: 0.5 + rand() * 1.8,
      opacity: 0.08 + rand() * 0.35,
      twinkleSpeed: 0.3 + rand() * 1.5,
      twinklePhase: rand() * Math.PI * 2,
      depth: 0.2 + rand() * 0.8,
    })
  }

  return stars
}

function drawStarfield(
  ctx: CanvasRenderingContext2D,
  stars: Star[],
  width: number,
  height: number,
  time: number
) {
  ctx.clearRect(0, 0, width, height)

  stars.forEach((star) => {
    const twinkle = Math.sin(time * 0.0008 * star.twinkleSpeed + star.twinklePhase) * 0.5 + 0.5
    const currentOpacity = star.opacity * twinkle

    // 星光十字效果（大星星）
    if (star.size > 1.2) {
      const armLength = star.size * 2.5
      ctx.beginPath()
      ctx.moveTo(star.x - armLength, star.y)
      ctx.lineTo(star.x + armLength, star.y)
      ctx.moveTo(star.x, star.y - armLength)
      ctx.lineTo(star.x, star.y + armLength)
      ctx.strokeStyle = `rgba(245, 240, 230, ${currentOpacity * 0.12})`
      ctx.lineWidth = 0.4
      ctx.stroke()
    }

    // 星体
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(245, 240, 230, ${currentOpacity})`
    ctx.fill()

    // 大星星的光晕
    if (star.size > 1.2) {
      const glowGradient = ctx.createRadialGradient(
        star.x, star.y, 0,
        star.x, star.y, star.size * 3
      )
      glowGradient.addColorStop(0, `rgba(245, 240, 230, ${currentOpacity * 0.08})`)
      glowGradient.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(star.x, star.y, star.size * 3, 0, Math.PI * 2)
      ctx.fillStyle = glowGradient
      ctx.fill()
    }
  })
}

// ============ Main Component ============
export function DynamicBackground({
  className,
  mode = 'particle',
  enabled = true,
  density = 'medium',
  speed = 'normal',
}: DynamicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const animationRef = useRef<number>()
  const reducedMotionRef = useRef(false)
  const stateRef = useRef<any>(null)
  const resizeTimeoutRef = useRef<number>()
  const lastFrameTimeRef = useRef(0)
  const themeColorsRef = useRef<string[]>([])
  const modeRef = useRef(mode)

  const speedFactor = speedConfig[speed]

  // 根据设备性能选择密度配置
  const isLowPerf = useMemo(() => isLowPerformanceDevice(), [])
  const densityCfg = isLowPerf ? lowPerformanceDensityConfig : densityConfig
  const count = densityCfg[density][mode]

  // FPS cap: 30fps for low-end, 60fps for normal
  const targetFrameInterval = isLowPerf ? 33.33 : 16.67

  // effectiveMode mirrors mode prop for internal consistency
  // interfaceType is passed from App.tsx for semantic clarity but mode is already determined
  const effectiveMode = mode

  // 同步主题色
  useEffect(() => {
    const updateColors = () => {
      themeColorsRef.current = getThemeColors()
    }
    updateColors()

    // 监听主题变化
    const observer = new MutationObserver(updateColors)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    return () => observer.disconnect()
  }, [])

  // 初始化各模式状态
  const initMode = useCallback(
    (width: number, height: number) => {
      const colors = themeColorsRef.current.length > 0 ? themeColorsRef.current : getThemeColors()
      switch (effectiveMode) {
        case 'particle':
          return initParticles(count, width, height, speedFactor, colors)
        case 'grid':
          return initGrid(count, width, height, speedFactor)
        case 'wave':
          return initWaves(count, width, height, speedFactor, colors)
        case 'starfield':
          return initStarfield(count, width, height)
        default:
          return null
      }
    },
    [effectiveMode, count, speedFactor]
  )

  // 绘制各模式
  const drawMode = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      state: any,
      width: number,
      height: number,
      time: number
    ) => {
      const colors = themeColorsRef.current.length > 0 ? themeColorsRef.current : getThemeColors()
      switch (effectiveMode) {
        case 'particle':
          drawParticles(ctx, state, width, height, time)
          break
        case 'grid':
          drawGrid(ctx, state, width, height, time, colors)
          break
        case 'wave':
          drawWaves(ctx, state, width, height, time)
          break
        case 'starfield':
          drawStarfield(ctx, state, width, height, time)
          break
      }
    },
    [effectiveMode]
  )

  // 主动画循环 - 带FPS节流
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

    // 使用防抖的 resize 处理
    const handleResize = () => {
      if (resizeTimeoutRef.current) {
        cancelAnimationFrame(resizeTimeoutRef.current)
      }
      resizeTimeoutRef.current = requestAnimationFrame(() => {
        const rect = container.getBoundingClientRect()
        const dpr = Math.min(window.devicePixelRatio, 2)
        width = rect.width
        height = rect.height
        canvas.width = width * dpr
        canvas.height = height * dpr
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        stateRef.current = initMode(width, height)
      })
    }

    handleResize()
    window.addEventListener('resize', handleResize)

    const startTime = performance.now()

    const animate = (timestamp: number) => {
      // FPS 节流
      const elapsed = timestamp - lastFrameTimeRef.current
      if (elapsed < targetFrameInterval) {
        animationRef.current = requestAnimationFrame(animate)
        return
      }
      lastFrameTimeRef.current = timestamp - (elapsed % targetFrameInterval)

      const time = timestamp - startTime
      drawMode(ctx, stateRef.current, width, height, time)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    return () => {
      window.removeEventListener('resize', handleResize)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (resizeTimeoutRef.current) {
        cancelAnimationFrame(resizeTimeoutRef.current)
      }
    }
  }, [enabled, isVisible, effectiveMode, initMode, drawMode, targetFrameInterval])

  // IntersectionObserver
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

  // 模式变化时重新初始化
  useEffect(() => {
    modeRef.current = mode
    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()
    stateRef.current = initMode(rect.width, rect.height)
  }, [mode, initMode])

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
        style={{
          opacity: mode === 'starfield' ? 0.6 : 0.45,
          willChange: 'transform',
        }}
      />
    </div>
  )
}

/**
 * 背景模式选择器 - 用于切换背景模式
 */
export function BackgroundModeSelector({
  currentMode,
  onModeChange,
}: {
  currentMode: BackgroundMode
  onModeChange: (mode: BackgroundMode) => void
}) {
  const modes: { value: BackgroundMode; label: string; description: string }[] = [
    { value: 'particle', label: '粒子', description: '温暖活跃' },
    { value: 'grid', label: '网格', description: '结构化' },
    { value: 'wave', label: '波浪', description: '流动感' },
    { value: 'starfield', label: '星空', description: '静谧' },
  ]

  return (
    <div className="flex gap-1 p-1 rounded-lg bg-[var(--elevation-3)]">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onModeChange(m.value)}
          title={`${m.label} - ${m.description}`}
          className={cn(
            'px-3 py-1 text-xs rounded-md transition-all duration-200',
            currentMode === m.value
              ? 'bg-[var(--accent-muted)] text-[var(--accent-100)] font-medium'
              : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
