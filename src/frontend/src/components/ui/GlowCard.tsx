import * as React from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export interface GlowCardProps extends React.HTMLAttributes<HTMLDivElement> {
  glowColor?: string
  intensity?: 'low' | 'medium' | 'high'
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

export const GlowCard = React.forwardRef<HTMLDivElement, GlowCardProps>(
  ({ className, glowColor = '#5e6ad2', intensity = 'medium', children, style, ...props }, ref) => {
    const config = intensityMap[intensity]

    return (
      <div
        ref={ref}
        className={twMerge(
          clsx(
            'relative rounded-xl bg-[rgba(255,255,255,0.03)] border border-[rgba(255,255,255,0.08)]',
            'transition-all duration-300',
            'hover:border-[rgba(255,255,255,0.12)]',
            'group'
          ),
          className
        )}
        style={{
          boxShadow: `${config.shadow} ${glowColor}${Math.round(config.opacity * 255).toString(16).padStart(2, '0')}`,
          ...style,
        }}
        onMouseEnter={(e) => {
          const target = e.currentTarget
          target.style.boxShadow = `${config.hoverShadow} ${glowColor}${Math.round(config.hoverOpacity * 255).toString(16).padStart(2, '0')}`
        }}
        onMouseLeave={(e) => {
          const target = e.currentTarget
          target.style.boxShadow = `${config.shadow} ${glowColor}${Math.round(config.opacity * 255).toString(16).padStart(2, '0')}`
        }}
        {...props}
      >
        {children}
      </div>
    )
  }
)

GlowCard.displayName = 'GlowCard'
