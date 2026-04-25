/**
 * DynamicBackground - 动态背景组件
 *
 * 支持多种背景模式可切换：
 * - particle: Canvas 粒子效果
 * - grid: 动态网格线
 * - wave: 波浪线条
 * - starfield: 星空效果
 * - ink-wash: 水墨扩散效果
 * - paper-texture: 宣纸纹理效果
 * - constellation: 星空粒子连线效果
 *
 * 特性：
 * - Canvas 渲染，性能优化
 * - FPS 节流（30fps cap for low-end devices）
 * - 统一视觉风格（Ink/Parchment色系）
 * - 平滑主题色同步过渡
 * - prefers-reduced-motion 支持
 * - 界面类型个性化（chat/settings/writing）
 * - Tab 不可见时自动暂停动画
 * - 背景模式切换 crossfade 效果
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { cn } from '@/lib/utils'

export type BackgroundMode = 'particle' | 'grid' | 'wave' | 'starfield' | 'ink-wash' | 'paper-texture' | 'constellation' | 'ink-smoke'

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
  /** 沉浸模式 - 最小化背景 */
  immersive?: boolean
}

// 密度配置
const densityConfig = {
  low: { particle: 6, grid: 4, wave: 1, starfield: 25, 'ink-wash': 3, 'paper-texture': 1, constellation: 20, 'ink-smoke': 4 },
  medium: { particle: 10, grid: 6, wave: 2, starfield: 40, 'ink-wash': 5, 'paper-texture': 1, constellation: 35, 'ink-smoke': 6 },
  high: { particle: 15, grid: 8, wave: 3, starfield: 60, 'ink-wash': 7, 'paper-texture': 1, constellation: 50, 'ink-smoke': 8 },
}

