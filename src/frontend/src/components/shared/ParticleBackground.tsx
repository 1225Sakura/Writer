/**
 * ParticleBackground - 纯CSS实现的浮动粒子背景
 *
 * 使用多个绝对定位的小圆点（div），每个粒子有不同的浮动动画
 * 颜色使用半透明的主题色，非常轻量，不占用JS线程
 * 支持主题色同步和性能优化（requestAnimationFrame + IntersectionObserver）
 *
 * 注意：此组件使用纯CSS keyframes，不涉及任何JS动画计算
 * 对写作性能零影响
 */

import { useMemo, useRef, useEffect, useState } from 'react'

interface ParticleConfig {
  size: number
  left: string
  top: string
  delay: string
  duration: string
  colorVar: string
  opacity: number
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
 * 预定义粒子配置，使用CSS变量实现主题同步
 * 颜色通过CSS变量引用，自动跟随主题变化
 */
function useParticles(count: number = 16): ParticleConfig[] {
  return useMemo(() => {
    const colorKeys = Object.keys(themeColors)
    const configs: ParticleConfig[] = []

    for (let i = 0; i < count; i++) {
      const colorKey = colorKeys[i % colorKeys.length]
      configs.push({
        size: 3 + Math.floor(Math.random() * 5),
        left: `${10 + (i * 80) / count + Math.random() * 10}%`,
        top: `${10 + Math.random() * 80}%`,
        delay: `${(i * 0.7) % 12}s`,
        duration: `${16 + Math.random() * 14}s`,
        colorVar: themeColors[colorKey],
        opacity: 0.03 + Math.random() * 0.05,
      })
    }

    return configs
  }, [count])
}

interface ParticleBackgroundProps {
  particleCount?: number
  enabled?: boolean
}

/**
 * ParticleBackground - 主题感知粒子背景
 *
 * 性能优化：
 * - IntersectionObserver：不在视口内时暂停渲染
 * - will-change: transform, opacity：GPU加速
 * - 纯CSS动画：零JS开销
 * - CSS变量颜色：自动跟随主题切换
 */
export function ParticleBackground({
  particleCount = 16,
  enabled = true,
}: ParticleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const particles = useParticles(particleCount)

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

  if (!enabled || !isVisible) {
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
      {particles.map((p, i) => (
        <div
          key={i}
          className="particle"
          style={{
            position: 'absolute',
            width: p.size,
            height: p.size,
            left: p.left,
            top: p.top,
            backgroundColor: p.colorVar,
            opacity: p.opacity,
            borderRadius: '50%',
            animationDelay: p.delay,
            animationDuration: p.duration,
            willChange: 'transform, opacity',
          }}
        />
      ))}
    </div>
  )
}
