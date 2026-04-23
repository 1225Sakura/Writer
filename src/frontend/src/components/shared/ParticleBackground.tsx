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
 * 预定义粒子配置，使用CSS变量实现主题同步
 * 颜色通过CSS变量引用，自动跟随主题变化
 */
function useParticles(count: number = 12): ParticleConfig[] {
  return useMemo(() => {
    const colorKeys = Object.keys(themeColors)
    const rand = seededRandom(42) // 固定种子确保一致性
    const configs: ParticleConfig[] = []

    for (let i = 0; i < count; i++) {
      const colorKey = colorKeys[i % colorKeys.length]
      configs.push({
        size: 2 + Math.floor(rand() * 3),
        left: `${8 + (i * 84) / count + rand() * 8}%`,
        top: `${8 + rand() * 84}%`,
        delay: `${(i * 0.9) % 14}s`,
        duration: `${18 + rand() * 16}s`,
        colorVar: themeColors[colorKey],
        opacity: 0.02 + rand() * 0.03,
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
 * - 纯CSS动画：零JS开销
 * - CSS变量颜色：自动跟随主题切换
 * - 低透明度：不干扰正文阅读
 * - prefers-reduced-motion：尊重用户减少动画偏好
 */
export function ParticleBackground({
  particleCount = 12,
  enabled = true,
}: ParticleBackgroundProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const particles = useParticles(particleCount)

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
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  )
}
