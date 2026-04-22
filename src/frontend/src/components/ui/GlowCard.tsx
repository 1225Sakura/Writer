import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { motion } from 'framer-motion'

export interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: string
  intensity?: 'low' | 'medium' | 'high'
  animated?: boolean
  pulse?: boolean
  children: React.ReactNode
}

const intensityMap = {
  low: {
    shadow: '0 0 12px',
    hoverShadow: '0 0 20px',
    opacity: 0.15,
    hoverOpacity: 0.25,
  },
  medium: {
    shadow: '0 0 20px',
    hoverShadow: '0 0 32px',
    opacity: 0.2,
    hoverOpacity: 0.35,
  },
  high: {
    shadow: '0 0 32px',
    hoverShadow: '0 0 48px',
    opacity: 0.3,
    hoverOpacity: 0.45,
  },
}

function hexToRgba(hex: string, alpha: number): string {
  const sanitized = hex.replace('#', '')
  const bigint = parseInt(sanitized, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
  (
    {
      className,
      glowColor = '#5e6ad2',
      intensity = 'medium',
      animated = false,
      pulse = false,
      children,
      style,
      ...props
    },
    ref
  ) => {
    const config = intensityMap[intensity]
    const [isHovered, setIsHovered] = React.useState(false)

    const currentOpacity = isHovered ? config.hoverOpacity : config.opacity
    const currentShadow = isHovered ? config.hoverShadow : config.shadow

    const glowStyle: React.CSSProperties = {
      boxShadow: `${currentShadow} ${hexToRgba(glowColor, currentOpacity)}`,
      ...style,
    }

    const Wrapper = animated ? motion.div : 'div'
    const wrapperProps = animated
      ? {
          whileHover: { scale: 1.01 },
          transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
        }
      : {}

    return (
      <Wrapper
        ref={ref as any}
        className={twMerge(
          clsx(
            'relative rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]',
            'transition-all duration-300',
            'hover:border-[rgba(255,255,255,0.12)]',
            'group',
            pulse && 'animate-glow'
          ),
          className
        )}
        style={glowStyle}
        onMouseEnter={(e: React.MouseEvent) => {
          setIsHovered(true)
          props.onMouseEnter?.(e)
        }}
        onMouseLeave={(e: React.MouseEvent) => {
          setIsHovered(false)
          props.onMouseLeave?.(e)
        }}
        {...(wrapperProps as any)}
        {...props}
      >
        {/* Inner glow overlay on hover */}
        <div
          className={clsx(
            'absolute inset-0 rounded-xl pointer-events-none transition-opacity duration-300',
            isHovered ? 'opacity-100' : 'opacity-0'
          )}
          style={{
            background: `radial-gradient(ellipse at 50% 0%, ${hexToRgba(glowColor, 0.08)} 0%, transparent 60%)`,
          }}
        />

        {/* Top edge glow line */}
        <div
          className={clsx(
            'absolute top-0 left-4 right-4 h-[1px] transition-opacity duration-300',
            isHovered ? 'opacity-100' : 'opacity-40'
          )}
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${hexToRgba(glowColor, 0.6)} 50%, transparent 100%)`,
          }}
        />

        <div className="relative z-10">{children}</div>
      </Wrapper>
    )
  }
)

GlowCard.displayName = 'GlowCard'
