/**
 * GradientBorderCardRenderer - Gradient-border variant renderer for MaterialCard
 */

import * as React from 'react'
import { useState, type ReactNode, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { premiumGlowIntensityMap, premiumRoundedMap, premiumPaddingMap } from '@/components/shared/CardPrimitives'

interface GradientBorderRendererProps {
  children: ReactNode
  className?: string
  baseStyle: CSSProperties
  onClick?: () => void
  hoverGlow?: boolean
  hover?: boolean
  press?: boolean
  layout?: boolean
  layoutId?: string
  shimmer?: boolean
  bgColor?: string
  gradientGlowColor: string
  gradientGlowIntensity: 'subtle' | 'medium' | 'strong'
  borderWidth: number
  rounded: string
  padding: string
}

export function GradientBorderRenderer({
  children,
  className,
  baseStyle,
  onClick,
  hoverGlow = true,
  press = false,
  layout,
  layoutId,
  shimmer = false,
  bgColor,
  gradientGlowColor,
  gradientGlowIntensity,
  borderWidth,
  rounded,
  padding,
}: GradientBorderRendererProps) {
  const [isHovering, setIsHovering] = useState(false)
  const glowConfig = premiumGlowIntensityMap[gradientGlowIntensity]
  const radius = premiumRoundedMap[rounded]
  const pad = premiumPaddingMap[padding]

  const innerRadius = React.useMemo(() => {
    const r = parseInt(radius)
    return `${Math.max(r - borderWidth, 0)}px`
  }, [radius, borderWidth])

  return (
    <motion.div
      layout={layout}
      layoutId={layoutId}
      className={cn(
        'relative overflow-hidden',
        onClick && 'cursor-pointer',
        className
      )}
      style={baseStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      whileHover={hoverGlow ? {
        boxShadow: `0 0 ${glowConfig.spread}px rgba(${gradientGlowColor}, ${glowConfig.opacity}), 0 0 ${glowConfig.spread * 2}px rgba(${gradientGlowColor}, ${glowConfig.opacity * 0.5})`,
      } : undefined}
      whileTap={press ? { scale: 0.98 } : undefined}
      transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
    >
      {/* Glow diffusion layer */}
      {hoverGlow && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ borderRadius: radius }}
          animate={{
            boxShadow: isHovering
              ? `inset 0 0 ${glowConfig.spread * 0.8}px rgba(${gradientGlowColor}, ${glowConfig.opacity * 0.3})`
              : `inset 0 0 0px rgba(${gradientGlowColor}, 0)`,
          }}
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
        />
      )}

      {/* Inner background container */}
      <div
        className="relative overflow-hidden w-full h-full"
        style={{
          borderRadius: innerRadius,
          background: bgColor || 'var(--color-surface-raised)',
          padding: pad,
        }}
      >
        {/* Shimmer animation */}
        {shimmer && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-primary) 4%, transparent), color-mix(in srgb, var(--color-location) 3%, transparent), transparent)`,
              backgroundSize: '300% 100%',
            }}
            animate={{ backgroundPosition: ['300% 0', '-300% 0'] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'linear' }}
          />
        )}

        {/* Hover inner glow */}
        {hoverGlow && (
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `radial-gradient(ellipse at 50% 0%, rgba(${gradientGlowColor}, 0.06) 0%, transparent 60%)`,
            }}
            animate={{ opacity: isHovering ? 1 : 0 }}
            transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
          />
        )}

        {/* Content */}
        <div className="relative z-10">{children}</div>
      </div>
    </motion.div>
  )
}
