/**
 * TexturedBackground - 纹理背景组件
 *
 * 提供宣纸噪点、网格、点阵等纹理效果
 * 用于写作区域或页面装饰
 * 主题感知纹理变化
 */

import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export type TextureType =
  | 'noise'      // 噪点纹理
  | 'grid'       // 网格线
  | 'dots'       // 点阵
  | 'crosshatch' // 交叉线
  | 'paper'      // 宣纸纹理
  | 'lines'      // 横线
  | 'none'

export type TextureIntensity = 'subtle' | 'light' | 'medium' | 'strong'

export interface TexturedBackgroundProps {
  children?: ReactNode
  className?: string
  /** 纹理类型 */
  texture?: TextureType
  /** 纹理强度 */
  intensity?: TextureIntensity
  /** 纹理颜色（默认使用主题色） */
  color?: string
  /** 背景色 */
  background?: string
  /** 是否使用主题感知纹理 */
  themeAware?: boolean
  /** 自定义纹理 SVG */
  customTexture?: string
  /** 混合模式 */
  blendMode?: CSSProperties['mixBlendMode']
  /** 是否全屏 */
  fullScreen?: boolean
  /** 自定义样式 */
  style?: CSSProperties
}

const intensityMap: Record<TextureIntensity, number> = {
  subtle: 0.012,
  light: 0.025,
  medium: 0.04,
  strong: 0.07,
}

/**
 * 生成噪点纹理 SVG data URI
 */
function generateNoiseTexture(opacity: number, _color: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256">
      <filter id="n">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="4" stitchTiles="stitch"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#n)" opacity="${opacity}"/>
    </svg>
  `
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * 生成网格纹理 SVG data URI
 */
function generateGridTexture(opacity: number, color: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="${color}" stroke-width="0.5" opacity="${opacity}"/>
    </svg>
  `
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * 生成点阵纹理 SVG data URI
 */
function generateDotsTexture(opacity: number, color: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
      <circle cx="1" cy="1" r="0.5" fill="${color}" opacity="${opacity}"/>
    </svg>
  `
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * 生成交叉线纹理 SVG data URI
 */
function generateCrosshatchTexture(opacity: number, color: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20">
      <path d="M0 0L20 20M20 0L0 20" stroke="${color}" stroke-width="0.3" opacity="${opacity * 0.5}"/>
    </svg>
  `
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * 生成宣纸纹理 SVG data URI
 */
function generatePaperTexture(opacity: number, color: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">
      <filter id="p">
        <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5" result="noise"/>
        <feDiffuseLighting in="noise" lighting-color="${color}" surfaceScale="2">
          <feDistantLight azimuth="45" elevation="60"/>
        </feDiffuseLighting>
      </filter>
      <rect width="100%" height="100%" filter="url(#p)" opacity="${opacity}"/>
    </svg>
  `
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

/**
 * 生成横线纹理 SVG data URI
 */
function generateLinesTexture(opacity: number, color: string): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="100" height="32">
      <line x1="0" y1="31" x2="100" y2="31" stroke="${color}" stroke-width="0.5" opacity="${opacity}"/>
    </svg>
  `
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

const textureGenerators: Record<TextureType, (opacity: number, color: string) => string> = {
  noise: generateNoiseTexture,
  grid: generateGridTexture,
  dots: generateDotsTexture,
  crosshatch: generateCrosshatchTexture,
  paper: generatePaperTexture,
  lines: generateLinesTexture,
  none: () => '',
}

/**
 * TexturedBackground - 纹理背景组件
 *
 * 特性：
 * - 6种纹理类型（噪点/网格/点阵/交叉线/宣纸/横线）
 * - 4种强度级别
 * - 主题感知颜色
 * - 支持自定义纹理
 * - 可选全屏模式
 */
export function TexturedBackground({
  children,
  className,
  texture = 'noise',
  intensity = 'subtle',
  color,
  background,
  themeAware = true,
  customTexture,
  blendMode = 'normal',
  fullScreen = false,
  style,
}: TexturedBackgroundProps) {
  const opacity = intensityMap[intensity]
  const defaultColor = themeAware ? 'var(--text-primary)' : '#f5f0e6'
  const textureColor = color ?? defaultColor

  const textureUrl = customTexture ?? textureGenerators[texture](opacity, textureColor)

  const containerStyle: CSSProperties = {
    position: fullScreen ? 'fixed' : 'relative',
    inset: fullScreen ? 0 : undefined,
    background: background ?? 'var(--color-surface-base)',
    ...style,
  }

  const textureStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: textureUrl,
    opacity: 1,
    mixBlendMode: blendMode,
    pointerEvents: 'none',
    zIndex: 0,
  }

  if (texture === 'none') {
    return (
      <div className={cn(className)} style={containerStyle}>
        {children}
      </div>
    )
  }

  return (
    <div className={cn('relative overflow-hidden', className)} style={containerStyle}>
      <div style={textureStyle} aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </div>
  )
}

/**
 * WritingPaper - 写作专用宣纸背景
 * 预配置为写作区域优化的纹理
 */
export function WritingPaper({
  children,
  className,
  intensity = 'subtle',
  showLines = false,
}: {
  children: ReactNode
  className?: string
  intensity?: TextureIntensity
  showLines?: boolean
}) {
  return (
    <div className={cn('relative', className)}>
      {/* Base paper texture */}
      <TexturedBackground
        texture="paper"
        intensity={intensity}
        className="absolute inset-0"
      />
      {/* Optional writing lines */}
      {showLines && (
        <TexturedBackground
          texture="lines"
          intensity="light"
          color="var(--text-tertiary)"
          className="absolute inset-0"
          style={{ opacity: 0.3 }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  )
}

/**
 * NoiseOverlay - 噪点覆盖层
 * 用于给任何区域添加微妙的噪点质感
 */
export function NoiseOverlay({
  className,
  intensity = 'subtle',
  color,
}: {
  className?: string
  intensity?: TextureIntensity
  color?: string
}) {
  return (
    <TexturedBackground
      texture="noise"
      intensity={intensity}
      color={color}
      className={cn('absolute inset-0 pointer-events-none', className)}
    />
  )
}

/**
 * GridOverlay - 网格覆盖层
 * 用于对齐参考或装饰
 */
export function GridOverlay({
  className,
  intensity = 'subtle',
  color,
  size = '40px',
}: {
  className?: string
  intensity?: TextureIntensity
  color?: string
  size?: string
}) {
  const opacity = intensityMap[intensity]
  const defaultColor = 'var(--text-primary)'
  const gridColor = color ?? defaultColor

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
      <path d="M ${size} 0 L 0 0 0 ${size}" fill="none" stroke="${gridColor}" stroke-width="0.5" opacity="${opacity}"/>
    </svg>
  `
  const textureUrl = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`

  return (
    <div
      className={cn('absolute inset-0 pointer-events-none', className)}
      style={{
        backgroundImage: textureUrl,
        opacity: 1,
      }}
      aria-hidden="true"
    />
  )
}
