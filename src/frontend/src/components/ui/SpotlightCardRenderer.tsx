/**
 * SpotlightCardRenderer - Spotlight variant renderer for MaterialCard
 */

import * as React from 'react'
import { useRef, useState, useCallback, type ReactNode, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { getSpotlightRGB, spotlightIntensityMap, roundedMap, paddingMap } from '@/components/shared/CardPrimitives'
import type { SpotlightColor } from '@/components/shared/CardPrimitives'
import type { CardBorder } from './MaterialCardVariants'

interface SpotlightRendererProps {
  children: ReactNode
  className?: string
  baseStyle: CSSProperties
  onClick?: () => void
  hover?: boolean
  press?: boolean
  layout?: boolean
  layoutId?: string
  contentClassName?: string
  padding: string
  rounded: string
  spotlightColor: SpotlightColor
  spotlightCustomColor?: string
  spotlightIntensity: 'subtle' | 'soft' | 'medium' | 'strong'
  border: CardBorder
}

export function SpotlightRenderer({
  children,
  className,
  baseStyle,
  onClick,
  hover = true,
  layout,
  layoutId,
  contentClassName,
  padding,
  rounded,
  spotlightColor,
  spotlightCustomColor,
  spotlightIntensity,
  border,
}: SpotlightRendererProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement | HTMLButtonElement>) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
  }, [])

  const rgbValue = spotlightCustomColor ?? getSpotlightRGB(spotlightColor)
  const spotlightConfig = spotlightIntensityMap[spotlightIntensity]

  const spotlightStyle = {
    ...baseStyle,
    '--spotlight-x': `${mousePosition.x}px`,
    '--spotlight-y': `${mousePosition.y}px`,
    '--spotlight-color': rgbValue,
    '--spotlight-size': `${spotlightConfig.size}px`,
    '--spotlight-opacity': spotlightConfig.opacity,
    borderRadius: roundedMap[rounded],
    background: baseStyle.background || 'var(--elevation-2)',
    border: border === 'none' ? '1px solid transparent' : '1px solid var(--border-subtle)',
    position: 'relative' as const,
    overflow: 'hidden' as const,
  } as React.CSSProperties

  const Wrapper = onClick ? motion.button : motion.div
  const wrapperProps = onClick
    ? { onClick, whileTap: { scale: 0.98 } }
    : {}

  return (
    <Wrapper
      ref={cardRef as any}
      layout={layout}
      layoutId={layoutId}
      className={cn(
        'relative text-left',
        onClick && 'cursor-pointer',
        className
      )}
      style={spotlightStyle}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      whileHover={hover ? { y: -2 } : undefined}
      transition={{ duration: DURATION.FAST, ease: EASE.SMOOTH }}
      {...wrapperProps}
    >
      {/* Spotlight overlay */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300"
        style={{
          opacity: isHovering ? 1 : 0,
          background: `radial-gradient(${spotlightConfig.size}px circle at var(--spotlight-x) var(--spotlight-y), color-mix(in srgb, rgb(var(--spotlight-color)) calc(var(--spotlight-opacity) * 100%), transparent), transparent 60%)`,
        }}
      />

      {/* Subtle border glow on hover */}
      <div
        className="absolute inset-0 pointer-events-none transition-opacity duration-300 rounded-inherit"
        style={{
          opacity: isHovering ? 0.5 : 0,
          borderRadius: 'inherit',
          boxShadow: `inset 0 0 0 1px color-mix(in srgb, rgb(${rgbValue}) 15%, transparent)`,
        }}
      />

      {/* Content */}
      <div
        className={cn('relative z-10', contentClassName)}
        style={{ padding: paddingMap[padding] }}
      >
        {children}
      </div>
    </Wrapper>
  )
}
