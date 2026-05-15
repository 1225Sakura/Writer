/**
 * AnimatedBackground - 可复用的动画背景容器
 *
 * 支持多种背景模式（渐变流动、浮动形状、网格线）
 * 可配置颜色和动画速度，子内容在背景上层清晰显示
 * 使用CSS动画（低性能开销）
 */

import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export type BackgroundMode = 'gradient-flow' | 'floating-shapes' | 'grid-lines' | 'dots' | 'aurora'

export interface AnimatedBackgroundProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 背景模式 */
  mode?: BackgroundMode
  /** 主色调 */
  color?: 'accent' | 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'custom'
  /** 自定义颜色值 */
  customColor?: string
  /** 动画速度（秒，数值越小越快） */
  speed?: number
  /** 动画强度（0-1） */
  intensity?: number
  /** 是否暂停动画 */
  paused?: boolean
  /** 子内容 */
  children: React.ReactNode
  /** 背景叠加层不透明度 */
  overlayOpacity?: number
}

const colorMap: Record<string, string> = {
  accent: 'var(--accent-100)',
  character: 'var(--color-character)',
  item: 'var(--color-item)',
  location: 'var(--color-location)',
  faction: 'var(--color-faction)',
  outline: 'var(--color-outline)',
  ifline: 'var(--color-ifline)',
  custom: 'var(--accent-100)',
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '')
  const bigint = parseInt(sanitized, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function generateFloatingShapes(color: string, intensity: number): React.ReactNode {
  const shapes = [
    { size: 120, x: '10%', y: '20%', delay: 0, duration: 20 },
    { size: 80, x: '70%', y: '15%', delay: 5, duration: 25 },
    { size: 160, x: '40%', y: '60%', delay: 10, duration: 22 },
    { size: 60, x: '85%', y: '70%', delay: 3, duration: 18 },
    { size: 100, x: '20%', y: '80%', delay: 8, duration: 24 },
    { size: 140, x: '60%', y: '40%', delay: 12, duration: 21 },
  ]

  return shapes.map((shape, i) => (
    <div
      key={i}
      className="absolute rounded-full pointer-events-none"
      style={{
        width: shape.size,
        height: shape.size,
        left: shape.x,
        top: shape.y,
        background: `radial-gradient(circle, ${hexToRgba(color, 0.06 * intensity)} 0%, transparent 70%)`,
        animation: `ambient-orb-float ${shape.duration}s ease-in-out infinite`,
        animationDelay: `${shape.delay}s`,
      }}
    />
  ))
}

function generateGridLines(color: string, intensity: number): React.ReactNode {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `
          linear-gradient(${hexToRgba(color, 0.04 * intensity)} 1px, transparent 1px),
          linear-gradient(90deg, ${hexToRgba(color, 0.04 * intensity)} 1px, transparent 1px)
        `,
        backgroundSize: '40px 40px',
      }}
    />
  )
}

function generateDots(color: string, intensity: number): React.ReactNode {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `radial-gradient(circle, ${hexToRgba(color, 0.12 * intensity)} 1px, transparent 1px)`,
        backgroundSize: '24px 24px',
      }}
    />
  )
}

function generateAurora(color: string, intensity: number, speed: number): React.ReactNode {
  return (
    <>
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${hexToRgba(color, 0.08 * intensity)}, transparent)`,
          animation: `aurora-shift ${speed * 3}s ease-in-out infinite`,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 30% 100%, ${hexToRgba(color, 0.05 * intensity)}, transparent)`,
          animation: `aurora-shift ${speed * 4}s ease-in-out infinite reverse`,
        }}
      />
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 50% 60% at 80% 80%, ${hexToRgba(color, 0.04 * intensity)}, transparent)`,
          animation: `aurora-shift ${speed * 5}s ease-in-out infinite`,
          animationDelay: `${speed}s`,
        }}
      />
    </>
  )
}

export const AnimatedBackground = React.forwardRef<HTMLDivElement, AnimatedBackgroundProps>(
  (
    {
      className,
      mode = 'gradient-flow',
      color = 'accent',
      customColor,
      speed = 1,
      intensity = 0.5,
      paused = false,
      children,
      overlayOpacity = 0.5,
      style,
      ...props
    },
    ref
  ) => {
    const resolvedColor = customColor ?? colorMap[color] ?? colorMap.accent
    const animationPlayState = paused ? 'paused' : 'running'

    const renderBackground = (): React.ReactNode => {
      switch (mode) {
        case 'gradient-flow':
          return (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(135deg, ${hexToRgba(resolvedColor, 0.03 * intensity)} 0%, transparent 50%, ${hexToRgba(resolvedColor, 0.02 * intensity)} 100%)`,
                backgroundSize: '200% 200%',
                animation: `gradient-flow ${speed * 8}s ease infinite`,
                animationPlayState,
              }}
            />
          )
        case 'floating-shapes':
          return generateFloatingShapes(resolvedColor, intensity)
        case 'grid-lines':
          return generateGridLines(resolvedColor, intensity)
        case 'dots':
          return generateDots(resolvedColor, intensity)
        case 'aurora':
          return generateAurora(resolvedColor, intensity, speed)
        default:
          return null
      }
    }

    return (
      <div
        ref={ref}
        className={twMerge(clsx('relative overflow-hidden', className))}
        style={style}
        {...props}
      >
        {/* Background layer */}
        {renderBackground()}

        {/* Subtle overlay for readability */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `linear-gradient(180deg, transparent 0%, var(--color-surface-base) ${100 - overlayOpacity * 100}%)`,
            opacity: mode === 'floating-shapes' || mode === 'aurora' ? overlayOpacity : 0,
          }}
        />

        {/* Content layer */}
        <div className="relative z-10">{children}</div>
      </div>
    )
  }
)

AnimatedBackground.displayName = 'AnimatedBackground'
