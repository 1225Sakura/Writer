/**
 * SpotlightCard - 鼠标跟随聚光灯效果卡片
 *
 * 使用 CSS variables + mousemove 实现鼠标跟随的聚光灯效果
 * 适用于重要功能区块、特色卡片展示
 * 主题感知，支持多种发光色彩
 */

import { useRef, useState, useCallback, type ReactNode, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

export type SpotlightColor =
  | 'accent'
  | 'character'
  | 'item'
  | 'location'
  | 'faction'
  | 'outline'
  | 'ifline'
  | 'vermillion'
  | 'white'

export type SpotlightIntensity = 'subtle' | 'soft' | 'medium' | 'strong'

export interface SpotlightCardProps {
  children: ReactNode
  className?: string
  /** 内容区域类名 */
  contentClassName?: string
  /** 聚光灯颜色主题 */
  color?: SpotlightColor
  /** 自定义颜色值 */
  customColor?: string
  /** 发光强度 */
  intensity?: SpotlightIntensity
  /** 圆角大小 */
  rounded?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
  /** 内边距 */
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl'
  /** 是否启用悬停效果 */
  hover?: boolean
  /** 点击回调 */
  onClick?: () => void
  /** 自定义背景 */
  background?: string
  /** 边框 */
  border?: boolean
}

const colorMap: Record<SpotlightColor, string> = {
  accent: '94, 106, 210',
  character: '232, 184, 125',
  item: '155, 126, 217',
  location: '94, 181, 166',
  faction: '212, 93, 93',
  outline: '91, 142, 232',
  ifline: '126, 183, 74',
  vermillion: '196, 92, 92',
  white: '245, 240, 230',
}

const intensityMap: Record<SpotlightIntensity, { size: number; opacity: number }> = {
  subtle: { size: 180, opacity: 0.06 },
  soft: { size: 220, opacity: 0.1 },
  medium: { size: 280, opacity: 0.14 },
  strong: { size: 350, opacity: 0.2 },
}

const roundedMap = {
  sm: '6px',
  md: '8px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
}

const paddingMap = {
  none: '0',
  sm: '12px',
  md: '16px',
  lg: '24px',
  xl: '32px',
}

/**
 * SpotlightCard - 鼠标跟随聚光灯卡片
 *
 * 特性：
 * - 鼠标移动时产生跟随光斑
 * - 9种颜色主题 + 自定义
 * - 4种发光强度
 * - 支持点击和悬停微动效
 * - 使用 CSS variables 实现高性能渲染
 */
export function SpotlightCard({
  children,
  className,
  contentClassName,
  color = 'accent',
  customColor,
  intensity = 'soft',
  rounded = 'lg',
  padding = 'md',
  hover = true,
  onClick,
  background = 'var(--elevation-2)',
  border = true,
}: SpotlightCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  const rgbValue = customColor ?? colorMap[color]
  const intensityConfig = intensityMap[intensity]

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }, [])

  const handleMouseEnter = useCallback(() => {
    setIsHovering(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
  }, [])

  const spotlightStyle: CSSProperties = {
    '--spotlight-x': `${mousePosition.x}px`,
    '--spotlight-y': `${mousePosition.y}px`,
    '--spotlight-color': rgbValue,
    '--spotlight-size': `${intensityConfig.size}px`,
    '--spotlight-opacity': intensityConfig.opacity,
    borderRadius: roundedMap[rounded],
    background,
    border: border ? '1px solid var(--border-subtle)' : '1px solid transparent',
    position: 'relative',
    overflow: 'hidden',
  } as CSSProperties

  if (onClick) {
    return (
      <motion.button
        className={cn(
          'relative text-left cursor-pointer',
          className
        )}
        style={spotlightStyle}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={onClick}
        whileHover={hover ? { y: -2 } : undefined}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Spotlight overlay */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: isHovering ? 1 : 0,
            background: `radial-gradient(${intensityConfig.size}px circle at var(--spotlight-x) var(--spotlight-y), rgba(var(--spotlight-color), var(--spotlight-opacity)), transparent 60%)`,
          }}
        />

        {/* Subtle border glow on hover */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300 rounded-inherit"
          style={{
            opacity: isHovering ? 0.5 : 0,
            borderRadius: 'inherit',
            boxShadow: `inset 0 0 0 1px rgba(${rgbValue}, 0.15)`,
          }}
        />

        {/* Content */}
        <div
          className={cn('relative z-10', contentClassName)}
          style={{ padding: paddingMap[padding] }}
        >
          {children}
        </div>
      </motion.button>
    )
  }

  return (
    <motion.div
      ref={cardRef}
      className={cn(
        'relative text-left',
        onClick && 'cursor-pointer',
        className
      )}
      style={spotlightStyle}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      whileHover={hover ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Spotlight overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isHovering ? 1 : 0,
          background: `radial-gradient(${intensityConfig.size}px circle at var(--spotlight-x) var(--spotlight-y), rgba(var(--spotlight-color), var(--spotlight-opacity)), transparent 60%)`,
        }}
      />

      {/* Subtle border glow on hover */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 rounded-inherit"
        style={{
          opacity: isHovering ? 0.5 : 0,
          borderRadius: 'inherit',
          boxShadow: `inset 0 0 0 1px rgba(${rgbValue}, 0.15)`,
        }}
      />

      {/* Content */}
      <div
        className={cn('relative z-10', contentClassName)}
        style={{ padding: paddingMap[padding] }}
      >
        {children}
      </div>
    </motion.div>
  )
}

/**
 * SpotlightGrid - 聚光灯卡片网格容器
 * 自动为子元素添加聚光灯效果
 */
export function SpotlightGrid({
  children,
  className,
  columns = 3,
  gap = '16px',
}: {
  children: ReactNode
  className?: string
  columns?: number
  gap?: string
}) {
  return (
    <div
      className={cn('grid', className)}
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gap,
      }}
    >
      {children}
    </div>
  )
}
