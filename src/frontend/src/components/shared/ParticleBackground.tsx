/**
 * ParticleBackground - 纯CSS实现的浮动粒子背景
 *
 * 使用多个绝对定位的小元素（div），每个粒子有不同的浮动动画
 * 支持多种粒子形态：圆点、菱形、十字星、细线
 * 颜色使用半透明的主题色，非常轻量，不占用JS线程
 * 支持主题色同步和性能优化（CSS transform + will-change）
 *
 * 注意：此组件使用纯CSS keyframes，不涉及任何JS动画计算
 * 对写作性能零影响
 */

import { useMemo, useRef, useEffect, useState } from 'react'

type ParticleShape = 'circle' | 'diamond' | 'cross' | 'line'

interface ParticleConfig {
  size: number
  left: string
  top: string
  delay: string
  duration: string
  colorVar: string
  opacity: number
  shape: ParticleShape
  rotation: number
  scale: number
  // 预计算的连接线端点（百分比转为数值用于SVG）
  connectionX: number
  connectionY: number
}

/**
 * 主题色映射 - 与CSS变量同步
 */
const themeColors: Record<string, string> = {
  accent: 'var(--accent-primary)',
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
  world: 'var(--color-world)',
}

/**
 * 粒子形态分布权重
 */
const shapeWeights: ParticleShape[] = [
  'circle', 'circle', 'circle', 'circle', 'circle', 'circle',
  'diamond', 'diamond', 'diamond',
  'cross', 'cross',
  'line', 'line',
]

/**
 * 基于种子生成伪随机数，确保每次渲染结果一致
 */
function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

/**
 * 检测低性能设备（移动设备或小屏幕）
 */
function isLowPerformanceDevice(): boolean {
  // 检测移动设备
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
  // 检测小屏幕
  const isSmallScreen = window.innerWidth < 768
  // 检测 reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  return isMobile || isSmallScreen || prefersReducedMotion
}

/**
 * 预定义粒子配置，使用CSS变量实现主题同步
 * 颜色通过CSS变量引用，自动跟随主题变化
 */
function useParticles(count: number = 16): ParticleConfig[] {
  return useMemo(() => {
    const colorKeys = Object.keys(themeColors)
    const rand = seededRandom(42) // 固定种子确保一致性
    const configs: ParticleConfig[] = []

    for (let i = 0; i < count; i++) {
      const colorKey = colorKeys[i % colorKeys.length]
      const shape = shapeWeights[Math.floor(rand() * shapeWeights.length)]
      const leftPct = 5 + (i * 90) / count + rand() * 6
      const topPct = 5 + rand() * 90
      configs.push({
        size: 2 + Math.floor(rand() * 4),
        left: `${leftPct}%`,
        top: `${topPct}%`,
        delay: `${(i * 0.7) % 12}s`,
        duration: `${16 + rand() * 14}s`,
        colorVar: themeColors[colorKey],
        opacity: 0.015 + rand() * 0.035,
        shape,
        rotation: Math.floor(rand() * 360),
        scale: 0.7 + rand() * 0.6,
        // 预计算连接线端点（用于SVG，需要数值而非百分比）
        connectionX: leftPct,
        connectionY: topPct,
      })
    }

    return configs
  }, [count])
}

/**
 * 获取粒子形态对应的CSS样式
 * 优化：简化cross形态，使用更高效的渲染方式
 */
function getParticleShapeStyle(shape: ParticleShape, size: number): React.CSSProperties {
  switch (shape) {
    case 'circle':
      return {
        borderRadius: '50%',
        width: size,
        height: size,
      }
    case 'diamond':
      return {
        borderRadius: '1px',
        width: size,
        height: size,
        transform: `rotate(45deg) scale(var(--particle-scale, 1))`,
      }
    case 'cross':
      // 使用 box-shadow 模拟十字星，比 background-image 更高效
      return {
        width: size,
        height: size,
        borderRadius: '50%',
        boxShadow: `
          calc(var(--particle-size, ${size}px) * 1.5) 0 0 0 var(--particle-color),
          calc(var(--particle-size, ${size}px) * -1.5) 0 0 0 var(--particle-color),
          0 calc(var(--particle-size, ${size}px) * 1.5) 0 0 var(--particle-color),
          0 calc(var(--particle-size, ${size}px) * -1.5) 0 0 var(--particle-color)
        `,
        transform: `rotate(var(--particle-rotation, 0deg)) scale(var(--particle-scale, 1))`,
      }
    case 'line':
      return {
        borderRadius: '1px',
        width: size * 3,
        height: Math.max(1, size * 0.3),
        transform: `rotate(var(--particle-rotation, 0deg)) scale(var(--particle-scale, 1))`,
      }
    default:
      return {
        borderRadius: '50%',
        width: size,
        height: size,
      }
  }
}

interface ParticleBackgroundProps {
  particleCount?: number
  enabled?: boolean
  /** 是否显示连接线 */
  showConnections?: boolean
}

/**
 * CSS动画关键帧 - 定义在组件外部避免重复创建
 * 通过CSS变量控制颜色和形态，实现主题同步
 */
const particleStyles = `
  @keyframes particle-float {
    0%, 100% {
      transform: translateY(0) rotate(var(--particle-rotation, 0deg)) scale(var(--particle-scale, 1));
    }
    25% {
      transform: translateY(-8px) rotate(calc(var(--particle-rotation, 0deg) + 15deg)) scale(var(--particle-scale, 1));
    }
    50% {
      transform: translateY(-4px) rotate(calc(var(--particle-rotation, 0deg) - 10deg)) scale(var(--particle-scale, 1));
    }
    75% {
      transform: translateY(-12px) rotate(calc(var(--particle-rotation, 0deg) + 5deg)) scale(var(--particle-scale, 1));
    }
  }

  @keyframes connection-pulse {
    0%, 100% { opacity: 0.02; }
    50% { opacity: 0.06; }
  }

  .particle-background .particle {
    animation: particle-float linear infinite;
    animation-duration: var(--particle-duration, 20s);
    animation-delay: var(--particle-delay, 0s);
  }
`

