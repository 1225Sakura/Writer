/**
 * AvatarWithGlow - 带发光光环的头像组件
 *
 * 支持图片或文字头像，可配置发光颜色
 * 呼吸动画效果，在线状态指示点
 */

import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'
import { User } from 'lucide-react'

export type AvatarGlowColor = 'accent' | 'character' | 'item' | 'location' | 'faction' | 'outline' | 'ifline' | 'custom'
export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

export interface AvatarWithGlowProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 图片URL */
  src?: string
  /** 图片alt文本 */
  alt?: string
  /** 文字头像（当无图片时显示首字母） */
  fallbackText?: string
  /** 发光颜色主题 */
  glowColor?: AvatarGlowColor
  /** 自定义发光颜色 */
  customGlowColor?: string
  /** 发光强度 */
  glowIntensity?: 'subtle' | 'soft' | 'medium' | 'strong'
  /** 是否启用呼吸动画 */
  breathing?: boolean
  /** 在线状态 */
  status?: 'online' | 'offline' | 'busy' | 'idle' | 'none'
  /** 尺寸 */
  size?: AvatarSize
  /** 边框 */
  bordered?: boolean
  /** 是否方形头像 */
  square?: boolean
}

const colorMap: Record<string, string> = {
  accent: '#5e6ad2',
  character: '#e8b87d',
  item: '#9b7ed9',
  location: '#5eb5a6',
  faction: '#d45d5d',
  outline: '#5b8ee8',
  ifline: '#7eb84a',
  custom: '#5e6ad2',
}

const sizeMap: Record<AvatarSize, { container: number; fontSize: string; statusDot: number; statusOffset: number }> = {
  xs: { container: 24, fontSize: '10px', statusDot: 6, statusOffset: -1 },
  sm: { container: 32, fontSize: '12px', statusDot: 8, statusOffset: -1 },
  md: { container: 40, fontSize: '14px', statusDot: 10, statusOffset: -2 },
  lg: { container: 56, fontSize: '18px', statusDot: 12, statusOffset: -2 },
  xl: { container: 72, fontSize: '24px', statusDot: 14, statusOffset: -3 },
}

const intensityMap = {
  subtle: { shadow: '0 0 8px', opacity: 0.2, hoverOpacity: 0.35 },
  soft: { shadow: '0 0 14px', opacity: 0.3, hoverOpacity: 0.5 },
  medium: { shadow: '0 0 22px', opacity: 0.4, hoverOpacity: 0.6 },
  strong: { shadow: '0 0 32px', opacity: 0.55, hoverOpacity: 0.75 },
}

const statusColorMap = {
  online: '#5eb5a6',
  offline: '#8a8f98',
  busy: '#e8b87d',
  idle: '#9b7ed9',
  none: 'transparent',
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '')
  const bigint = parseInt(sanitized, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const AvatarWithGlow = React.forwardRef<HTMLDivElement, AvatarWithGlowProps>(
  (
    {
      className,
      src,
      alt = '',
      fallbackText,
      glowColor = 'accent',
      customGlowColor,
      glowIntensity = 'soft',
      breathing = true,
      status = 'none',
      size = 'md',
      bordered = true,
      square = false,
      ...props
    },
    ref
  ) => {
    const resolvedColor = customGlowColor ?? colorMap[glowColor] ?? colorMap.accent
    const sizeConfig = sizeMap[size]
    const intensityConfig = intensityMap[glowIntensity]
    const [imageError, setImageError] = React.useState(false)
    const [isHovered, setIsHovered] = React.useState(false)

    const currentOpacity = isHovered ? intensityConfig.hoverOpacity : intensityConfig.opacity

    const glowStyle: React.CSSProperties = {
      boxShadow: `${intensityConfig.shadow} ${hexToRgba(resolvedColor, currentOpacity)}`,
      transition: 'box-shadow 0.3s ease',
    }

    const breathingStyle: React.CSSProperties = breathing
      ? {
          animation: 'glow-pulse 3s ease-in-out infinite',
          animationDelay: `${Math.random() * 2}s`,
        }
      : {}

    const getInitials = (text: string): string => {
      if (!text) return ''
      // For Chinese names, take first 1-2 characters
      if (/[一-龥]/.test(text)) {
        return text.slice(0, Math.min(2, text.length))
      }
      // For English names, take first letters
      return text
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }

    const showImage = src && !imageError
    const initials = getInitials(fallbackText || '')

    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            'relative inline-flex shrink-0',
            className
          )
        )}
        {...props}
      >
        {/* Glow wrapper */}
        <motion.div
          className={clsx(
            'relative overflow-hidden flex items-center justify-center',
            square ? 'rounded-lg' : 'rounded-full'
          )}
          style={{
            width: sizeConfig.container,
            height: sizeConfig.container,
            ...glowStyle,
            ...breathingStyle,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          whileHover={{ scale: 1.05 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {/* Border ring */}
          {bordered && (
            <div
              className={clsx(
                'absolute inset-0 pointer-events-none',
                square ? 'rounded-lg' : 'rounded-full'
              )}
              style={{
                border: `1.5px solid ${hexToRgba(resolvedColor, 0.3)}`,
              }}
            />
          )}

          {/* Image */}
          {showImage && (
            <img
              src={src}
              alt={alt}
              className={clsx(
                'w-full h-full object-cover',
                square ? 'rounded-lg' : 'rounded-full'
              )}
              onError={() => setImageError(true)}
            />
          )}

          {/* Fallback - text initials */}
          {!showImage && initials && (
            <span
              className="font-semibold select-none"
              style={{
                fontSize: sizeConfig.fontSize,
                color: resolvedColor,
              }}
            >
              {initials}
            </span>
          )}

          {/* Fallback - icon */}
          {!showImage && !initials && (
            <User
              size={sizeConfig.container * 0.45}
              style={{ color: hexToRgba(resolvedColor, 0.6) }}
              strokeWidth={1.5}
            />
          )}

          {/* Inner subtle gradient overlay */}
          <div
            className={clsx(
              'absolute inset-0 pointer-events-none',
              square ? 'rounded-lg' : 'rounded-full'
            )}
            style={{
              background: `radial-gradient(circle at 30% 30%, ${hexToRgba(resolvedColor, 0.08)} 0%, transparent 60%)`,
            }}
          />
        </motion.div>

        {/* Status indicator */}
        {status !== 'none' && (
          <span
            className={clsx(
              'absolute rounded-full border-2',
              square ? 'bottom-0 right-0' : 'bottom-0 right-0'
            )}
            style={{
              width: sizeConfig.statusDot,
              height: sizeConfig.statusDot,
              backgroundColor: statusColorMap[status],
              borderColor: 'var(--color-surface-base, #0d0d12)',
              transform: `translate(${sizeConfig.statusOffset}px, ${sizeConfig.statusOffset}px)`,
            }}
          />
        )}
      </div>
    )
  }
)

AvatarWithGlow.displayName = 'AvatarWithGlow'