// 低性能设备密度配置（自动降级）
const lowPerformanceDensityConfig = {
  low: { particle: 4, grid: 3, wave: 1, starfield: 15, 'ink-wash': 2, 'paper-texture': 1, constellation: 12, 'ink-smoke': 3 },
  medium: { particle: 6, grid: 4, wave: 1, starfield: 25, 'ink-wash': 3, 'paper-texture': 1, constellation: 20, 'ink-smoke': 4 },
  high: { particle: 10, grid: 6, wave: 2, starfield: 40, 'ink-wash': 4, 'paper-texture': 1, constellation: 30, 'ink-smoke': 5 },
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

// ============ Ink Wash Mode ============
interface InkBlob {
  x: number
  y: number
  radius: number
  maxRadius: number
  growthSpeed: number
  opacity: number
  color: string
  phase: number
  spreadDelay: number
}

function initInkWash(count: number, width: number, height: number, _colors: string[]): InkBlob[] {
  const rand = seededRandom(555)
  const blobs: InkBlob[] = []
  const inkColors = ['#1a1a2e', '#2d2d44', '#3a3a5c', '#4a4a6a', '#5e6ad2']

  for (let i = 0; i < count; i++) {
    const baseColor = inkColors[Math.floor(rand() * inkColors.length)]
    blobs.push({
      x: rand() * width,
      y: rand() * height,
      radius: 20 + rand() * 40,
      maxRadius: 60 + rand() * 120,
      growthSpeed: 0.02 + rand() * 0.03,
      opacity: 0.03 + rand() * 0.05,
      color: baseColor,
      phase: rand() * Math.PI * 2,
      spreadDelay: rand() * 5000,
    })
  }
  return blobs
}

function drawInkWash(
  ctx: CanvasRenderingContext2D,
  blobs: InkBlob[],
  width: number,
  height: number,
  time: number
) {
  ctx.clearRect(0, 0, width, height)

  // 宣纸底色
  ctx.fillStyle = 'rgba(245, 240, 230, 0.02)'
  ctx.fillRect(0, 0, width, height)

  blobs.forEach((blob) => {
    const elapsed = Math.max(0, time - blob.spreadDelay)
    const growthCycle = (Math.sin(elapsed * 0.0003 * blob.growthSpeed + blob.phase) + 1) * 0.5
    const currentRadius = blob.radius + (blob.maxRadius - blob.radius) * growthCycle
    const currentOpacity = blob.opacity * (0.5 + growthCycle * 0.5)

    // 主墨团 - 使用径向渐变模拟墨水扩散
    const gradient = ctx.createRadialGradient(
      blob.x, blob.y, 0,
      blob.x, blob.y, currentRadius
    )
    gradient.addColorStop(0, hexToRgba(blob.color, currentOpacity * 0.8))
    gradient.addColorStop(0.4, hexToRgba(blob.color, currentOpacity * 0.4))
    gradient.addColorStop(0.7, hexToRgba(blob.color, currentOpacity * 0.15))
    gradient.addColorStop(1, 'transparent')

    ctx.beginPath()
    ctx.arc(blob.x, blob.y, currentRadius, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()

    // 墨水边缘不规则效果 - 使用多个小圆点模拟
    const edgeCount = Math.floor(currentRadius * 0.3)
    for (let i = 0; i < edgeCount; i++) {
      const angle = (i / edgeCount) * Math.PI * 2 + blob.phase
      const edgeDist = currentRadius * (0.7 + Math.sin(angle * 3 + time * 0.0005) * 0.3)
      const ex = blob.x + Math.cos(angle) * edgeDist
      const ey = blob.y + Math.sin(angle) * edgeDist
      const esize = 2 + Math.sin(angle * 5 + time * 0.0003) * 3

      ctx.beginPath()
      ctx.arc(ex, ey, Math.max(1, esize), 0, Math.PI * 2)
      ctx.fillStyle = hexToRgba(blob.color, currentOpacity * 0.2)
      ctx.fill()
    }
  })

  // 添加细微的纹理噪点
  const noiseCount = 30
  const rand = seededRandom(Math.floor(time * 0.001) % 100)
  for (let i = 0; i < noiseCount; i++) {
    const nx = rand() * width
    const ny = rand() * height
    const nsize = 0.5 + rand() * 1.5
    ctx.beginPath()
    ctx.arc(nx, ny, nsize, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(26, 26, 46, ${0.01 + rand() * 0.02})`
    ctx.fill()
  }
}

// ============ Paper Texture Mode ============
interface PaperGrain {
  x: number
  y: number
  size: number
  opacity: number
  color: string
}

function initPaperTexture(_count: number, width: number, height: number): PaperGrain[] {
  const rand = seededRandom(777)
  const grains: PaperGrain[] = []
  const grainCount = Math.floor((width * height) / 8000)

  for (let i = 0; i < grainCount; i++) {
    const warmth = rand()
    grains.push({
      x: rand() * width,
      y: rand() * height,
      size: 0.3 + rand() * 1.2,
      opacity: 0.008 + rand() * 0.02,
      color: warmth > 0.5 ? '#d4c4a8' : '#8a8a9a',
    })
  }
  return grains
}

function drawPaperTexture(
  ctx: CanvasRenderingContext2D,
  grains: PaperGrain[],
  width: number,
  height: number,
  time: number
) {
  ctx.clearRect(0, 0, width, height)

  // 基础宣纸色
  const baseGradient = ctx.createLinearGradient(0, 0, 0, height)
  baseGradient.addColorStop(0, 'rgba(245, 240, 230, 0.03)')
  baseGradient.addColorStop(0.5, 'rgba(242, 237, 228, 0.05)')
  baseGradient.addColorStop(1, 'rgba(245, 240, 230, 0.03)')
  ctx.fillStyle = baseGradient
  ctx.fillRect(0, 0, width, height)

  // 微妙的色彩变化层
  const colorShift = Math.sin(time * 0.0002) * 0.5 + 0.5
  const warmGradient = ctx.createRadialGradient(
    width * 0.3, height * 0.3, 0,
    width * 0.3, height * 0.3, width * 0.6
  )
  warmGradient.addColorStop(0, `rgba(232, 184, 125, ${0.015 + colorShift * 0.01})`)
  warmGradient.addColorStop(1, 'transparent')
  ctx.fillStyle = warmGradient
  ctx.fillRect(0, 0, width, height)

  const coolGradient = ctx.createRadialGradient(
    width * 0.7, height * 0.7, 0,
    width * 0.7, height * 0.7, width * 0.5
  )
  coolGradient.addColorStop(0, `rgba(94, 106, 210, ${0.01 + (1 - colorShift) * 0.008})`)
  coolGradient.addColorStop(1, 'transparent')
  ctx.fillStyle = coolGradient
  ctx.fillRect(0, 0, width, height)

  // 纤维纹理
  grains.forEach((grain) => {
    const pulse = Math.sin(time * 0.0005 + grain.x * 0.01 + grain.y * 0.01) * 0.3 + 0.7
    ctx.beginPath()
    ctx.arc(grain.x, grain.y, grain.size, 0, Math.PI * 2)
    ctx.fillStyle = hexToRgba(grain.color, grain.opacity * pulse)
    ctx.fill()
  })

  // 水平纤维线
  const lineCount = Math.floor(height / 40)
  for (let i = 0; i < lineCount; i++) {
    const y = i * 40 + Math.sin(i * 1.5) * 5
    const lineOpacity = 0.004 + Math.sin(time * 0.0003 + i) * 0.002
    ctx.beginPath()
    ctx.moveTo(0, y)
    for (let x = 0; x <= width; x += 10) {
      ctx.lineTo(x, y + Math.sin(x * 0.02 + i + time * 0.0001) * 1.5)
    }
    ctx.strokeStyle = `rgba(180, 170, 150, ${Math.max(0, lineOpacity)})`
    ctx.lineWidth = 0.3
    ctx.stroke()
  }
}

// ============ Ink Smoke Mode ============
interface SmokeParticle {
  x: number
  y: number
  radius: number
  vx: number
  vy: number
  opacity: number
  color: string
  phase: number
  lifetime: number
  age: number
}

function initInkSmoke(count: number, width: number, height: number, _colors: string[]): SmokeParticle[] {
  const rand = seededRandom(666)
  const particles: SmokeParticle[] = []
  const smokeColors = ['#1a1a2e', '#2d2d44', '#3a3a5c', '#4a4a6a']

  for (let i = 0; i < count; i++) {
    particles.push({
      x: rand() * width,
      y: height + rand() * height * 0.3, // start from bottom
      radius: 30 + rand() * 60,
      vx: (rand() - 0.5) * 0.3,
      vy: -(0.3 + rand() * 0.5),
      opacity: 0.02 + rand() * 0.04,
      color: smokeColors[Math.floor(rand() * smokeColors.length)],
      phase: rand() * Math.PI * 2,
      lifetime: 300 + rand() * 400,
      age: rand() * 400, // stagger initial ages
    })
  }
  return particles
}

function drawInkSmoke(
  ctx: CanvasRenderingContext2D,
  particles: SmokeParticle[],
  width: number,
  height: number,
  time: number
) {
  ctx.clearRect(0, 0, width, height)

  particles.forEach((p) => {
    p.age++

    // Reset particle when it ages out or goes off screen
    if (p.age > p.lifetime || p.y < -p.radius) {
      p.x = Math.random() * width
      p.y = height + p.radius
      p.age = 0
      p.lifetime = 300 + Math.random() * 400
    }

    // Move upward with drift
    p.x += p.vx + Math.sin(time * 0.0003 + p.phase) * 0.2
    p.y += p.vy

    // Pulsing expansion
    const expansion = 1 + Math.sin(time * 0.0004 + p.phase * 2) * 0.15

    // Soft smoky gradient
    const gradient = ctx.createRadialGradient(
      p.x, p.y, 0,
      p.x, p.y, p.radius * expansion
    )
    const fadeIn = Math.min(p.age / 50, 1)
    const fadeOut = p.age > p.lifetime - 80 ? Math.max(0, (p.lifetime - p.age) / 80) : 1
    const currentOpacity = p.opacity * fadeIn * fadeOut

    gradient.addColorStop(0, hexToRgba(p.color, currentOpacity * 0.7))
    gradient.addColorStop(0.3, hexToRgba(p.color, currentOpacity * 0.4))
    gradient.addColorStop(0.6, hexToRgba(p.color, currentOpacity * 0.15))
    gradient.addColorStop(1, 'transparent')

    ctx.beginPath()
    ctx.arc(p.x, p.y, p.radius * expansion, 0, Math.PI * 2)
    ctx.fillStyle = gradient
    ctx.fill()
  })
}

// ============ Constellation Mode ============
interface ConstellationStar {
  x: number
  y: number
  size: number
  opacity: number
  twinkleSpeed: number
  twinklePhase: number
  vx: number
  vy: number
}

interface ConstellationLine {
  from: number
  to: number
  opacity: number
}

interface ConstellationState {
  stars: ConstellationStar[]
  lines: ConstellationLine[]
  mouseX: number
  mouseY: number
}

function initConstellation(count: number, width: number, height: number, speed: number, _colors: string[]): ConstellationState {
  const rand = seededRandom(111)
  const stars: ConstellationStar[] = []

  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * width,
      y: rand() * height,
      size: 0.8 + rand() * 2.2,
      opacity: 0.15 + rand() * 0.4,
      twinkleSpeed: 0.5 + rand() * 1.5,
      twinklePhase: rand() * Math.PI * 2,
      vx: (rand() - 0.5) * 0.15 * speed,
      vy: (rand() - 0.5) * 0.15 * speed,
    })
  }

  return { stars, lines: [], mouseX: -1000, mouseY: -1000 }
}

function drawConstellation(
  ctx: CanvasRenderingContext2D,
  state: ConstellationState,
  width: number,
  height: number,
  time: number,
  colors: string[]
) {
  ctx.clearRect(0, 0, width, height)

  const { stars, mouseX, mouseY } = state
  const primaryColor = colors[0] || '#5e6ad2'
  const connectionDist = 120
  const maxConnections = 40

  // 更新星星位置
  stars.forEach((star) => {
    star.x += star.vx
    star.y += star.vy

    if (star.x < -10) star.x = width + 10
    if (star.x > width + 10) star.x = -10
    if (star.y < -10) star.y = height + 10
    if (star.y > height + 10) star.y = -10

    // 鼠标吸引效果
    if (mouseX >= 0 && mouseY >= 0) {
      const dx = mouseX - star.x
      const dy = mouseY - star.y
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 200 && dist > 5) {
        const force = (200 - dist) / 200 * 0.02
        star.vx += (dx / dist) * force
        star.vy += (dy / dist) * force
        // 阻尼
        star.vx *= 0.99
        star.vy *= 0.99
      }
    }
  })

  // 计算连线
  let connectionCount = 0
  for (let i = 0; i < stars.length && connectionCount < maxConnections; i++) {
    for (let j = i + 1; j < stars.length && connectionCount < maxConnections; j++) {
      const dx = stars[i].x - stars[j].x
      const dy = stars[i].y - stars[j].y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < connectionDist) {
        const lineOpacity = (1 - dist / connectionDist) * 0.08
        ctx.beginPath()
        ctx.moveTo(stars[i].x, stars[i].y)
        ctx.lineTo(stars[j].x, stars[j].y)
        ctx.strokeStyle = hexToRgba(primaryColor, lineOpacity)
        ctx.lineWidth = 0.4
        ctx.stroke()
        connectionCount++
      }
    }

    // 鼠标连线
    if (mouseX >= 0 && mouseY >= 0) {
      const mdx = mouseX - stars[i].x
      const mdy = mouseY - stars[i].y
      const mDist = Math.sqrt(mdx * mdx + mdy * mdy)
      if (mDist < connectionDist * 0.8) {
        const lineOpacity = (1 - mDist / (connectionDist * 0.8)) * 0.06
        ctx.beginPath()
        ctx.moveTo(stars[i].x, stars[i].y)
        ctx.lineTo(mouseX, mouseY)
        ctx.strokeStyle = hexToRgba(primaryColor, lineOpacity)
        ctx.lineWidth = 0.3
        ctx.stroke()
      }
    }
  }

  // 绘制星星
  stars.forEach((star) => {
    const twinkle = Math.sin(time * 0.001 * star.twinkleSpeed + star.twinklePhase) * 0.4 + 0.6
    const currentOpacity = star.opacity * twinkle

    // 光晕
    const glowGradient = ctx.createRadialGradient(
      star.x, star.y, 0,
      star.x, star.y, star.size * 4
    )
    glowGradient.addColorStop(0, hexToRgba(primaryColor, currentOpacity * 0.15))
    glowGradient.addColorStop(1, 'transparent')
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size * 4, 0, Math.PI * 2)
    ctx.fillStyle = glowGradient
    ctx.fill()

    // 星体
    ctx.beginPath()
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2)
    ctx.fillStyle = hexToRgba(primaryColor, currentOpacity)
    ctx.fill()
  })
}

// ============ Main Component ============
export function DynamicBackground({
  className,
  mode = 'particle',
  enabled = true,
  density = 'medium',
  speed = 'normal',
  immersive = false,
}: DynamicBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [isTabVisible, setIsTabVisible] = useState(true)
  const animationRef = useRef<number>()
  const reducedMotionRef = useRef(false)
  const stateRef = useRef<any>(null)
  const resizeTimeoutRef = useRef<number>()
  const lastFrameTimeRef = useRef(0)
  const themeColorsRef = useRef<string[]>([])
  const modeRef = useRef(mode)
  const mouseRef = useRef({ x: -1000, y: -1000 })
  const crossfadeRef = useRef<{
    fromMode: BackgroundMode | null
    toMode: BackgroundMode
    progress: number
    fromState: any
    duration: number
  } | null>(null)

  const speedFactor = speedConfig[speed]

  // 根据设备性能选择密度配置
  const isLowPerf = useMemo(() => isLowPerformanceDevice(), [])
  const densityCfg = isLowPerf ? lowPerformanceDensityConfig : densityConfig
  const count = densityCfg[density][mode]

  // FPS cap: 30fps for low-end, 60fps for normal
  const targetFrameInterval = isLowPerf ? 33.33 : 16.67

  // effectiveMode mirrors mode prop for internal consistency
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

  // Tab visibility 检测
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(!document.hidden)
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // 鼠标追踪（用于 constellation 模式）
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const container = containerRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      mouseRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      }
      // 更新 constellation 状态
      if (stateRef.current && stateRef.current.stars) {
        stateRef.current.mouseX = mouseRef.current.x
        stateRef.current.mouseY = mouseRef.current.y
      }
    }
    const handleMouseLeave = () => {
      mouseRef.current = { x: -1000, y: -1000 }
      if (stateRef.current && stateRef.current.stars) {
        stateRef.current.mouseX = -1000
        stateRef.current.mouseY = -1000
      }
    }
    window.addEventListener('mousemove', handleMouseMove)
    const container = containerRef.current
    if (container) {
      container.addEventListener('mouseleave', handleMouseLeave)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (container) {
        container.removeEventListener('mouseleave', handleMouseLeave)
      }
    }
  }, [])

  // 初始化各模式状态
  const initMode = useCallback(
    (width: number, height: number, targetMode: BackgroundMode = effectiveMode) => {
      const colors = themeColorsRef.current.length > 0 ? themeColorsRef.current : getThemeColors()
      switch (targetMode) {
        case 'particle':
          return initParticles(count, width, height, speedFactor, colors)
        case 'grid':
          return initGrid(count, width, height, speedFactor)
        case 'wave':
          return initWaves(count, width, height, speedFactor, colors)
        case 'starfield':
          return initStarfield(count, width, height)
        case 'ink-wash':
          return initInkWash(count, width, height, colors)
        case 'paper-texture':
          return initPaperTexture(count, width, height)
        case 'constellation':
          return initConstellation(count, width, height, speedFactor, colors)
        case 'ink-smoke':
          return initInkSmoke(count, width, height, colors)
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
      time: number,
      targetMode: BackgroundMode = effectiveMode
    ) => {
      const colors = themeColorsRef.current.length > 0 ? themeColorsRef.current : getThemeColors()
      switch (targetMode) {
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
        case 'ink-wash':
          drawInkWash(ctx, state, width, height, time)
          break
        case 'paper-texture':
          drawPaperTexture(ctx, state, width, height, time)
          break
        case 'constellation':
          drawConstellation(ctx, state, width, height, time, colors)
          break
        case 'ink-smoke':
          drawInkSmoke(ctx, state, width, height, time)
          break
      }
    },
    [effectiveMode]
  )

  // 主动画循环 - 带FPS节流
  useEffect(() => {
    if (!enabled || !isVisible || !isTabVisible) return

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

      // Crossfade 处理
      if (crossfadeRef.current) {
        const cf = crossfadeRef.current
        cf.progress += elapsed / cf.duration

        if (cf.progress >= 1) {
          // Crossfade 完成
          crossfadeRef.current = null
          drawMode(ctx, stateRef.current, width, height, time)
        } else {
          // 绘制 from 模式（淡出）
          ctx.save()
          ctx.globalAlpha = 1 - cf.progress
          if (cf.fromState) {
            drawMode(ctx, cf.fromState, width, height, time, cf.fromMode!)
          }
          ctx.restore()

          // 绘制 to 模式（淡入）
          ctx.save()
          ctx.globalAlpha = cf.progress
          drawMode(ctx, stateRef.current, width, height, time, cf.toMode)
          ctx.restore()
        }
      } else {
        drawMode(ctx, stateRef.current, width, height, time)
      }

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
  }, [enabled, isVisible, isTabVisible, effectiveMode, initMode, drawMode, targetFrameInterval])

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

  // 模式变化时触发 crossfade 并重新初始化
  useEffect(() => {
    const prevMode = modeRef.current
    modeRef.current = mode

    const canvas = canvasRef.current
    const container = containerRef.current
    if (!canvas || !container) return
    const rect = container.getBoundingClientRect()

    // 保存旧状态用于 crossfade
    const oldState = stateRef.current
    stateRef.current = initMode(rect.width, rect.height)

    // 启动 crossfade
    if (oldState && prevMode !== mode) {
      crossfadeRef.current = {
        fromMode: prevMode,
        toMode: mode,
        progress: 0,
        fromState: oldState,
        duration: 800, // 800ms crossfade
      }
    }
  }, [mode, initMode])

  // 沉浸模式 opacity
  const canvasOpacity = useMemo(() => {
    if (immersive) return 0.15
    if (mode === 'starfield') return 0.6
    if (mode === 'ink-wash') return 0.5
    if (mode === 'paper-texture') return 0.4
    if (mode === 'constellation') return 0.55
    return 0.45
  }, [mode, immersive])

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
        className="absolute inset-0 w-full h-full transition-opacity duration-700"
        style={{
          opacity: canvasOpacity,
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
    { value: 'ink-wash', label: '水墨', description: '东方意境' },
    { value: 'ink-smoke', label: '墨烟', description: '烟渺缥缈' },
    { value: 'paper-texture', label: '宣纸', description: '古典质感' },
    { value: 'constellation', label: '星图', description: '交互连线' },
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