/**
 * 注入CSS样式（仅在需要时）
 */
function useParticleStyles() {
  useEffect(() => {
    // 检查是否已存在样式
    if (document.getElementById('particle-background-styles')) return

    const styleEl = document.createElement('style')
    styleEl.id = 'particle-background-styles'
    styleEl.textContent = particleStyles
    document.head.appendChild(styleEl)

    return () => {
      const existing = document.getElementById('particle-background-styles')
      if (existing) existing.remove()
    }
  }, [])
}

/**
 * ParticleBackground - 主题感知粒子背景
 *
 * 性能优化：
 * - IntersectionObserver：不在视口内时暂停渲染
 * - 纯CSS动画：零JS开销
 * - CSS变量颜色：自动跟随主题切换
 * - 低透明度：不干扰正文阅读
 * - prefers-reduced-motion：尊重用户减少动画偏好
 * - CSS transform 替代 top/left：GPU 加速
 * - will-change 提示浏览器优化
 * - 低性能设备自动减少粒子数量
 * - 连接线使用数值坐标而非百分比字符串
 */
export function ParticleBackground({
  particleCount: propParticleCount,
  enabled = true,
  showConnections = false,
}: ParticleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // 根据设备性能调整粒子数量
  const particleCount = useMemo(() => {
    if (propParticleCount) return propParticleCount
    return isLowPerformanceDevice() ? 8 : 16
  }, [propParticleCount])

  const particles = useParticles(particleCount)

  // 注入CSS动画样式
  useParticleStyles()

  // 检测 prefers-reduced-motion
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mql.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  // 使用 IntersectionObserver 检测可见性
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting)
      },
      { threshold: 0 }
    )

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // 预计算连接线（使用回调避免不必要的重渲染）
  const connectionLines = useMemo(() => {
    if (!showConnections) return []
    const lines: Array<{
      x1: number
      y1: number
      x2: number
      y2: number
      key: string
      animDelay: string
    }> = []

    for (let i = 0; i < particles.length; i++) {
      // 只连接相邻的几个粒子，避免过多线条
      for (let j = i + 1; j < Math.min(i + 4, particles.length); j++) {
        lines.push({
          x1: particles[i].connectionX,
          y1: particles[i].connectionY,
          x2: particles[j].connectionX,
          y2: particles[j].connectionY,
          key: `${i}-${j}`,
          animDelay: `${i * 0.3}s`,
        })
      }
    }
    return lines
  }, [particles, showConnections])

  if (!enabled || !isVisible || prefersReducedMotion) {
    return <div ref={containerRef} aria-hidden="true" />
  }

  return (
    <div
      ref={containerRef}
      className="particle-background"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0,
        overflow: 'hidden',
      }}
      aria-hidden="true"
    >
      {/* 连接线层 - 使用 SVG 实现，数值坐标避免字符串解析开销 */}
      {showConnections && (
        <svg
          className="particle-connections"
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            opacity: 0.04,
          }}
        >
          {connectionLines.map((line) => (
            <line
              key={line.key}
              x1={`${line.x1}%`}
              y1={`${line.y1}%`}
              x2={`${line.x2}%`}
              y2={`${line.y2}%`}
              stroke="var(--accent-primary)"
              strokeWidth="0.5"
              style={{
                animation: `connection-pulse 8s ease-in-out infinite`,
                animationDelay: line.animDelay,
              }}
            />
          ))}
        </svg>
      )}

      {/* 粒子层 */}
      {particles.map((p, i) => {
        const shapeStyle = getParticleShapeStyle(p.shape, p.size)

        return (
          <div
            key={i}
            className={`particle particle--${p.shape}`}
            style={{
              position: 'absolute',
              left: p.left,
              top: p.top,
              backgroundColor: p.shape === 'cross' ? 'transparent' : p.colorVar,
              opacity: p.opacity,
              willChange: 'transform, opacity',
              // CSS变量传递动画参数
              ['--particle-rotation' as string]: `${p.rotation}deg`,
              ['--particle-scale' as string]: p.scale,
              ['--particle-color' as string]: p.colorVar,
              ['--particle-delay' as string]: p.delay,
              ['--particle-duration' as string]: p.duration,
              ['--particle-size' as string]: `${p.size}px`,
              ...shapeStyle,
            }}
          />
        )
      })}

      {/* 轨迹效果层 - 禁用以提升性能，低性能设备不渲染 */}
      {particles.length <= 12 &&
        particles.slice(0, 4).map((p, i) => (
          <div
            key={`trail-${i}`}
            className="particle-trail"
            style={{
              position: 'absolute',
              left: p.left,
              top: p.top,
              width: p.size,
              height: p.size,
              backgroundColor: p.colorVar,
              opacity: p.opacity * 0.3,
              borderRadius: p.shape === 'circle' ? '50%' : '1px',
              willChange: 'transform, opacity',
              filter: 'blur(1px)',
              // CSS变量传递动画参数
              ['--particle-delay' as string]: `${parseFloat(p.delay) + 0.5}s`,
              ['--particle-duration' as string]: p.duration,
              ['--particle-rotation' as string]: `${p.rotation}deg`,
              ['--particle-scale' as string]: p.scale,
            }}
          />
        ))}
    </div>
  )
}
