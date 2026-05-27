/**
 * DefaultCardRenderer - Default/Elevated/Floating/Glow variant renderer for MaterialCard
 */

import { motion } from 'framer-motion'
import { type ReactNode, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { DURATION, EASE } from '@/components/shared/AnimationConfig'
import { entityColorMap, entityGlowMap } from '@/components/shared/CardPrimitives'
import type { GlowIntensity } from '@/components/shared/CardPrimitives'
import type { CardVariant, CardBorder, EntityColor } from './MaterialCardVariants'

interface DefaultCardRendererProps {
  children: ReactNode
  className?: string
  baseStyle: CSSProperties
  onClick?: () => void
  hover?: boolean
  press?: boolean
  layout?: boolean
  layoutId?: string
  shimmer?: boolean
  animated?: boolean
  variant: CardVariant
  border: CardBorder
  entityColor: EntityColor
  glowIntensity: GlowIntensity
  glowColorValue: string
  isLight: boolean
}

export function DefaultCardRenderer({
  children,
  className,
  baseStyle,
  onClick,
  hover = true,
  press = false,
  layout,
  layoutId,
  shimmer = false,
  animated = false,
  variant,
  border,
  entityColor,
  glowIntensity,
  glowColorValue,
  isLight,
}: DefaultCardRendererProps) {
  const Component = layout || layoutId ? motion.div : 'div'

  return (
    <Component
      layout={layout}
      layoutId={layoutId}
      className={cn(
        'relative overflow-hidden',
        hover && 'cursor-pointer',
        onClick && 'cursor-pointer',
        className
      )}
      style={baseStyle}
      onClick={onClick}
      whileHover={hover ? {
        y: -2,
        boxShadow: 'var(--shadow-elevated)',
      } : undefined}
      whileTap={press ? { scale: 0.98 } : undefined}
      transition={{ duration: DURATION.NORMAL, ease: EASE.SMOOTH }}
    >
      {/* Entity color border overlay */}
      {border === 'glow' && (
        <motion.div
          className="absolute inset-0 rounded-inherit pointer-events-none"
          style={{
            padding: '1.5px',
            background: `linear-gradient(135deg, ${entityColorMap[entityColor]}, ${entityGlowMap[entityColor]})`,
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
            borderRadius: 'inherit',
          }}
        />
      )}

      {/* Hover glow overlay for glow/accent borders */}
      {(border === 'glow' || border === 'accent') && hover && (
        <motion.div
          className="absolute inset-0 rounded-inherit pointer-events-none"
          initial={{ opacity: 0 }}
          whileHover={{ opacity: 1 }}
          transition={{ duration: DURATION.SLOW, ease: EASE.SMOOTH }}
          style={{
            background: isLight
              ? 'radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--accent-primary) 6%, transparent) 0%, transparent 60%)'
              : 'radial-gradient(ellipse at 50% 0%, color-mix(in srgb, var(--accent-primary) 8%, transparent) 0%, transparent 60%)',
          }}
        />
      )}

      {/* Shimmer animation overlay */}
      {shimmer && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-inherit"
          style={{
            background: isLight
              ? 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--accent-primary) 4%, transparent), transparent)'
              : 'linear-gradient(90deg, transparent, color-mix(in srgb, var(--text-primary) 3%, transparent), transparent)',
            backgroundSize: '200% 100%',
          }}
          animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Glow variant inner glow overlay */}
      {variant === 'glow' && glowIntensity !== 'subtle' && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${glowColorValue} 0%, transparent 70%)`,
            opacity: 0.06,
          }}
        />
      )}

      {/* Glow variant animated pulse */}
      {variant === 'glow' && animated && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${glowColorValue} 0%, transparent 70%)`,
          }}
          animate={{
            opacity: [0.03, 0.08, 0.03],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      )}

      {children}
    </Component>
  )
}
